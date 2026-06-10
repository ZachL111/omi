import React, { useEffect, useRef, useState } from 'react'
import { IconCamera, IconSend } from '../../components/Icons'
import { Markdown, Spinner } from '../../components/ui'
import { useAuth } from '../../stores/auth'
import { useChat } from '../../stores/chat'

const SUGGESTIONS = [
  'What should I do today?',
  'What did I just discuss?',
  'What do you see on my screen?',
  'Summarize my recent conversations'
]

export function ChatPage() {
  const chat = useChat()
  const auth = useAuth((s) => s.state)
  const [input, setInput] = useState('')
  const [pendingShot, setPendingShot] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    chat.setUserName(auth?.name)
    void chat.loadHistory()
  }, [auth?.name])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '44px 24px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <span style={{ fontSize: 19, fontWeight: 700 }}>Chat</span>
        <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => chat.clear()}>
          New chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
        {chat.messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-tertiary)' }}>
              Ask Omi anything — it knows your context
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
  )
}
