import React, { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconTrash } from '../../components/Icons'
import { EmptyState, Spinner } from '../../components/ui'
import { useTasks } from '../../stores/tasks'
import type { TaskActionItem } from '../../api/types'

export function TasksPage() {
  const store = useTasks()
  const [draft, setDraft] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    void store.load()
  }, [])

  const groups = useMemo(() => {
    const now = new Date()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const overdue: TaskActionItem[] = []
    const today: TaskActionItem[] = []
    const upcoming: TaskActionItem[] = []
    const someday: TaskActionItem[] = []
    for (const t of store.incomplete) {
      if (!t.due_at) someday.push(t)
      else {
        const due = new Date(t.due_at)
        if (due < now) overdue.push(t)
        else if (due < todayEnd) today.push(t)
        else upcoming.push(t)
      }
    }
    return { overdue, today, upcoming, someday }
  }, [store.incomplete])

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '44px 26px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>Tasks</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', marginTop: 2 }}>
            {store.incomplete.length} open · extracted from your conversations and screen, or added here
          </div>
        </div>
        {store.loading && <Spinner size={15} />}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={draft}
          placeholder="Add a task…"
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
          disabled={!draft.trim()}
          onClick={() => {
            if (draft.trim()) {
              void store.add(draft)
              setDraft('')
            }
          }}
        >
          <IconPlus size={14} /> Add
        </button>
      </div>

      {store.incomplete.length === 0 && !store.loading && (
        <EmptyState title="All clear" subtitle="New tasks from conversations and Ask Omi land here." />
      )}

      <TaskGroup title="Overdue" tasks={groups.overdue} accent="var(--error)" />
      <TaskGroup title="Today" tasks={groups.today} accent="var(--purple-secondary)" />
      <TaskGroup title="Upcoming" tasks={groups.upcoming} />
      <TaskGroup title="No due date" tasks={groups.someday} />

      <button
        onClick={() => setShowCompleted((v) => !v)}
        style={{ fontSize: 12.5, color: 'var(--text-quaternary)', margin: '10px 0' }}
      >
        {showCompleted ? '▾' : '▸'} Completed ({store.completed.length})
      </button>
      {showCompleted && <TaskGroup title="" tasks={store.completed} completed />}
    </div>
  )
}

function TaskGroup({
  title,
  tasks,
  accent,
  completed
}: {
  title: string
  tasks: TaskActionItem[]
  accent?: string
  completed?: boolean
}) {
  const store = useTasks()
  if (tasks.length === 0) return null
  return (
    <div style={{ marginBottom: 18 }}>
      {title && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: accent || 'var(--text-quaternary)',
            marginBottom: 7
          }}
        >
          {title} · {tasks.length}
        </div>
      )}
      <div className="section" style={{ overflow: 'hidden' }}>
        {tasks.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 14px',
              borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none'
            }}
          >
            <button
              onClick={() => void store.toggle(t)}
              title={completed ? 'Reopen' : 'Complete'}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                flexShrink: 0,
                border: completed ? 'none' : '1.6px solid var(--text-quaternary)',
                background: completed ? 'var(--success)' : 'transparent',
                color: '#fff',
                fontSize: 11,
                lineHeight: '18px'
              }}
            >
              {completed ? '✓' : ''}
            </button>
            <span
              className="text-selectable"
              style={{
                flex: 1,
                fontSize: 13.5,
                color: completed ? 'var(--text-quaternary)' : 'var(--text-secondary)',
                textDecoration: completed ? 'line-through' : 'none',
                minWidth: 0
              }}
            >
              {t.description}
            </span>
            {t.due_at && !completed && (
              <span style={{ fontSize: 11.5, color: 'var(--text-quaternary)', flexShrink: 0 }}>
                {new Date(t.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
            <button
              onClick={() => void store.remove(t.id)}
              title="Delete"
              style={{ color: 'var(--text-quaternary)', padding: 2, flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-quaternary)')}
            >
              <IconTrash size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
