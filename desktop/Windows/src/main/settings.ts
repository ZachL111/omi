import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'
import type { AppSettings } from '../shared/types'

const DEFAULTS: AppSettings = {
  hotkey: 'Control+Shift+Space',
  floatingBarVisible: true,
  rewindEnabled: false,
  rewindIntervalMs: 3000,
  retentionDays: 30,
  transcriptionLanguage: 'en',
  launchAtLogin: false,
  fontScale: 1.0,
  proactiveEnabled: false,
  proactiveIntervalMs: 180000,
  proactiveNotifications: true,
  focusEnabled: false,
  focusGlow: true,
  focusAnalysisDelayMs: 60000,
  focusCooldownMs: 600000,
  realtimeProvider: 'auto',
  ttsEnabled: false,
  ttsVoice: 'marin',
  customVocabulary: [],
  aiModel: 'claude-sonnet-4-6',
  updateChannel: 'stable',
  hasOnboarded: false,
  byokActive: false,
  byokAnthropic: '',
  byokOpenAI: '',
  byokGemini: '',
  byokDeepgram: '',
  pythonApiUrl: '',
  rustApiUrl: ''
}

class SettingsStore extends EventEmitter {
  private data: AppSettings
  private file: string

  constructor() {
    super()
    this.file = join(app.getPath('userData'), 'settings.json')
    this.data = { ...DEFAULTS }
    try {
      this.data = { ...DEFAULTS, ...JSON.parse(readFileSync(this.file, 'utf8')) }
    } catch {
      // first run
    }
  }

  get(): AppSettings {
    return { ...this.data }
  }

  set(partial: Partial<AppSettings>): AppSettings {
    const before = this.data
    this.data = { ...this.data, ...partial }
    try {
      mkdirSync(app.getPath('userData'), { recursive: true })
      writeFileSync(this.file, JSON.stringify(this.data, null, 2))
    } catch (e) {
      console.error('settings: persist failed', e)
    }
    this.emit('changed', this.data, before)
    return this.get()
  }
}

export const settings = new SettingsStore()
