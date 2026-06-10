import { ipcMain, WebContents } from 'electron'
import WebSocket from 'ws'
import { getValidToken } from './auth'
import { pythonBaseURL } from './env'
import { settings } from './settings'
import type { TranscribeEvent } from '../shared/types'

// Bridge between renderer audio capture and the Python backend WebSockets, mirroring
// TranscriptionService.swift. Conversation mode -> /v4/listen (16 kHz mono PCM16,
// segments + memory events); PTT mode -> /v2/voice-message/transcribe-stream
// (interim/final, "finalize" text frame ends the turn).

type Mode = 'conversation' | 'ptt'

class TranscriptionBridge {
  private ws: WebSocket | null = null
  private mode: Mode = 'conversation'
  private sender: WebContents | null = null
  private channel = ''
  private closing = false
  private queue: Buffer[] = []

  private emit(event: TranscribeEvent): void {
    if (this.sender && !this.sender.isDestroyed()) this.sender.send(this.channel, event)
  }

  async start(sender: WebContents, channel: string, mode: Mode, language?: string): Promise<boolean> {
    this.stop()
    this.sender = sender
    this.channel = channel
    this.mode = mode
    this.closing = false
    this.queue = []

    const token = await getValidToken()
    if (!token) {
      this.emit({ type: 'status', status: 'error', detail: 'not signed in' })
      return false
    }

    const lang = language || settings.get().transcriptionLanguage || 'en'
    const base = pythonBaseURL(settings.get().pythonApiUrl).replace(/^http/, 'ws')
    const url =
      mode === 'conversation'
        ? `${base}v4/listen?language=${lang}&sample_rate=16000&codec=pcm16&channels=1` +
          `&include_speech_profile=true&source=desktop&speaker_auto_assign=enabled`
        : `${base}v2/voice-message/transcribe-stream?language=${lang}&sample_rate=16000&encoding=linear16&channels=1`

    this.emit({ type: 'status', status: 'connecting' })
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } })
    this.ws = ws

    ws.on('open', () => {
      this.emit({ type: 'status', status: 'connected' })
      for (const buf of this.queue.splice(0)) ws.send(buf)
    })
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      const text = data.toString()
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          this.emit({ type: 'segments', segments: parsed })
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.type === 'interim' || (parsed.is_final === false && typeof parsed.text === 'string')) {
            this.emit({ type: 'interim', text: parsed.text })
          } else if (parsed.type === 'final' || (parsed.is_final === true && typeof parsed.text === 'string')) {
            this.emit({ type: 'final', text: parsed.text })
          } else if (parsed.segment) {
            this.emit({ type: 'segments', segments: [parsed.segment] })
          } else {
            this.emit({ type: 'message', payload: parsed })
          }
        }
      } catch {
        // non-JSON frames are ignored, same as the Mac client
      }
    })
    ws.on('close', (code, reason) => {
      if (!this.closing) {
        this.emit({ type: 'status', status: 'closed', detail: `${code} ${reason.toString()}` })
      }
      this.ws = null
    })
    ws.on('error', (err) => {
      this.emit({ type: 'status', status: 'error', detail: String(err) })
    })
    return true
  }

  sendAudio(chunk: ArrayBuffer): void {
    const buf = Buffer.from(chunk)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(buf)
    else if (this.ws && this.ws.readyState === WebSocket.CONNECTING && this.queue.length < 200) {
      this.queue.push(buf)
    }
  }

  finalize(): void {
    if (this.mode === 'ptt' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send('finalize')
    }
  }

  stop(): void {
    this.closing = true
    if (this.ws) {
      try {
        this.ws.close(1000)
      } catch {}
      this.ws = null
    }
    this.emit({ type: 'status', status: 'closed' })
  }
}

const conversationBridge = new TranscriptionBridge()
const pttBridge = new TranscriptionBridge()

export function registerTranscriptionIpc(): void {
  ipcMain.handle('transcribe:start', (e, mode: Mode, language?: string) => {
    const bridge = mode === 'ptt' ? pttBridge : conversationBridge
    return bridge.start(e.sender, `transcribe:event:${mode}`, mode, language)
  })
  ipcMain.on('transcribe:audio', (_e, mode: Mode, chunk: ArrayBuffer) => {
    const bridge = mode === 'ptt' ? pttBridge : conversationBridge
    bridge.sendAudio(chunk)
  })
  ipcMain.on('transcribe:finalize', (_e, mode: Mode) => {
    const bridge = mode === 'ptt' ? pttBridge : conversationBridge
    bridge.finalize()
  })
  ipcMain.on('transcribe:stop', (_e, mode: Mode) => {
    const bridge = mode === 'ptt' ? pttBridge : conversationBridge
    bridge.stop()
  })
}
