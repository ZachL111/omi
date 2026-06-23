import React, { useEffect, useState } from 'react'
import { IconTrash } from '../../components/Icons'
import { EmptyState } from '../../components/ui'
import { timeAgo } from '../../lib/format'
import { useProactive } from '../../stores/proactive'
import { useSettings } from '../../stores/settings'

const CATEGORY_COLOR: Record<string, string> = {
  focus: '#3B82F6',
  insight: '#8B5CF6',
  reminder: '#F59E0B'
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'insight', label: 'Insights' },
  { key: 'focus', label: 'Focus' },
  { key: 'reminder', label: 'Reminders' }
]

export function InsightsPage() {
  const store = useProactive()
  const { settings, update } = useSettings()
  const [filter, setFilter] = useState('all')
  const unread = store.insights.filter((i) => i.read === 0).length

  useEffect(() => {
    void store.load()
    // Mark everything read shortly after opening (so the unread badge is visible first).
    const t = setTimeout(() => void store.markAllRead(), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!settings) return null
  const filtered = filter === 'all' ? store.insights : store.insights.filter((i) => i.category === filter)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '44px 26px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 19, fontWeight: 700 }}>Insights</span>
            {unread > 0 && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 10,
                  background: 'var(--purple-primary)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {unread}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', marginTop: 2 }}>
            Omi watches your screen and surfaces what matters, memories and tasks are filed automatically
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {settings.proactiveEnabled && (
            <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => void store.runNow()}>
              {store.status?.running ? 'Analyzing…' : 'Analyze now'}
            </button>
          )}
          <button
            className={`btn-primary`}
            style={{ fontSize: 12, padding: '8px 14px' }}
            onClick={() => void update({ proactiveEnabled: !settings.proactiveEnabled })}
          >
            {settings.proactiveEnabled ? 'On' : 'Turn on'}
          </button>
        </div>
      </div>

      {!settings.proactiveEnabled ? (
        <div className="section" style={{ padding: 20, lineHeight: 1.6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Proactive assistant is off</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            When on, Omi periodically reads your recent screen activity (using the same on-device capture as Rewind)
            and extracts durable memories, action items, and the occasional useful nudge. Memories and tasks sync to
            your account; nudges show up here and in the floating bar. Nothing is uploaded except the short text sent
            to the model for analysis.
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => void update({ proactiveEnabled: true, rewindEnabled: true })}
          >
            Enable proactive assistant
          </button>
        </div>
      ) : store.insights.length === 0 ? (
        <EmptyState
          title="No insights yet"
          subtitle="Omi analyzes your screen every few minutes. As soon as something useful surfaces, it'll appear here."
        />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((i) => (
            <div key={i.id} className="card" style={{ padding: 14, display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 4,
                  borderRadius: 2,
                  background: CATEGORY_COLOR[i.category] || 'var(--purple-primary)',
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{i.title}</span>
                  {i.read === 0 && (
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--purple-primary)' }} />
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                    {i.sourceApp ? `${i.sourceApp} · ` : ''}
                    {timeAgo(new Date(i.ts).toISOString())}
                  </span>
                  <button
                    onClick={() => void store.remove(i.id)}
                    title="Dismiss"
                    style={{ color: 'var(--text-quaternary)', padding: 2 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-quaternary)')}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
                <div className="text-selectable" style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
                  {i.body}
                </div>
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  )
}
