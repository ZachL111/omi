import React, { useEffect, useRef, useState } from 'react'
import { IconCamera, IconPlus, IconSend, IconStar, IconTrash } from '../../components/Icons'
import { Markdown, Spinner } from '../../components/ui'
import { timeAgo } from '../../lib/format'
import { useAuth } from '../../stores/auth'
import { useChat } from '../../stores/chat'
import { useChatSessions } from '../../stores/chatSessions'

const SUGGESTIONS = [
  'What should I do today?',
  'What did I just discuss?',
  'What do you see on my screen?',
  'Summarize my recent conversations'
]

export function ChatPage() {
  const chat = useChat()
  const sessions = useChatSessions()
  const auth = useAuth((s) => s.state)
  const [input, setInput] = useState('')
  const [pendingShot, setPendingShot] = useState<string | null>(null)
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    chat.setUserName(auth?.name)
    void sessions.load()
    void chat.loadHistory()
  }, [auth?.name])

  // Switch the chat thread when the selected session changes.
  useEffect(() => {
    if (sessions.currentId && sessions.currentId !== chat.sessionId) {
      void chat.setSession(sessions.currentId)
    }
  }, [sessions.currentId])

  const visibleSessions = sessions.starredOnly ? sessions.sessions.filter((s) => s.starred) : sessions.sessions

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages.length, chat.messages[chat.messages.length - 1]?.text?.length])

  const send = async (text?: string) => {
    const value = text ?? input
    if (!value.trim() && !pendingShot) return
    setInput('')
    const shot = pendingShot
    setPendingShot(null)
    const wantsScreen = /screen|see|looking at|tab|window/i.test(value)
    let imageDataUrl = shot ?? undefined
    let screenContext: string | undefined
    if (!imageDataUrl && wantsScreen) {
      const result = await window.omi.capture.screenshot()
      imageDataUrl = result?.dataUrl
    }
    if (imageDataUrl) {
      screenContext = (await window.omi.rewind.latestOcr(60_000)) ?? undefined
    }
    void chat.send(value, { imageDataUrl, screenContext })
  }

  const attachScreenshot = async () => {
    const result = await window.omi.capture.screenshot()
    if (result) setPendingShot(result.dataUrl)
  }

  const newChat = async () => {
    const id = await sessions.create()
    if (id) void chat.setSession(id)
    else chat.clear()
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sessions sidebar (ChatSessionsSidebar.swift) */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '44px 12px 8px' }}>
          <button className="btn-primary" style={{ width: '100%', fontSize: 12.5 }} onClick={() => void newChat()}>
            <IconPlus size={13} /> New chat
          </button>
          <button
            className={`chip ${sessions.starredOnly ? 'active' : ''}`}
            style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
            onClick={() => sessions.setStarredOnly(!sessions.starredOnly)}
          >
            <IconStar size={12} filled={sessions.starredOnly} /> Starred
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 10px' }}>
          {visibleSessions.map((s) => {
            const selected = sessions.currentId === s.id
            return (
              <div
                key={s.id}
                onClick={() => sessions.select(s.id)}
                style={{
                  padding: '8px 9px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: selected ? 'var(--bg-tertiary)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 2
                }}
                onMouseEnter={(e) => {
                  setHoveredSession(s.id)
                  if (!selected) e.currentTarget.style.background = 'rgba(37,37,37,0.6)'
                }}
                onMouseLeave={(e) => {
                  setHoveredSession((cur) => (cur === s.id ? null : cur))
                  if (!selected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title || 'New Chat'}
                </span>
                {(s.starred || hoveredSession === s.id) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void sessions.toggleStar(s.id)
                    }}
                    style={{ color: s.starred ? 'var(--warning)' : 'var(--text-quaternary)', padding: 1 }}
                    title="Star"
                  >
                    <IconStar size={12} filled={s.starred} />
                  </button>
                )}
                {hoveredSession === s.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void sessions.remove(s.id)
                    }}
                    style={{ color: 'var(--text-quaternary)', padding: 1 }}
                    title="Delete"
                  >
                    <IconTrash size={12} />
                  </button>
                )}
              </div>
            )
          })}
          {visibleSessions.length === 0 && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-quaternary)', textAlign: 'center' }}>
              {sessions.starredOnly ? 'No starred chats' : 'No chats yet'}
            </div>
          )}
        </div>
      </div>

      {/* Chat thread */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minWidth: 0 }}>
        <div
          style={{
            padding: '44px 24px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <span style={{ fontSize: 19, fontWeight: 700 }}>
            {sessions.sessions.find((s) => s.id === sessions.currentId)?.title || 'Chat'}
          </span>
          <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => void newChat()}>
            New chat
          </button>
        </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
        {chat.messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-tertiary)' }}>
              Ask Omi anything, it knows your context
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760, margin: '0 auto' }}>
            {chat.messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                {m.imageDataUrl && (
                  <img
                    src={m.imageDataUrl}
                    style={{ maxWidth: 260, borderRadius: 12, marginBottom: 6, border: '1px solid var(--border)' }}
                    alt="screenshot context"
                  />
                )}
                {m.role === 'user' ? (
                  <div
                    style={{
                      background: 'var(--user-bubble)',
                      borderRadius: 'var(--radius-bubble)',
                      padding: '10px 14px',
                      fontSize: 14,
                      lineHeight: 1.5
                    }}
                    className="text-selectable"
                  >
                    {m.text}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: m.error ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    {m.text ? <Markdown>{m.text}</Markdown> : m.streaming ? <Spinner size={14} /> : null}
                    {m.streaming && m.text && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 7,
                          height: 14,
                          background: 'var(--purple-primary)',
                          marginLeft: 3,
                          verticalAlign: 'middle',
                          animation: 'pulse 1s ease-in-out infinite'
                        }}
                      />
                    )}
                    {!m.streaming && m.text && !m.error && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button
                          onClick={() => void chat.rate(m.id, 1)}
                          title="Good response"
                          style={{ fontSize: 12, color: m.rating === 1 ? 'var(--success)' : 'var(--text-quaternary)', padding: '2px 4px' }}
                        >
                          👍
                        </button>
                        <button
                          onClick={() => void chat.rate(m.id, -1)}
                          title="Bad response"
                          style={{ fontSize: 12, color: m.rating === -1 ? 'var(--error)' : 'var(--text-quaternary)', padding: '2px 4px' }}
                        >
                          👎
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div style={{ padding: '12px 24px 20px' }}>
        {pendingShot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <img src={pendingShot} style={{ height: 44, borderRadius: 8, border: '1px solid var(--border)' }} alt="" />
            <button style={{ fontSize: 11, color: 'var(--text-quaternary)' }} onClick={() => setPendingShot(null)}>
              Remove screenshot
            </button>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-control)',
            padding: '8px 10px',
            maxWidth: 760,
            margin: '0 auto'
          }}
        >
          <button
            onClick={() => void attachScreenshot()}
            title="Attach screenshot"
            style={{ color: 'var(--text-quaternary)', padding: '6px 4px' }}
          >
            <IconCamera size={17} />
          </button>
          <textarea
            ref={taRef}
            value={input}
            placeholder="Message Omi…"
            rows={1}
            onChange={(e) => {
              setInput(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = Math.min(140, e.currentTarget.scrollHeight) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              resize: 'none',
              fontSize: 14,
              lineHeight: 1.45,
              maxHeight: 140,
              padding: '6px 2px'
            }}
          />
          {chat.streaming ? (
            <button className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12 }} onClick={chat.stop}>
              Stop
            </button>
          ) : (
            <button
              className="btn-primary"
              style={{ padding: '8px 12px', borderRadius: 12 }}
              onClick={() => void send()}
              disabled={!input.trim() && !pendingShot}
              title="Send"
            >
              <IconSend size={14} />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
