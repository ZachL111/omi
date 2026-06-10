import { create } from 'zustand'
import { api } from '../api/client'
import { buildSystemPrompt, streamChatCompletion, type ChatMessage } from '../api/chat'

export interface UiChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  imageDataUrl?: string
  streaming?: boolean
  error?: boolean
}

interface ChatStore {
  messages: UiChatMessage[]
  streaming: boolean
  historyLoaded: boolean
  userName?: string
  setUserName: (name?: string) => void
  loadHistory: () => Promise<void>
  send: (text: string, opts?: { imageDataUrl?: string; screenContext?: string }) => Promise<void>
  stop: () => void
  clear: () => void
}

let activeCancel: (() => void) | null = null
let counter = 0
const nextId = () => `m${++counter}_${Date.now()}`

function toApiMessages(history: UiChatMessage[], opts?: { imageDataUrl?: string; screenContext?: string }, userName?: string): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(userName) }]
  // Cap context at the last 20 turns, mirroring the floating bar's short history window.
  const recent = history.slice(-20)
  for (let i = 0; i < recent.length; i++) {
    const m = recent[i]
    const isLast = i === recent.length - 1
    if (m.role === 'user' && isLast && opts?.imageDataUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: m.text || 'What do you see on my screen?' },
          { type: 'image_url', image_url: { url: opts.imageDataUrl } }
        ]
      })
    } else if (m.role === 'user' && isLast && opts?.screenContext) {
      messages.push({
        role: 'user',
        content: `${m.text}\n\n[Current screen text (OCR)]:\n${opts.screenContext.slice(0, 6000)}`
      })
    } else {
      messages.push({ role: m.role, content: m.text })
    }
  }
  return messages
}

export const useChat = create<ChatStore>((set, get) => ({
  messages: [],
  streaming: false,
  historyLoaded: false,
  userName: undefined,
  setUserName: (name) => set({ userName: name }),
  loadHistory: async () => {
    if (get().historyLoaded) return
    try {
      const server = await api.listMessages(60)
      const mapped: UiChatMessage[] = server
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          role: m.sender === 'ai' ? 'assistant' : 'user',
          text: m.text
        }))
      // History endpoint returns newest-first in some deployments — normalize by created_at.
      set({ messages: mapped, historyLoaded: true })
    } catch {
      set({ historyLoaded: true })
    }
  },
  send: async (text, opts) => {
    const trimmed = text.trim()
    if (!trimmed && !opts?.imageDataUrl) return
    if (get().streaming) return

    const userMsg: UiChatMessage = { id: nextId(), role: 'user', text: trimmed, imageDataUrl: opts?.imageDataUrl }
    const assistantMsg: UiChatMessage = { id: nextId(), role: 'assistant', text: '', streaming: true }
    set({ messages: [...get().messages, userMsg, assistantMsg], streaming: true })

    const finish = (errorText?: string) => {
      set({
        messages: get().messages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, streaming: false, error: !!errorText, text: errorText ? errorText : m.text }
            : m
        ),
        streaming: false
      })
      activeCancel = null
    }

    const run = (withImage: boolean) => {
      const apiMessages = toApiMessages(
        get().messages.filter((m) => m.id !== assistantMsg.id),
        withImage ? opts : { screenContext: opts?.screenContext },
        get().userName
      )
      const handle = streamChatCompletion(
        apiMessages,
        (delta) => {
          set({
            messages: get().messages.map((m) => (m.id === assistantMsg.id ? { ...m, text: m.text + delta } : m))
          })
        },
        () => finish(),
        (status, body) => {
          if (withImage && opts?.imageDataUrl && (status === 400 || status === 422)) {
            // Proxy may not accept image parts — retry with OCR text context instead.
            run(false)
            return
          }
          if (status === 402 || status === 403) {
            finish('This feature needs an active Omi subscription or trial. Open omi.me to manage your plan.')
          } else if (status === 429) {
            finish('Rate limited — give it a few seconds and try again.')
          } else {
            finish(`Something went wrong (HTTP ${status}). ${body.slice(0, 200)}`)
          }
        }
      )
      activeCancel = handle.cancel
    }

    run(!!opts?.imageDataUrl)
  },
  stop: () => {
    activeCancel?.()
    activeCancel = null
    set({
      streaming: false,
      messages: get().messages.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    })
  },
  clear: () => set({ messages: [] })
}))
