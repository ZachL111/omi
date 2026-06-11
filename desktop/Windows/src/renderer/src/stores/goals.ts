import { create } from 'zustand'
import { api } from '../api/client'
import type { Goal } from '../api/types'

interface GoalsStore {
  goals: Goal[]
  loading: boolean
  load: () => Promise<void>
  create: (g: { title: string; goalType: 'boolean' | 'numeric'; current: number; target: number; unit?: string }) => Promise<void>
  setProgress: (id: string, value: number) => Promise<void>
  update: (id: string, patch: Partial<Goal>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useGoals = create<GoalsStore>((set, get) => ({
  goals: [],
  loading: false,
  load: async () => {
    set({ loading: true })
    try {
      set({ goals: await api.listGoals(), loading: false })
    } catch {
      set({ loading: false })
    }
  },
  create: async (g) => {
    const created = await api.createGoal({
      title: g.title,
      goal_type: g.goalType,
      current_value: g.current,
      target_value: g.target,
      min_value: 0,
      max_value: g.goalType === 'boolean' ? 1 : Math.max(g.target, 1),
      unit: g.unit
    })
    set({ goals: [...get().goals, created] })
  },
  setProgress: async (id, value) => {
    set({ goals: get().goals.map((x) => (x.id === id ? { ...x, current_value: value } : x)) })
    try {
      await api.setGoalProgress(id, value)
    } catch {
      await get().load()
    }
  },
  update: async (id, patch) => {
    await api.updateGoal(id, patch)
    await get().load()
  },
  remove: async (id) => {
    set({ goals: get().goals.filter((x) => x.id !== id) })
    try {
      await api.deleteGoal(id)
    } catch {
      await get().load()
    }
  }
}))

// Emoji auto-mapping, ported from GoalsWidget.swift's keyword map.
const EMOJI_MAP: [RegExp, string][] = [
  [/revenue|money|income|profit|sales|\$/i, '💰'],
  [/users|growth|subscriber|follower/i, '🚀'],
  [/startup|launch|business|company/i, '🏆'],
  [/invest|stock|crypto/i, '📈'],
  [/workout|gym|exercise/i, '💪'],
  [/run|marathon|steps|walk/i, '🏃'],
  [/weight|diet/i, '⚖️'],
  [/meditat|yoga|mindful/i, '🧘'],
  [/sleep|rest/i, '😴'],
  [/water|hydration/i, '💧'],
  [/read|book|pages/i, '📚'],
  [/learn|study|course/i, '🎓'],
  [/code|programming/i, '💻'],
  [/language/i, '🗣️'],
  [/writ|blog|content/i, '✍️'],
  [/video|youtube/i, '🎬'],
  [/music/i, '🎵'],
  [/art|design/i, '🎨'],
  [/photo/i, '📸'],
  [/task|todo/i, '✅'],
  [/habit|streak/i, '🔥'],
  [/time|focus/i, '⏰'],
  [/travel|trip/i, '✈️'],
  [/home|house/i, '🏠'],
  [/saving|budget/i, '🏦'],
  [/family/i, '👨‍👩‍👧'],
  [/relationship/i, '💕']
]

export function goalEmoji(title: string): string {
  for (const [re, emoji] of EMOJI_MAP) if (re.test(title)) return emoji
  return '🎯'
}

export function goalProgress(g: Goal): number {
  const min = g.min_value ?? 0
  const target = g.target_value ?? 1
  const cur = g.current_value ?? 0
  if (target === min) return cur > 0 ? 100 : 0
  return Math.max(0, Math.min(100, ((cur - min) / (target - min)) * 100))
}

export function progressColor(pct: number): string {
  if (pct >= 80) return '#22C55E'
  if (pct >= 60) return '#84CC16'
  if (pct >= 40) return '#FBBF24'
  if (pct >= 20) return '#F97316'
  return 'var(--text-tertiary)'
}
