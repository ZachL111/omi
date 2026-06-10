import { BrowserWindow, screen, shell, app } from 'electron'
import { join } from 'path'
import { settings } from './settings'

// Geometry mirrors the Mac app: main window 1200x800 (min 900x600,
// DesktopHomeView.swift); floating bar is a borderless always-on-top panel
// (FloatingControlBarWindow.swift) whose size is driven by the renderer state.

let mainWindow: BrowserWindow | null = null
let floatingBar: BrowserWindow | null = null

const DEV_URL = process.env['ELECTRON_RENDERER_URL']

function loadRenderer(win: BrowserWindow, page: 'index' | 'floating'): void {
  if (DEV_URL) {
    win.loadURL(`${DEV_URL}/${page === 'index' ? '' : 'floating.html'}`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getFloatingBar(): BrowserWindow | null {
  return floatingBar
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0F0F0F',
    title: 'Omi',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0F0F0F', symbolColor: '#B0B0B0', height: 38 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  loadRenderer(mainWindow, 'index')
  return mainWindow
}

// Collapsed pill is 40x14 on Mac; we keep a slightly larger hit target on Windows
// because there is no tracking-area hover wake-up at 14px height.
export const FLOATING_SIZES = {
  pill: { width: 56, height: 22 },
  bar: { width: 210, height: 50 },
  conversation: { width: 430, height: 430 }
}

export function createFloatingBar(): BrowserWindow {
  if (floatingBar && !floatingBar.isDestroyed()) return floatingBar

  const display = screen.getPrimaryDisplay()
  const wa = display.workArea
  const savedPos = settings.get().floatingBarPosition

  const w = FLOATING_SIZES.bar.width
  const x = savedPos?.x ?? Math.round(wa.x + (wa.width - w) / 2)
  const y = savedPos?.y ?? wa.y + 8

  floatingBar = new BrowserWindow({
    width: w,
    height: FLOATING_SIZES.bar.height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: 'Omi Floating Bar',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })
  floatingBar.setAlwaysOnTop(true, 'screen-saver')
  floatingBar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  floatingBar.on('moved', () => {
    if (!floatingBar) return
    const [px, py] = floatingBar.getPosition()
    settings.set({ floatingBarPosition: { x: px, y: py } })
  })
  floatingBar.on('closed', () => {
    floatingBar = null
  })
  loadRenderer(floatingBar, 'floating')
  floatingBar.once('ready-to-show', () => {
    if (settings.get().floatingBarVisible) floatingBar?.show()
  })
  return floatingBar
}

/** Resize the floating bar around a fixed top-center anchor, clamped to the work area. */
export function resizeFloatingBar(width: number, height: number): void {
  if (!floatingBar || floatingBar.isDestroyed()) return
  const [x, y] = floatingBar.getPosition()
  const [curW] = floatingBar.getSize()
  const display = screen.getDisplayNearestPoint({ x, y })
  const wa = display.workArea
  let nx = Math.round(x + (curW - width) / 2)
  nx = Math.max(wa.x, Math.min(nx, wa.x + wa.width - width))
  const ny = Math.max(wa.y, Math.min(y, wa.y + wa.height - height))
  floatingBar.setBounds({ x: nx, y: ny, width: Math.round(width), height: Math.round(height) })
}

export function toggleFloatingBar(visible?: boolean): boolean {
  const bar = createFloatingBar()
  const next = visible ?? !bar.isVisible()
  if (next) bar.showInactive()
  else bar.hide()
  settings.set({ floatingBarVisible: next })
  return next
}

export function quitApp(): void {
  app.quit()
}
