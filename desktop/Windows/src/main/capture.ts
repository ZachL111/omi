import { desktopCapturer, screen, ipcMain, session } from 'electron'
import type { ScreenshotResult } from '../shared/types'

// Screen capture equivalents of ScreenCaptureService.swift. Screenshots come from
// desktopCapturer thumbnails; system audio comes from the display-media loopback
// handler (Windows WASAPI loopback, the SystemAudioCaptureService counterpart).

const JPEG_QUALITY = 80
const MAX_DIMENSION = 3000

export async function captureScreenshot(): Promise<ScreenshotResult | null> {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) }
  })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) return null
  const img = source.thumbnail
  const size = img.getSize()
  return {
    dataUrl: `data:image/jpeg;base64,${img.toJPEG(JPEG_QUALITY).toString('base64')}`,
    width: size.width,
    height: size.height
  }
}

// Defense-in-depth: getDisplayMedia auto-resolves to screen + loopback audio
// without a picker (needed for seamless meeting capture), so we only honor a
// request the app itself armed within the last few seconds. A compromised
// renderer calling getDisplayMedia out of band gets denied → can't silently
// record the screen/system audio.
let captureArmedUntil = 0
const ARM_WINDOW_MS = 5000

export function registerCaptureIpc(): void {
  ipcMain.handle('capture:screenshot', () => captureScreenshot())
  ipcMain.on('capture:arm-loopback', () => {
    captureArmedUntil = Date.now() + ARM_WINDOW_MS
  })
}

export function installLoopbackAudioHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      if (Date.now() > captureArmedUntil) {
        // Not an app-initiated capture — deny.
        callback({})
        return
      }
      captureArmedUntil = 0
      desktopCapturer.getSources({ types: ['screen'] }).then(
        (sources) => callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}),
        () => callback({})
      )
    },
    { useSystemPicker: false }
  )
}
