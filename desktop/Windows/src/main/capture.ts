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

export function registerCaptureIpc(): void {
  ipcMain.handle('capture:screenshot', () => captureScreenshot())
}

/** getDisplayMedia({audio:true}) from any renderer resolves to primary screen + system loopback audio. */
export function installLoopbackAudioHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        callback({ video: sources[0], audio: 'loopback' })
      })
    },
    { useSystemPicker: false }
  )
}
