import React, { useEffect, useRef, useState } from 'react'
import { IconExternal, IconMic, IconSearch, IconStar, IconStop, IconTrash } from '../../components/Icons'
import { EmptyState, Spinner, Toggle } from '../../components/ui'
import { api } from '../../api/client'
import { clockTime, segmentClock, speakerColor, timeAgo } from '../../lib/format'
import { speakerName, setSpeakerName } from '../../lib/speakers'
import { useConversations, useLive } from '../../stores/conversations'
import { useFolders } from '../../stores/folders'

export function ConversationsPage() {
  const store = useConversations()
  const live = useLive()
  const folders = useFolders()
  const [query, setQuery] = useState('')
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSel, setMergeSel] = useState<string[]>([])
  const searchTimer = useRef<number | null>(null)

  useEffect(() => {
    void store.load()
    void folders.load()
  }, [])

  const visibleItems = folders.activeFolderId
    ? store.items.filter((c) => c.folder_id === folders.activeFolderId)
    : store.items

  const toggleMergeSel = (id: string) =>
    setMergeSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const doMerge = async () => {
    if (mergeSel.length < 2) return
    try {
      await api.mergeConversations(mergeSel)
    } catch {
      // ignore
    }
    setMergeMode(false)
    setMergeSel([])
    await store.load()
  }

  const onSearch = (q: string) => {
    setQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => void store.search(q), 350)
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* List pane */}
      <div
        style={{
          width: 330,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}
      >
        <div style={{ padding: '44px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>Conversations</span>
            {store.loading && <Spinner size={14} />}
          </div>

          {/* Record control */}
          <div className="section" style={{ padding: 12, marginBottom: 10 }}>
            {live.status === 'idle' ? (
              <>
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => void live.start()}
                >
                  <IconMic size={15} /> Start Recording
                </button>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    fontSize: 12,
                    color: 'var(--text-quaternary)'
                  }}
                >
                  <span>Capture system audio (meetings)</span>
                  <Toggle on={live.systemAudio} onChange={live.setSystemAudio} />
                </div>
                {live.statusDetail && (
                  <div style={{ fontSize: 11.5, color: 'var(--warning)', marginTop: 8 }}>{live.statusDetail}</div>
                )}
              </>
            ) : (
              <>
                <button
                  className="btn-secondary"
                  style={{ width: '100%', borderColor: 'rgba(239,68,68,0.5)', color: 'var(--error)' }}
                  onClick={() => void live.stop()}
                  disabled={live.status === 'stopping'}
                >
                  {live.status === 'stopping' ? (
                    <>
                      <Spinner size={13} /> Saving conversation…
                    </>
                  ) : (
                    <>
                      <IconStop size={14} />
                      {live.status === 'connecting' ? 'Connecting…' : 'Stop Recording'}
                    </>
                  )}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: live.status === 'recording' ? 'var(--error)' : 'var(--warning)',
                      animation: 'pulse 1.4s ease-in-out infinite'
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--text-quaternary)' }}>
                    {live.status === 'recording'
                      ? `Listening, ${live.segments.length} segment${live.segments.length === 1 ? '' : 's'}`
                      : 'Connecting to transcription…'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 9, color: 'var(--text-quaternary)' }}>
              <IconSearch size={14} />
            </span>
            <input
              placeholder="Search conversations"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 34, borderRadius: 18, background: 'var(--bg-secondary)' }}
            />
          </div>

          {/* Folders + merge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className={`chip ${folders.activeFolderId === null ? 'active' : ''}`}
              style={{ fontSize: 11.5, padding: '3px 10px' }}
              onClick={() => folders.setActive(null)}
            >
              All
            </button>
            {folders.folders.map((f) => (
              <button
                key={f.id}
                className={`chip ${folders.activeFolderId === f.id ? 'active' : ''}`}
                style={{ fontSize: 11.5, padding: '3px 10px' }}
                onClick={() => folders.setActive(f.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (window.confirm(`Delete folder "${f.name}"?`)) void folders.remove(f.id)
                }}
              >
                {f.name}
              </button>
            ))}
            <button
              className="chip"
              style={{ fontSize: 11.5, padding: '3px 9px' }}
              title="New folder"
              onClick={() => {
                const n = window.prompt('New folder name')
                if (n) void folders.create(n)
              }}
            >
              +
            </button>
            <span style={{ flex: 1 }} />
            <button
              className={`chip ${mergeMode ? 'active' : ''}`}
              style={{ fontSize: 11.5, padding: '3px 10px' }}
              onClick={() => {
                setMergeMode((v) => !v)
                setMergeSel([])
              }}
            >
              {mergeMode ? `Merge (${mergeSel.length})` : 'Merge'}
            </button>
          </div>
          {mergeMode && mergeSel.length >= 2 && (
            <button className="btn-primary" style={{ width: '100%', marginTop: 8, fontSize: 12.5 }} onClick={() => void doMerge()}>
              Merge {mergeSel.length} conversations
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 10px' }}>
          {live.status !== 'idle' && live.segments.length > 0 && (
            <button
              onClick={() => store.select(null)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 10px',
                borderRadius: 12,
                background: store.selectedId === null ? 'var(--bg-tertiary)' : 'transparent',
                border: '1px dashed rgba(139,92,246,0.4)',
                marginBottom: 6
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple-secondary)' }}>● Live conversation</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-quaternary)', marginTop: 2 }}>
                {live.segments[live.segments.length - 1]?.text.slice(0, 60)}
              </div>
            </button>
          )}
          {visibleItems.map((c) => {
            const selected = mergeMode ? mergeSel.includes(c.id) : store.selectedId === c.id
            return (
              <button
                key={c.id}
                onClick={() => (mergeMode ? toggleMergeSel(c.id) : void store.select(c.id))}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 10px',
                  borderRadius: 12,
                  background: selected ? 'var(--bg-tertiary)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = 'rgba(37,37,37,0.6)'
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {mergeMode && (
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: 4,
                        flexShrink: 0,
                        border: selected ? 'none' : '1.5px solid var(--text-quaternary)',
                        background: selected ? 'var(--purple-primary)' : 'transparent',
                        color: '#fff',
                        fontSize: 10,
                        lineHeight: '15px',
                        textAlign: 'center'
                      }}
                    >
                      {selected ? '✓' : ''}
                    </span>
                  )}
                  <span style={{ fontSize: 15 }}>{c.structured?.emoji || '💬'}</span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c.structured?.title || 'Untitled'}
                  </span>
                  {c.starred && (
                    <span style={{ color: 'var(--warning)' }}>
                      <IconStar size={12} filled />
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-quaternary)', marginTop: 3, paddingLeft: 23 }}>
                  {timeAgo(c.created_at)}
                  {c.structured?.category ? ` · ${c.structured.category}` : ''}
                </div>
              </button>
            )
          })}
          {!store.loading && store.items.length === 0 && (
            <EmptyState title="No conversations yet" subtitle="Hit Start Recording, Omi will transcribe, summarize and remember it." />
          )}
        </div>
      </div>

      {/* Detail pane */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {store.selectedId === null && live.segments.length > 0 ? (
          <LiveDetail />
        ) : store.selected ? (
          <ConversationDetail />
        ) : (
          <EmptyState
            title="Select a conversation"
            subtitle="Transcripts, summaries and action items show up here."
          />
        )}
      </div>
    </div>
  )
}

