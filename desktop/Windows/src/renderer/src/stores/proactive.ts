import { create } from 'zustand'
import type { Insight, ProactiveStatus } from '../../../shared/types'

interface ProactiveStore {
  insights: Insight[]
  status: ProactiveStatus | null
  init: () => void
  load: () => Promise<void>
  runNow: () => Promise<void>
  markAllRead: () => Promise<void>
  remove: (id: number) => Promise<void>
}

let unsub: (() => void) | null = null

export const useProactive = create<ProactiveStore>((set, get) => ({
  insights: [],
  status: null,
  init: () => {
    void get().load()
    void window.omi.proactive.status().then((status) => set({ status }))
    unsub?.()
    unsub = window.omi.proactive.onStatus((status) => set({ status }))
  },
  load: async () => {
    set({ insights: await window.omi.proactive.list() })
  },
  runNow: async () => {
    await window.omi.proactive.runNow()
    await get().load()
  },
  markAllRead: async () => {
    await window.omi.proactive.markAllRead()
    set({ insights: get().insights.map((i) => ({ ...i, read: 1 })) })
    void window.omi.proactive.status().then((status) => set({ status }))
  },
  remove: async (id) => {
    set({ insights: get().insights.filter((i) => i.id !== id) })
    await window.omi.proactive.remove(id)
  }
}))
