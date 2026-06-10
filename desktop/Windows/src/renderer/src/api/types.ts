// Server models, field-for-field with APIClient.swift's Codable types (snake_case JSON).

export interface ActionItem {
  description: string
  completed?: boolean
}

export interface StructuredSummary {
  title?: string
  overview?: string
  emoji?: string
  category?: string
  action_items?: ActionItem[]
}

export interface ServerTranscriptSegment {
  id?: string
  text: string
  speaker?: string
  speaker_id?: number
  is_user?: boolean
  person_id?: string | null
  start?: number
  end?: number
}

export interface ServerConversation {
  id: string
  created_at: string
  started_at?: string
  finished_at?: string
  structured?: StructuredSummary
  transcript_segments?: ServerTranscriptSegment[]
  source?: string
  language?: string
  status?: string
  discarded?: boolean
  starred?: boolean
  folder_id?: string | null
}

export interface ServerMemory {
  id: string
  content: string
  category?: string
  created_at?: string
  updated_at?: string
  conversation_id?: string
  visibility?: string
  manually_added?: boolean
  source?: string
  is_read?: boolean
  is_dismissed?: boolean
  tags?: string[]
  headline?: string
  reasoning?: string
}

export interface TaskActionItem {
  id: string
  description: string
  completed: boolean
  deleted?: boolean
  due_at?: string | null
  priority?: string | null
  category?: string | null
  source?: string | null
  created_at?: string
  updated_at?: string
  conversation_id?: string
  sort_order?: number
  indent_level?: number
}

export interface Goal {
  id: string
  title: string
  description?: string
  goal_type?: 'boolean' | 'numeric'
  target_value?: number
  current_value?: number
  unit?: string
}

export interface ChatSession {
  id: string
  title?: string
  app_id?: string | null
  created_at?: string
  starred?: boolean
}

export interface ServerChatMessage {
  id: string
  text: string
  created_at: string
  sender: 'ai' | 'human' | string
  type?: string
  session_id?: string
}

export interface UserProfile {
  name?: string
  motivation?: string
  use_case?: string
  job?: string
  company?: string
}
