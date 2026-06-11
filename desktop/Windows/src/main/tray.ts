import { Tray, Menu, nativeImage, app, dialog } from 'electron'
import { createMainWindow, toggleFloatingBar, getFloatingBar, getMainWindow } from './windows'
import { settings } from './settings'
import { resourcePath } from './resources'
import { checkForUpdates } from './updater'

// Mirrors the NSStatusBar menu in OmiApp.swift:setupMenuBar().

let tray: Tray | null = null

export function rebuildTrayMenu(): void {
  if (!tray) return
  const s = settings.get()
  const floatingVisible = getFloatingBar()?.isVisible() ?? false
  const menu = Menu.buildFromTemplate([
    {
      label: floatingVisible ? 'Hide Floating Bar' : 'Show Floating Bar',
      click: () => {
        toggleFloatingBar()
        rebuildTrayMenu()
      }
    },
    {
      label: 'Screen Capture',
      type: 'checkbox',
      checked: s.rewindEnabled,
      click: (item) => {
        settings.set({ rewindEnabled: item.checked })
        rebuildTrayMenu()
      }
    },
    {
      label: 'Audio Recording',
      click: () => {
        const win = createMainWindow()
        win.webContents.send('app:navigate', 'conversations')
      }
    },
    { type: 'separator' },
    { label: 'Open Omi', click: () => createMainWindow() },
    {
      label: 'Settings',
      click: () => {
        const win = createMainWindow()
        win.webContents.send('app:navigate', 'settings')
      }
    },
    {
      label: 'Rewind',
      click: () => {
        const win = createMainWindow()
        win.webContents.send('app:navigate', 'rewind')
      }
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => void checkForUpdates(true)
    },
    {
      label: 'About omi',
      click: async () => {
        await dialog.showMessageBox(getMainWindow() ?? createMainWindow(), {
          type: 'info',
          message: `omi for Windows`,
          detail: `Version ${app.getVersion()}\nYour AI that remembers everything.`
        })
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
}

export function createTray(): Tray {
  if (tray) return tray
  const icon = nativeImage.createFromPath(resourcePath('tray_icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('omi')
  tray.on('double-click', () => createMainWindow())
  rebuildTrayMenu()
  return tray
}
