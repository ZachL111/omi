import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

// Screen-edge glow overlay, the Windows counterpart of GlowOverlayWindow.swift:
// a borderless, transparent, click-through, always-on-top window covering the
// work area. Shows a green (focused) or red (distracted) animated border for
// ~2.5s, then hides. Colors/params match GlowBorderView.swift.

let overlay: BrowserWindow | null = null
let hideTimer: NodeJS.Timeout | null = null

const DEV_URL = process.env['ELECTRON_RENDERER_URL']

function ensureOverlay(): BrowserWindow {
  if (overlay && !overlay.isDestroyed()) return overlay
  const display = screen.getPrimaryDisplay()
  const { x, y, width, height } = display.bounds
  overlay = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    title: 'Omi Focus Glow',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })
  overlay.setIgnoreMouseEvents(true)
  overlay.setAlwaysOnTop(true, 'screen-saver')
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (DEV_URL) overlay.loadURL(`${DEV_URL}/glow.html`)
  else overlay.loadFile(join(__dirname, '../renderer/glow.html'))
  overlay.on('closed', () => {
    overlay = null
  })
  return overlay
}

/** Flash the glow for `status`. Resizes to the current primary display first. */
export function flashGlow(status: 'focused' | 'distracted'): void {
  const win = ensureOverlay()
  const display = screen.getPrimaryDisplay()
  win.setBounds(display.bounds)
  const send = () => win.webContents.send('glow:show', { status })
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
  win.showInactive()
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (overlay && !overlay.isDestroyed()) overlay.hide()
  }, 2700)
}

export function disposeGlow(): void {
  if (hideTimer) clearTimeout(hideTimer)
  overlay?.destroy()
  overlay = null
}
