import { app, ipcMain, shell, nativeImage } from 'electron'
import { readFileSync } from 'fs'
import { getAuthState, startSignIn, signOut, getValidToken } from './auth'
import { settings } from './settings'
import { resizeFloatingBar, toggleFloatingBar, createMainWindow, getFloatingBar } from './windows'
import { rebuildTrayMenu } from './tray'
import { listFrames, listDays, searchFrames, getFrame, latestOcrText } from './rewind/store'
import { getRewindStatus } from './rewind/capturer'
import { registerApiIpc } from './apiProxy'
import { registerTranscriptionIpc } from './transcription'
import { registerRealtimeIpc } from './realtime'
import { registerCaptureIpc } from './capture'
import { listInsights, markRead, markAllRead, deleteInsight } from './proactive/store'
import { getProactiveStatus, runProactiveNow } from './proactive/engine'
import { activateByok, deactivateByok } from './byok'
import { checkForUpdates } from './updater'
import { getFocusStatus, listSessions as listFocusSessions, todaySummary } from './focus/engine'

export function registerIpc(): void {
  registerApiIpc()
  registerTranscriptionIpc()
  registerRealtimeIpc()
  registerCaptureIpc()

  ipcMain.handle('auth:get-state', () => getAuthState())
  ipcMain.on('auth:sign-in', (_e, provider: 'google' | 'apple') => startSignIn(provider))
  ipcMain.on('auth:sign-out', () => signOut())
  ipcMain.handle('auth:get-token', () => getValidToken())

  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:set', (_e, partial) => {
    const next = settings.set(partial)
    rebuildTrayMenu()
    return next
  })

  ipcMain.on('floating:set-size', (_e, size: { width: number; height: number }) => {
    resizeFloatingBar(size.width, size.height)
  })
  ipcMain.on('floating:hide', () => {
    toggleFloatingBar(false)
    rebuildTrayMenu()
  })
  ipcMain.on('floating:open-main', (_e, page?: string) => {
    const win = createMainWindow()
    if (page) win.webContents.send('app:navigate', page)
  })
  ipcMain.on('floating:focus', () => {
    getFloatingBar()?.focus()
  })

  ipcMain.handle('rewind:list', (_e, day: string | null, limit: number, offset: number) =>
    listFrames(day, limit ?? 200, offset ?? 0)
  )
  ipcMain.handle('rewind:days', () => listDays())
  ipcMain.handle('rewind:search', (_e, q: string, limit?: number) => searchFrames(q, limit ?? 60))
  ipcMain.handle('rewind:status', () => getRewindStatus())
  ipcMain.handle('rewind:latest-ocr', (_e, maxAgeMs?: number) => latestOcrText(maxAgeMs ?? 30_000))
  ipcMain.handle('rewind:image', (_e, id: number) => {
    const frame = getFrame(id)
    if (!frame) return null
    try {
      const buf = readFileSync(frame.path)
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })
  ipcMain.handle('rewind:thumbnail', (_e, id: number, width: number) => {
    const frame = getFrame(id)
    if (!frame) return null
    try {
      const img = nativeImage.createFromPath(frame.path)
      const size = img.getSize()
      const h = Math.round((width / size.width) * size.height)
      return `data:image/jpeg;base64,${img.resize({ width, height: h }).toJPEG(70).toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('proactive:list', () => listInsights(100))
  ipcMain.handle('proactive:status', () => getProactiveStatus())
  ipcMain.handle('proactive:run-now', () => runProactiveNow())
  ipcMain.handle('proactive:mark-read', (_e, id: number) => markRead(id))
  ipcMain.handle('proactive:mark-all-read', () => markAllRead())
  ipcMain.handle('proactive:delete', (_e, id: number) => deleteInsight(id))

  ipcMain.handle('focus:status', () => getFocusStatus())
  ipcMain.handle('focus:sessions', () => listFocusSessions(200))
  ipcMain.handle('focus:summary', () => todaySummary())

  ipcMain.handle('byok:activate', () => activateByok())
  ipcMain.handle('byok:deactivate', () => deactivateByok())

  ipcMain.handle('updater:check', () => checkForUpdates(true))

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.on('shell:open-external', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
  })
}