function LiveDetail() {
  const live = useLive()
  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [live.segments.length])

  return (
    <div style={{ padding: '46px 26px 26px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Live conversation</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', marginBottom: 18 }}>
        Transcribing in real time, speakers are identified automatically
      </div>
      {live.notes.length > 0 && (
        <div className="section" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--purple-secondary)', marginBottom: 8 }}>
            Live notes
          </div>
          {live.notes.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--purple-secondary)' }}>•</span>
              {n}
            </div>
          ))}
        </div>
      )}
      <TranscriptList segments={live.segments} />
      <div ref={endRef} />
    </div>
  )
}

function ConversationDetail() {
  const store = useConversations()
  const c = store.selected!
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')

  const actionItems = c.structured?.action_items ?? []

  return (
    <div style={{ padding: '46px 26px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 28 }}>{c.structured?.emoji || '💬'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setEditingTitle(false)
                if (title.trim()) void store.rename(c.id, title.trim())
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              style={{ fontSize: 19, fontWeight: 700, width: '100%' }}
            />
          ) : (
            <div
              style={{ fontSize: 21, fontWeight: 700, cursor: 'text' }}
              title="Click to rename"
              onClick={() => {
                setTitle(c.structured?.title || '')
                setEditingTitle(true)
              }}
            >
              {c.structured?.title || 'Untitled conversation'}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', marginTop: 3 }}>
            {new Date(c.created_at).toLocaleString()} · {c.source || 'desktop'}
            {c.structured?.category ? ` · ${c.structured.category}` : ''}
          </div>
        </div>
        <button
          onClick={async () => {
            try {
              await api.setConversationVisibility(c.id, 'public')
              window.alert('Conversation is now shareable (public link enabled on omi.me).')
            } catch {
              window.alert('Could not update sharing.')
            }
          }}
          title="Share (make public)"
          style={{ color: 'var(--text-quaternary)', padding: 6 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--purple-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-quaternary)')}
        >
          <IconExternal size={15} />
        </button>
        <button
          onClick={() => void store.toggleStar(c.id)}
          title={c.starred ? 'Unstar' : 'Star'}
          style={{ color: c.starred ? 'var(--warning)' : 'var(--text-quaternary)', padding: 6 }}
        >
          <IconStar size={16} filled={c.starred} />
        </button>
        <button
          onClick={() => void store.remove(c.id)}
          title="Delete"
          style={{ color: 'var(--text-quaternary)', padding: 6 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-quaternary)')}
        >
          <IconTrash size={16} />
        </button>
      </div>

      {c.structured?.overview && (
        <div className="section" style={{ padding: 16, margin: '18px 0', fontSize: 13.5, lineHeight: 1.6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 6 }}>
            OVERVIEW
          </div>
          <span className="text-selectable" style={{ color: 'var(--text-secondary)' }}>
            {c.structured.overview}
          </span>
        </div>
      )}

      {actionItems.length > 0 && (
        <div className="section" style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-quaternary)', marginBottom: 8 }}>
            ACTION ITEMS
          </div>
          {actionItems.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, padding: '5px 0', alignItems: 'flex-start' }}>
              <span style={{ color: a.completed ? 'var(--success)' : 'var(--text-quaternary)', marginTop: 1 }}>
                {a.completed ? '✓' : '○'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.description}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-quaternary)', margin: '16px 0 10px' }}>
        TRANSCRIPT
      </div>
      <TranscriptList segments={c.transcript_segments ?? []} />
      {(c.transcript_segments ?? []).length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-quaternary)' }}>No transcript stored.</div>
      )}
    </div>
  )
}

function TranscriptList({
  segments
}: {
  segments: { id?: string; text: string; speaker?: string; speaker_id?: number; is_user?: boolean; start?: number }[]
}) {
  const [, force] = useState(0)
  const renameSpeaker = (speakerId: number | undefined) => {
    if (speakerId === undefined) return
    const current = speakerName(speakerId) ?? ''
    const name = window.prompt('Name this speaker', current)
    if (name !== null) {
      setSpeakerName(speakerId, name)
      force((n) => n + 1)
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {segments.map((s, i) => {
        const named = speakerName(s.speaker_id)
        const label = s.is_user ? 'You' : named || s.speaker || `Speaker ${(s.speaker_id ?? 0) + 1}`
        return (
          <div
            key={s.id ?? i}
            style={{
              alignSelf: s.is_user ? 'flex-end' : 'flex-start',
              maxWidth: '78%',
              background: speakerColor(s.speaker_id, s.is_user),
              borderRadius: 'var(--radius-bubble)',
              padding: '10px 14px'
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
              <span
                onClick={() => !s.is_user && renameSpeaker(s.speaker_id)}
                title={s.is_user ? undefined : 'Click to name this speaker'}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.85)',
                  cursor: s.is_user ? 'default' : 'pointer'
                }}
              >
                {label}
                {!s.is_user && !named && <span style={{ opacity: 0.5 }}> ✎</span>}
              </span>
              {s.start !== undefined && (
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>{segmentClock(s.start)}</span>
              )}
            </div>
            <div className="text-selectable" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {s.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}
