import React, { useEffect, useState } from 'react'
import { IconPlus, IconTrash } from '../../components/Icons'
import { CategoryChip, EmptyState, Spinner } from '../../components/ui'
import { timeAgo } from '../../lib/format'
import { useMemories, type MemoryFilter } from '../../stores/memories'

const FILTERS: { key: MemoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'manual', label: 'Manual' },
  { key: 'system', label: 'About You' },
  { key: 'interesting', label: 'Insights' },
  { key: 'workflow', label: 'Workflow' }
]

export function MemoriesPage() {
  const store = useMemories()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    void store.load()
  }, [])

  const items = store.filtered()

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '44px 26px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>Memories</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', marginTop: 2 }}>
            Everything Omi knows about you — editable, deletable, yours
          </div>
        </div>
        {store.loading && <Spinner size={15} />}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={draft}
          placeholder="Add something Omi should remember…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              void store.add(draft)
              setDraft('')
            }
          }}
          style={{ flex: 1 }}
        />
        <button
          className="btn-primary"
          onClick={() => {
            if (draft.trim()) {
              void store.add(draft)
              setDraft('')
            }
          }}
          disabled={!draft.trim()}
        >
          <IconPlus size={14} /> Add
        </button>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${store.filter === f.key ? 'active' : ''}`}
            onClick={() => store.setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 && !store.loading ? (
        <EmptyState
          title="No memories here yet"
          subtitle="Memories are extracted from conversations and your screen, or added manually."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {items.map((m) => (
            <div key={m.id} className="card" style={{ padding: 14, position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <CategoryChip label={m.category || 'memory'} />
                <span style={{ fontSize: 11, color: 'var(--text-quaternary)', flex: 1 }}>{timeAgo(m.created_at)}</span>
                <button
                  onClick={() => void store.remove(m.id)}
                  title="Delete memory"
                  style={{ color: 'var(--text-quaternary)', padding: 2 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-quaternary)')}
                >
                  <IconTrash size={13} />
                </button>
              </div>
              {editingId === m.id ? (
                <textarea
                  autoFocus
                  value={editText}
                  rows={3}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => {
                    setEditingId(null)
                    if (editText.trim() && editText !== m.content) void store.edit(m.id, editText.trim())
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  style={{ width: '100%', fontSize: 13 }}
                />
              ) : (
                <div
                  className="text-selectable"
                  style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', cursor: 'text' }}
                  title="Click to edit"
                  onClick={() => {
                    setEditingId(m.id)
                    setEditText(m.content)
                  }}
                >
                  {m.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
