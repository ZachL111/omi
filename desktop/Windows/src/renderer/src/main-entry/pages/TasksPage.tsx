import React, { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconTrash } from '../../components/Icons'
import { EmptyState, Spinner } from '../../components/ui'
import { useTasks } from '../../stores/tasks'
import type { TaskActionItem } from '../../api/types'

export function TasksPage() {
  const store = useTasks()
  const [draft, setDraft] = useState('')
  const [draftDue, setDraftDue] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  const addDraft = () => {
    if (!draft.trim()) return
    void store.add(draft, draftDue ? new Date(draftDue).toISOString() : undefined)
    setDraft('')
    setDraftDue('')
  }

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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={draft}
          placeholder="Add a task…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addDraft()
          }}
          style={{ flex: 1 }}
        />
        <input
          type="date"
          value={draftDue}
          onChange={(e) => setDraftDue(e.target.value)}
          title="Due date"
          style={{ width: 140, colorScheme: 'dark' }}
        />
        <button className="btn-primary" disabled={!draft.trim()} onClick={addDraft}>
          <IconPlus size={14} /> Add
        </button>
      </div>

      {/* Staged (AI-proposed) tasks */}
      {store.staged.length > 0 && (
        <div className="section" style={{ padding: 12, marginBottom: 18, borderColor: 'rgba(139,92,246,0.35)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--purple-secondary)', marginBottom: 8 }}>
            Omi suggests · {store.staged.length}
          </div>
          {store.staged.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{s.description}</span>
              <button
                onClick={() => void store.acceptStaged(s.id)}
                style={{ fontSize: 12, color: 'var(--success)', padding: '3px 9px', background: 'rgba(16,185,129,0.12)', borderRadius: 8 }}
              >
                Add
              </button>
              <button
                onClick={() => void store.dismissStaged(s.id)}
                style={{ fontSize: 12, color: 'var(--text-quaternary)', padding: '3px 9px' }}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

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
            fontSize: 13,
            fontWeight: 600,
            color: accent || 'var(--text-tertiary)',
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
            tabIndex={completed ? undefined : 0}
            onKeyDown={(e) => {
              if (completed) return
              if (e.key === 'Tab') {
                e.preventDefault()
                void store.setIndent(t.id, (t.indent_level ?? 0) + (e.shiftKey ? -1 : 1))
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 14px',
              paddingLeft: 14 + (t.indent_level ?? 0) * 26,
              borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none',
              outline: 'none'
            }}
          >
            {(t.indent_level ?? 0) > 0 && (
              <span style={{ width: 2, alignSelf: 'stretch', background: 'var(--border-strong)', borderRadius: 1, marginRight: 2 }} />
            )}
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
