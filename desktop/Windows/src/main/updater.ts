import { app, dialog, BrowserWindow } from 'electron'
import updaterPkg from 'electron-updater'

// Windows counterpart of the Mac app's Sparkle auto-update. electron-updater pulls
// from the GitHub releases feed configured in electron-builder.yml (publish:). On
// macOS Sparkle checks every 10 min; we check on launch + on demand.

const { autoUpdater } = updaterPkg

let wired = false
let manualCheck = false

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'none' | 'error'
  version?: string
  percent?: number
  error?: string
}

let state: UpdateState = { status: 'idle' }

function broadcast(): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('updater:state', state)
}

function wire(): void {
  if (wired) return
  wired = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    state = { status: 'checking' }
    broadcast()
  })
  autoUpdater.on('update-available', (info) => {
    state = { status: 'available', version: info.version }
    broadcast()
  })
  autoUpdater.on('update-not-available', () => {
    state = { status: 'none' }
    broadcast()
    if (manualCheck) {
      manualCheck = false
      void dialog.showMessageBox({
        type: 'info',
        message: `Omi ${app.getVersion()}`,
        detail: 'You are on the latest version.'
      })
    }
  })
  autoUpdater.on('download-progress', (p) => {
    state = { status: 'downloading', percent: Math.round(p.percent) }
    broadcast()
  })
  autoUpdater.on('update-downloaded', (info) => {
    state = { status: 'ready', version: info.version }
    broadcast()
    dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        message: 'Update ready',
        detail: `Omi ${info.version} has been downloaded. Restart to install.`
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall()
      })
      .catch(() => {})
  })
  autoUpdater.on('error', (err) => {
    state = { status: 'error', error: String(err) }
    broadcast()
    if (manualCheck) {
      manualCheck = false
      void dialog.showMessageBox({ type: 'error', message: 'Update check failed', detail: String(err) })
    }
  })
}

export async function checkForUpdates(manual = false): Promise<UpdateState> {
  if (!app.isPackaged) {
    // No update server in dev; report a friendly idle state.
    if (manual) {
      await dialog.showMessageBox({
        type: 'info',
        message: 'Updates',
        detail: 'Auto-update runs in installed builds. This is a dev build.'
      })
    }
    return { status: 'idle' }
  }
  wire()
  manualCheck = manual
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    state = { status: 'error', error: String(e) }
  }
  return state
}

export function getUpdateState(): UpdateState {
  return state
}

let startupTimer: NodeJS.Timeout | null = null

/** Check shortly after launch (non-blocking), like Sparkle's auto-check. */
export function scheduleStartupCheck(): void {
  if (!app.isPackaged) return
  startupTimer = setTimeout(() => {
    startupTimer = null
    void checkForUpdates(false)
  }, 8000)
  // Don't fire a deferred update check into a tearing-down app.
  app.once('will-quit', () => {
    if (startupTimer) {
      clearTimeout(startupTimer)
      startupTimer = null
    }
  })
}
