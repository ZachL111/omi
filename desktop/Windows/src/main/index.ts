import { app, session } from 'electron'
import { join } from 'path'
import { PROTOCOL_SCHEME } from './env'
import { restoreAuth, handleAuthCallback } from './auth'
import { registerIpc } from './ipc'
import { createMainWindow, createFloatingBar, getMainWindow } from './windows'
import { createTray, rebuildTrayMenu } from './tray'
import { registerHotkeys, watchHotkeySettings, unregisterAll } from './shortcuts'
import { installLoopbackAudioHandler } from './capture'
import { startRewindEngine, stopRewindEngine } from './rewind/capturer'
import { ocrService } from './rewind/ocr'
import { closeRewindDb } from './rewind/store'
import { startProactiveEngine, stopProactiveEngine } from './proactive/engine'
import { closeProactiveDb } from './proactive/store'
import { startFocusEngine, stopFocusEngine } from './focus/engine'
import { closeFocusDb } from './focus/store'
import { disposeGlow } from './focus/glow'
import { scheduleStartupCheck } from './updater'
import { settings } from './settings'

// App lifecycle, mirroring OmiApp.swift: single instance, protocol-scheme auth
// callback, tray-resident (closing the main window does not quit).

// Dev affordance: OMI_DEBUG_PORT=9333 exposes CDP for UI automation/screenshots.
if (process.env.OMI_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.OMI_DEBUG_PORT)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  if (process.defaultApp) {
    // Dev: register "electron.exe <absolute app path> <url>" so browser-launched
    // callbacks resolve regardless of the browser's working directory.
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [app.getAppPath()])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
  }

  app.on('second-instance', (_e, argv) => {
    const url = argv.find((a) => a.startsWith(`${PROTOCOL_SCHEME}://`))
    if (url) {
      void handleAuthCallback(url)
      return
    }
    const win = getMainWindow() ?? createMainWindow()
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  // macOS-style delivery; harmless on Windows, keeps parity if this ever runs elsewhere.
  app.on('open-url', (_e, url) => {
    if (url.startsWith(`${PROTOCOL_SCHEME}://`)) void handleAuthCallback(url)
  })

  app.whenReady().then(() => {
    restoreAuth()
    registerIpc()

    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(['media', 'display-capture', 'notifications'].includes(permission))
    })
    installLoopbackAudioHandler()

    createTray()
    createMainWindow()
    createFloatingBar()
    registerHotkeys()
    watchHotkeySettings()
    startRewindEngine()
    startProactiveEngine()
    startFocusEngine()
    scheduleStartupCheck()
    settings.on('changed', (next, prev) => {
      rebuildTrayMenu()
      if (next.launchAtLogin !== prev.launchAtLogin) {
        app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
      }
      if (next.floatingBarVisible !== prev.floatingBarVisible) {
        const bar = createFloatingBar()
        if (next.floatingBarVisible) bar.showInactive()
        else bar.hide()
      }
    })

    const launchUrl = process.argv.find((a) => a.startsWith(`${PROTOCOL_SCHEME}://`))
    if (launchUrl) void handleAuthCallback(launchUrl)
  })

  // Tray-resident app: keep running when all windows close (Mac app keeps the
  // floating bar + menu bar item alive the same way).
  app.on('window-all-closed', () => {})

  app.on('activate', () => createMainWindow())

  app.on('will-quit', () => {
    unregisterAll()
    stopRewindEngine()
    stopProactiveEngine()
    stopFocusEngine()
    ocrService.dispose()
    disposeGlow()
    closeRewindDb()
    closeProactiveDb()
    closeFocusDb()
  })
}
