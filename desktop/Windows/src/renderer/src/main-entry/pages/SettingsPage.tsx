import React, { useEffect, useState } from 'react'
import { SectionCard, SettingRow, Toggle } from '../../components/ui'
import { formatBytes } from '../../lib/format'
import { useAuth } from '../../stores/auth'
import { useSettings } from '../../stores/settings'

type Section = 'general' | 'rewind' | 'proactive' | 'transcription' | 'account' | 'advanced' | 'about'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'rewind', label: 'Rewind' },
  { key: 'proactive', label: 'Proactive' },
  { key: 'transcription', label: 'Transcription' },
  { key: 'account', label: 'Account' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'about', label: 'About' }
]

const LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'hi', 'ru', 'uk', 'zh', 'ja', 'ko', 'ar']

export function SettingsPage() {
  const { settings, update } = useSettings()
  const auth = useAuth((s) => s.state)
  const signOut = useAuth((s) => s.signOut)
  const [section, setSection] = useState<Section>('general')
  const [version, setVersion] = useState('')
  const [rewindStats, setRewindStats] = useState<{ frames: number; bytes: number } | null>(null)
  const [capturingHotkey, setCapturingHotkey] = useState(false)

  useEffect(() => {
    void window.omi.system.version().then(setVersion)
    void window.omi.rewind.status().then((s) => setRewindStats(s))
  }, [])

  useEffect(() => {
    if (!capturingHotkey) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Control')
      if (e.shiftKey) parts.push('Shift')
      if (e.altKey) parts.push('Alt')
      const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
      parts.push(key)
      if (parts.length >= 2) {
        void update({ hotkey: parts.join('+') })
        setCapturingHotkey(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturingHotkey])

  if (!settings) return null

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 190, borderRight: '1px solid var(--border)', padding: '46px 10px 14px', flexShrink: 0 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '9px 12px',
              borderRadius: 11,
              fontSize: 13.5,
              color: section === s.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: section === s.key ? 'var(--bg-tertiary)' : 'transparent',
              marginBottom: 2
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '46px 26px 26px', minWidth: 0 }}>
        <div className="page-title" style={{ marginBottom: 20, fontSize: 24 }}>
          {SECTIONS.find((s) => s.key === section)?.label}
        </div>

        {section === 'general' && (
          <>
            <SectionCard title="Ask Omi">
              <SettingRow label="Keyboard shortcut" description="Summons the floating bar from anywhere">
                <button className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => setCapturingHotkey(true)}>
                  {capturingHotkey ? 'Press keys…' : settings.hotkey.replace(/Control/g, 'Ctrl')}
                </button>
              </SettingRow>
              <SettingRow label="Show floating bar" description="The always-on-top pill at the top of your screen">
                <Toggle on={settings.floatingBarVisible} onChange={(v) => void update({ floatingBarVisible: v })} />
              </SettingRow>
            </SectionCard>
            <SectionCard title="System">
              <SettingRow label="Launch at login">
                <Toggle on={settings.launchAtLogin} onChange={(v) => void update({ launchAtLogin: v })} />
              </SettingRow>
              <SettingRow label="Font size" description="Scales text across the app">
                <input
                  type="range"
                  min={0.85}
                  max={1.3}
                  step={0.05}
                  value={settings.fontScale}
                  onChange={(e) => void update({ fontScale: parseFloat(e.target.value) })}
                  style={{ width: 130, accentColor: 'var(--purple-primary)', padding: 0, border: 'none', background: 'transparent' }}
                />
              </SettingRow>
            </SectionCard>
          </>
        )}

        {section === 'rewind' && (
          <>
            <SectionCard title="Screen Capture">
              <SettingRow label="Enable Rewind" description="Capture and index your screen so you can search anything you've seen">
                <Toggle on={settings.rewindEnabled} onChange={(v) => void update({ rewindEnabled: v })} />
              </SettingRow>
              <SettingRow label="Capture interval">
                <select
                  value={settings.rewindIntervalMs}
                  onChange={(e) => void update({ rewindIntervalMs: parseInt(e.target.value, 10) })}
                >
                  <option value={2000}>2 seconds</option>
                  <option value={3000}>3 seconds (default)</option>
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                </select>
              </SettingRow>
              <SettingRow label="Keep history for">
                <select
                  value={settings.retentionDays}
                  onChange={(e) => void update({ retentionDays: parseInt(e.target.value, 10) })}
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </SettingRow>
              <SettingRow
                label="Storage"
                description="Frames and OCR text are stored locally, never uploaded"
              >
                <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                  {rewindStats ? `${rewindStats.frames} frames · ${formatBytes(rewindStats.bytes)}` : '—'}
                </span>
              </SettingRow>
            </SectionCard>
          </>
        )}

        {section === 'proactive' && (
          <SectionCard title="Proactive Assistant">
            <SettingRow
              label="Enable proactive assistant"
              description="Periodically read recent screen activity to extract memories, tasks, and useful nudges"
            >
              <Toggle
                on={settings.proactiveEnabled}
                onChange={(v) => void update({ proactiveEnabled: v, rewindEnabled: v ? true : settings.rewindEnabled })}
              />
            </SettingRow>
            <SettingRow label="Analysis interval">
              <select
                value={settings.proactiveIntervalMs}
                onChange={(e) => void update({ proactiveIntervalMs: parseInt(e.target.value, 10) })}
              >
                <option value={120000}>Every 2 minutes</option>
                <option value={180000}>Every 3 minutes (default)</option>
                <option value={300000}>Every 5 minutes</option>
                <option value={600000}>Every 10 minutes</option>
              </select>
            </SettingRow>
            <SettingRow label="Show insight notifications" description="Surface nudges in the floating bar as they happen">
              <Toggle
                on={settings.proactiveNotifications}
                onChange={(v) => void update({ proactiveNotifications: v })}
              />
            </SettingRow>
            <SettingRow
              label="Privacy"
              description="Screen text stays on this device; only short excerpts are sent to the model for analysis, same as the Mac app"
            >
              <span style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>local-first</span>
            </SettingRow>
          </SectionCard>
        )}

        {section === 'transcription' && (
          <SectionCard title="Live Transcription">
            <SettingRow label="Language">
              <select
                value={settings.transcriptionLanguage}
                onChange={(e) => void update({ transcriptionLanguage: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </SettingRow>
            <SettingRow
              label="System audio"
              description="Default for new recordings — captures meeting audio via Windows loopback"
            >
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>toggle on the Conversations page</span>
            </SettingRow>
          </SectionCard>
        )}

        {section === 'account' && (
          <SectionCard title="Account">
            <SettingRow label="Name">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{auth?.name || '—'}</span>
            </SettingRow>
            <SettingRow label="Email">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{auth?.email || '—'}</span>
            </SettingRow>
            <SettingRow label="Plan & usage" description="Subscriptions are managed on omi.me">
              <button className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => window.omi.system.openExternal('https://www.omi.me')}>
                Manage
              </button>
            </SettingRow>
            <SettingRow label="Sign out of this device">
              <button
                className="btn-secondary"
                style={{ fontSize: 12.5, color: 'var(--error)', borderColor: 'rgba(239,68,68,0.4)' }}
                onClick={signOut}
              >
                Sign Out
              </button>
            </SettingRow>
          </SectionCard>
        )}

        {section === 'advanced' && (
          <>
            <SectionCard title="Bring Your Own Keys">
              {(
                [
                  ['byokAnthropic', 'Anthropic API key'],
                  ['byokOpenAI', 'OpenAI API key'],
                  ['byokGemini', 'Gemini API key'],
                  ['byokDeepgram', 'Deepgram API key']
                ] as const
              ).map(([key, label]) => (
                <SettingRow key={key} label={label} description="Sent as X-BYOK header, used server-side">
                  <input
                    type="password"
                    placeholder="not set"
                    value={settings[key]}
                    onChange={(e) => void update({ [key]: e.target.value } as never)}
                    style={{ width: 220 }}
                  />
                </SettingRow>
              ))}
            </SectionCard>
            <SectionCard title="Backends">
              <SettingRow label="Python API URL" description="Default: https://api.omi.me/">
                <input
                  placeholder="https://api.omi.me/"
                  value={settings.pythonApiUrl}
                  onChange={(e) => void update({ pythonApiUrl: e.target.value })}
                  style={{ width: 260 }}
                />
              </SettingRow>
              <SettingRow label="Desktop backend URL" description="Default: production Cloud Run">
                <input
                  placeholder="https://desktop-backend-…run.app/"
                  value={settings.rustApiUrl}
                  onChange={(e) => void update({ rustApiUrl: e.target.value })}
                  style={{ width: 260 }}
                />
              </SettingRow>
            </SectionCard>
          </>
        )}

        {section === 'about' && (
          <SectionCard title="About omi">
            <SettingRow label="Version">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{version} (Windows)</span>
            </SettingRow>
            <SettingRow label="Website">
              <button className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => window.omi.system.openExternal('https://www.omi.me')}>
                omi.me
              </button>
            </SettingRow>
            <SettingRow label="Source">
              <button
                className="btn-secondary"
                style={{ fontSize: 12.5 }}
                onClick={() => window.omi.system.openExternal('https://github.com/BasedHardware/omi')}
              >
                github.com/BasedHardware/omi
              </button>
            </SettingRow>
            <SettingRow label="Built with" description="Windows port of the macOS app (desktop/Desktop), same backends and design system">
              <span style={{ fontSize: 12.5, color: 'var(--text-quaternary)' }}>Electron + TypeScript</span>
            </SettingRow>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
