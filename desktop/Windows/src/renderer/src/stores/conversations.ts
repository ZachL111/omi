import { create } from 'zustand'
import { api } from '../api/client'
import type { ServerConversation } from '../api/types'
import type { TranscriptSegment } from '../../../shared/types'
import { PcmCapture } from '../lib/audio'
import { chatCompletion } from '../api/chat'

interface ConversationsStore {
  items: ServerConversation[]
  loading: boolean
  selectedId: string | null
  selected: ServerConversation | null
  searchQuery: string
  error: string | null
  load: () => Promise<void>
  select: (id: string | null) => Promise<void>
  search: (q: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
}

export const useConversations = create<ConversationsStore>((set, get) => ({
  items: [],
  loading: false,
  selectedId: null,
  selected: null,
  searchQuery: '',
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const items = await api.listConversations(50, 0)
      set({ items, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
  select: async (id) => {
    set({ selectedId: id, selected: id ? (get().items.find((c) => c.id === id) ?? null) : null })
    if (!id) return
    try {
      const full = await api.getConversation(id)
      if (get().selectedId === id) set({ selected: full })
    } catch {
      // keep the list version
    }
  },
  search: async (q) => {
    set({ searchQuery: q })
    if (!q.trim()) {
      await get().load()
      return
    }
    set({ loading: true })
    try {
      const res = await api.searchConversations(q)
      set({ items: res.items, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
  toggleStar: async (id) => {
    const conv = get().items.find((c) => c.id === id)
    if (!conv) return
    const starred = !conv.starred
    set({ items: get().items.map((c) => (c.id === id ? { ...c, starred } : c)) })
    try {
      await api.setConversationStarred(id, starred)
    } catch {
      set({ items: get().items.map((c) => (c.id === id ? { ...c, starred: !starred } : c)) })
    }
  },
  remove: async (id) => {
    set({
      items: get().items.filter((c) => c.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
      selected: get().selectedId === id ? null : get().selected
    })
    try {
      await api.deleteConversation(id)
    } catch {
      await get().load()
    }
  },
  rename: async (id, title) => {
    set({
      items: get().items.map((c) => (c.id === id ? { ...c, structured: { ...c.structured, title } } : c)),
      selected:
        get().selected?.id === id
          ? { ...get().selected!, structured: { ...get().selected!.structured, title } }
          : get().selected
    })
    await api.setConversationTitle(id, title)
  }
}))

// ---- Live recording (the Mac app's AudioSourceManager + TranscriptionService loop) ----

export type RecordingStatus = 'idle' | 'connecting' | 'recording' | 'stopping'

interface LiveStore {
  status: RecordingStatus
  segments: TranscriptSegment[]
  notes: string[]
  level: number
  systemAudio: boolean
  statusDetail: string | null
  setSystemAudio: (v: boolean) => void
  start: () => Promise<void>
  stop: () => Promise<void>
}

let capture: PcmCapture | null = null
let unsubEvents: (() => void) | null = null

// Live notes: generate a short note every ~50 new transcript words (LiveNotesMonitor.swift).
let liveNotesCursor = 0
let liveNotesBusy = false
async function maybeGenerateNote(): Promise<void> {
  if (liveNotesBusy) return
  const segs = useLive.getState().segments
  const fullText = segs.map((s) => s.text).join(' ')
  const words = fullText.split(/\s+/).filter(Boolean)
  if (words.length - liveNotesCursor < 50) return
  liveNotesBusy = true
  const excerpt = words.slice(Math.max(0, words.length - 120)).join(' ')
  liveNotesCursor = words.length
  try {
    const existing = useLive.getState().notes.slice(-10).join('; ')
    const note = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You are a concise meeting note-taker. Given a transcript excerpt, output ONE note of 3-10 words capturing the key point. No quotes, no preamble, be specific, avoid repeating existing notes.'
        },
        { role: 'user', content: `Existing notes: ${existing || 'none'}\n\nTranscript:\n${excerpt}` }
      ],
      'claude-haiku-4-5-20251001'
    )
    const clean = note.trim().replace(/^["'-\s]+|["'\s]+$/g, '')
    if (clean) useLive.setState({ notes: [...useLive.getState().notes, clean] })
  } catch {
    // best-effort
  } finally {
    liveNotesBusy = false
  }
}

export const useLive = create<LiveStore>((set, get) => ({
  status: 'idle',
  segments: [],
  notes: [],
  level: 0,
  systemAudio: true,
  statusDetail: null,
  setSystemAudio: (v) => set({ systemAudio: v }),
  start: async () => {
    if (get().status !== 'idle') return
    set({ status: 'connecting', segments: [], notes: [], statusDetail: null })
    liveNotesCursor = 0

    unsubEvents?.()
    unsubEvents = window.omi.transcribe.onEvent('conversation', (event) => {
      if (event.type === 'segments') {
        const merged = [...get().segments]
        const indexById = new Map(merged.map((s, i) => [s.id, i]).filter(([id]) => id !== undefined) as [string, number][])
        for (const seg of event.segments) {
          const idx = seg.id !== undefined ? indexById.get(seg.id) : undefined
          if (idx !== undefined) {
            merged[idx] = seg
          } else {
            if (seg.id !== undefined) indexById.set(seg.id, merged.length)
            merged.push(seg)
          }
        }
        set({ segments: merged })
        void maybeGenerateNote()
      } else if (event.type === 'status') {
        if (event.status === 'connected') set({ status: 'recording' })
        else if (event.status === 'error') set({ statusDetail: event.detail ?? 'connection error' })
        else if (event.status === 'closed' && get().status === 'recording') {
          set({ statusDetail: 'connection closed' })
        }
      }
    })

    const ok = await window.omi.transcribe.start('conversation')
    if (!ok) {
      set({ status: 'idle', statusDetail: 'Sign in to start recording' })
      return
    }

    capture = new PcmCapture()
    try {
      await capture.start({
        systemAudio: get().systemAudio,
        onFrame: (frame) => window.omi.transcribe.sendAudio('conversation', frame),
        onLevel: (rms) => set({ level: rms })
      })
    } catch (e) {
      window.omi.transcribe.stop('conversation')
      set({ status: 'idle', statusDetail: `Microphone unavailable: ${e}` })
      return
    }
  },
  stop: async () => {
    if (get().status === 'idle') return
    set({ status: 'stopping' })
    capture?.stop()
    capture = null
    window.omi.transcribe.stop('conversation')
    unsubEvents?.()
    unsubEvents = null
    try {
      await api.forceProcessConversation()
    } catch {
      // backend will time the conversation out on its own
    }
    set({ status: 'idle', level: 0 })
    await useConversations.getState().load()
  }
}))
