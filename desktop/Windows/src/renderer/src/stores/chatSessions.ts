import { create } from 'zustand'
import { api } from '../api/client'
import type { ChatSession } from '../api/types'

interface ChatSessionsStore {
  sessions: ChatSession[]
  currentId: string | null
  loading: boolean
  starredOnly: boolean
  load: () => Promise<void>
  select: (id: string | null) => void
  create: () => Promise<string | null>
  remove: (id: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
  setStarredOnly: (v: boolean) => void
}

export const useChatSessions = create<ChatSessionsStore>((set, get) => ({
  sessions: [],
  currentId: null,
  loading: false,
  starredOnly: false,
  load: async () => {
    set({ loading: true })
    try {
      const sessions = await api.listChatSessions(50)
      set({ sessions, loading: false })
      if (!get().currentId && sessions.length > 0) set({ currentId: sessions[0].id })
    } catch {
      set({ loading: false })
    }
  },
  select: (id) => set({ currentId: id }),
  create: async () => {
    try {
      const s = await api.createChatSession()
      set({ sessions: [s, ...get().sessions], currentId: s.id })
      return s.id
    } catch {
      return null
    }
  },
  remove: async (id) => {
    const next = get().sessions.filter((s) => s.id !== id)
    set({ sessions: next, currentId: get().currentId === id ? (next[0]?.id ?? null) : get().currentId })
    try {
      await api.deleteChatSession(id)
    } catch {
      await get().load()
    }
  },
  toggleStar: async (id) => {
    const s = get().sessions.find((x) => x.id === id)
    if (!s) return
    const starred = !s.starred
    set({ sessions: get().sessions.map((x) => (x.id === id ? { ...x, starred } : x)) })
    try {
      await api.patchChatSession(id, { starred })
    } catch {
      await get().load()
    }
  },
  rename: async (id, title) => {
    set({ sessions: get().sessions.map((x) => (x.id === id ? { ...x, title } : x)) })
    await api.patchChatSession(id, { title })
  },
  setStarredOnly: (v) => set({ starredOnly: v })
}))
