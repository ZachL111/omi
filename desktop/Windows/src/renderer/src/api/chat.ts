import { CHAT_MODEL } from './model'

// Streaming chat against the Rust desktop backend's /v2/chat/completions, 
// the same OpenAI-compatible Anthropic proxy ChatProvider.swift uses
// (model claude-sonnet-4-6, SSE stream).

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatContentImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export interface ChatContentTextPart {
  type: 'text'
  text: string
}

export interface ChatMessage {
  role: ChatRole
  content: string | (ChatContentTextPart | ChatContentImagePart)[]
}

export interface StreamHandle {
  cancel: () => void
}

export function streamChatCompletion(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (status: number, body: string) => void,
  model: string = CHAT_MODEL
): StreamHandle {
  let buffer = ''
  const cancel = window.omi.api.stream(
    {
      method: 'POST',
      url: 'v2/chat/completions',
      base: 'rust',
      body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 })
    },
    (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content
          if (typeof delta === 'string' && delta) onDelta(delta)
        } catch {
          // partial JSON across chunk boundary is handled by the line buffer
        }
      }
    },
    onDone,
    onError
  )
  return { cancel }
}

/** Non-streaming completion, used for short utility calls (titles, etc.). */
export async function chatCompletion(messages: ChatMessage[], model: string = CHAT_MODEL): Promise<string> {
  const res = await window.omi.api.request({
    method: 'POST',
    url: 'v2/chat/completions',
    base: 'rust',
    body: JSON.stringify({ model, messages, stream: false, max_tokens: 1024 })
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`chat ${res.status}: ${res.body.slice(0, 200)}`)
  const parsed = JSON.parse(res.body)
  return parsed.choices?.[0]?.message?.content ?? ''
}

export function buildSystemPrompt(userName?: string): string {
  const now = new Date().toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
  return (
    `You are Omi, the user's personal AI that remembers their life and helps them get things done. ` +
    `You run inside the Omi desktop app for Windows. Be concise, warm, and direct, answer first, detail after. ` +
    (userName ? `The user's name is ${userName}. ` : '') +
    `Current local time: ${now}. ` +
    `When the user asks about their screen and a screenshot or screen text is attached, ground your answer in it.`
  )
}
