import { create } from 'zustand'
import { api } from '../api/client'
import type { TaskActionItem } from '../api/types'

interface TasksStore {
  incomplete: TaskActionItem[]
  completed: TaskActionItem[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  add: (description: string, dueAt?: string) => Promise<void>
  toggle: (task: TaskActionItem) => Promise<void>
  remove: (id: string) => Promise<void>
  update: (id: string, patch: Record<string, unknown>) => Promise<void>
}

function asItems(res: { items: TaskActionItem[] } | TaskActionItem[]): TaskActionItem[] {
  return Array.isArray(res) ? res : (res.items ?? [])
}

export const useTasks = create<TasksStore>((set, get) => ({
  incomplete: [],
  completed: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const [inc, comp] = await Promise.all([api.listActionItems(false, 200), api.listActionItems(true, 50)])
      set({ incomplete: asItems(inc), completed: asItems(comp), loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
  add: async (description, dueAt) => {
    const trimmed = description.trim()
    if (!trimmed) return
    const created = await api.createActionItem(trimmed, dueAt)
    set({ incomplete: [created, ...get().incomplete] })
  },
  toggle: async (task) => {
    const completed = !task.completed
    if (completed) {
      set({
        incomplete: get().incomplete.filter((t) => t.id !== task.id),
        completed: [{ ...task, completed: true }, ...get().completed]
      })
    } else {
      set({
        completed: get().completed.filter((t) => t.id !== task.id),
        incomplete: [{ ...task, completed: false }, ...get().incomplete]
      })
    }
    try {
      await api.updateActionItem(task.id, { completed })
    } catch {
      await get().load()
    }
  },
  remove: async (id) => {
    set({
      incomplete: get().incomplete.filter((t) => t.id !== id),
      completed: get().completed.filter((t) => t.id !== id)
    })
    try {
      await api.deleteActionItem(id)
    } catch {
      await get().load()
    }
  },
  update: async (id, patch) => {
    await api.updateActionItem(id, patch)
    await get().load()
  }
}))
