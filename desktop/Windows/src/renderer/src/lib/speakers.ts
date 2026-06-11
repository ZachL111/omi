// Speaker naming, the Windows counterpart of LiveNameSpeakerSheet + person
// management. Persisted locally keyed by speaker id; also pushed to the backend
// people list (best-effort) so names survive across devices later.
import { api } from '../api/client'

const KEY = 'omi.speakerNames'

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function write(map: Record<string, string>): void {
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function speakerName(speakerId: number | undefined): string | null {
  if (speakerId === undefined || speakerId === null) return null
  return read()[String(speakerId)] ?? null
}

export function setSpeakerName(speakerId: number, name: string): void {
  const map = read()
  const trimmed = name.trim()
  if (trimmed) map[String(speakerId)] = trimmed
  else delete map[String(speakerId)]
  write(map)
  if (trimmed) void api.createPerson(trimmed).catch(() => {})
}
