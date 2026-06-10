import { create } from 'zustand'
import { api } from '../api/client'
import type { ServerMemory } from '../api/types'

// Filter set mirrors the Mac memories page (v0.11.438): Manual, About You, Insights, Workflow.
export type MemoryFilter = 'all' | 'manual' | 'system' | 'interesting' | 'workflow'

interface MemoriesStore {
  items: ServerMemory[]
  loading: boolean
  filter: MemoryFilter
  error: string | null
  load: () => Promise<void>
  setFilter: (f: MemoryFilter) => void
  add: (content: string) => Promise<void>
  edit: (id: string, content: string) => Promise<void>
  remove: (id: string) => Promise<void>
  filtered: () => ServerMemory[]
}

export const useMemories = create<MemoriesStore>((set, get) => ({
  items: [],
  loading: false,
  filter: 'all',
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const items = await api.listMemories(200, 0)
      set({ items, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
  setFilter: (f) => set({ filter: f }),
  add: async (content) => {
    const trimmed = content.trim()
    if (!trimmed) return
    await api.createMemory(trimmed)
    await get().load()
  },
  edit: async (id, content) => {
    set({ items: get().items.map((m) => (m.id === id ? { ...m, content } : m)) })
    await api.editMemory(id, content)
  },
  remove: async (id) => {
    set({ items: get().items.filter((m) => m.id !== id) })
    try {
      await api.deleteMemory(id)
    } catch {
      await get().load()
    }
  },
  filtered: () => {
    const { items, filter } = get()
    if (filter === 'all') return items
    return items.filter((m) => (m.category ?? 'system') === filter)
  }
}))
