import type {
  ChatSession,
  Goal,
  ServerChatMessage,
  ServerConversation,
  ServerMemory,
  TaskActionItem,
  UserProfile
} from './types'

// Thin typed wrappers over the main-process API proxy, one per endpoint the Mac
// app's APIClient.swift exposes (Python backend unless noted).

class ApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`API ${status}: ${body.slice(0, 300)}`)
  }
}

async function py<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await window.omi.api.request({
    method,
    url,
    base: 'python',
    body: body === undefined ? null : JSON.stringify(body)
  })
  if (res.status < 200 || res.status >= 300) throw new ApiError(res.status, res.body)
  return (res.body ? JSON.parse(res.body) : null) as T
}

export const api = {
  // Conversations (processing,completed matches the Mac app + backend default, so a
  // just-finished recording shows up while it's still being post-processed)
  listConversations: (limit = 50, offset = 0, statuses = 'processing,completed') =>
    py<ServerConversation[]>(
      'GET',
      `v1/conversations?limit=${limit}&offset=${offset}&statuses=${statuses}&include_discarded=false`
    ),
  getConversation: (id: string) => py<ServerConversation>('GET', `v1/conversations/${id}`),
  deleteConversation: (id: string) => py<void>('DELETE', `v1/conversations/${id}`),
  setConversationStarred: (id: string, starred: boolean) =>
    py<void>('PATCH', `v1/conversations/${id}/starred?starred=${starred}`),
  setConversationTitle: (id: string, title: string) =>
    py<void>('PATCH', `v1/conversations/${id}/title?title=${encodeURIComponent(title)}`),
  searchConversations: (query: string, page = 1, perPage = 20) =>
    py<{ items: ServerConversation[]; current_page: number; total_pages: number }>(
      'POST',
      'v1/conversations/search',
      { query, page, per_page: perPage, include_discarded: false }
    ),
  forceProcessConversation: () => py<{ conversation?: ServerConversation }>('POST', 'v1/conversations', {}),

  // Memories
  listMemories: (limit = 100, offset = 0) => py<ServerMemory[]>('GET', `v3/memories?limit=${limit}&offset=${offset}`),
  createMemory: (content: string) =>
    py<{ id: string }>('POST', 'v3/memories', { content, visibility: 'private', manually_added: true }),
  editMemory: (id: string, value: string) => py<{ status: string }>('PATCH', `v3/memories/${id}`, { value }),
  deleteMemory: (id: string) => py<void>('DELETE', `v3/memories/${id}`),

  // Tasks (action items)
  listActionItems: (completed: boolean, limit = 100, offset = 0) =>
    py<{ items: TaskActionItem[]; has_more: boolean } | TaskActionItem[]>(
      'GET',
      `v1/action-items?limit=${limit}&offset=${offset}&completed=${completed}`
    ),
  createActionItem: (description: string, dueAt?: string) =>
    py<TaskActionItem>('POST', 'v1/action-items', { description, due_at: dueAt ?? null, source: 'manual' }),
  updateActionItem: (id: string, patch: Record<string, unknown>) =>
    py<TaskActionItem>('PATCH', `v1/action-items/${id}`, patch),
  deleteActionItem: (id: string) => py<void>('DELETE', `v1/action-items/${id}`),

  // Goals
  listGoals: () => py<Goal[]>('GET', 'v1/goals/all'),

  // Chat sessions + history (Python backend)
  listChatSessions: (limit = 30) => py<ChatSession[]>('GET', `v2/chat-sessions?limit=${limit}&offset=0`),
  createChatSession: () => py<ChatSession>('POST', 'v2/chat-sessions', {}),
  deleteChatSession: (id: string) => py<void>('DELETE', `v2/chat-sessions/${id}`),
  listSessionMessages: (sessionId: string, limit = 100) =>
    py<ServerChatMessage[]>('GET', `v2/desktop/messages?session_id=${sessionId}&limit=${limit}&offset=0`),
  listMessages: (limit = 100) => py<ServerChatMessage[]>('GET', `v2/desktop/messages?limit=${limit}&offset=0`),

  // Profile
  getProfile: () => py<UserProfile>('GET', 'v1/users/profile'),
  updateProfile: (patch: Partial<UserProfile>) => py<UserProfile>('PATCH', 'v1/users/profile', patch),

  // MCP integration keys
  createMcpKey: (name: string) => py<{ id: string; name: string; key: string }>('POST', 'v1/mcp/keys', { name }),

  // Knowledge graph
  getKnowledgeGraph: () =>
    py<{ nodes: { id: string; label?: string; category?: string }[]; edges: { source: string; target: string }[] }>(
      'GET',
      'v1/knowledge-graph'
    )
}

export { ApiError }
