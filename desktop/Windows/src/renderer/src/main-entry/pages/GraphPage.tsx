import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { EmptyState, Spinner } from '../../components/ui'
import { useAuth } from '../../stores/auth'
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '../../api/types'

// Knowledge graph, 2D force-directed layout. The Mac app renders this in 3D
// (SceneKit); node-type colors match MemoryGraphPage.swift.
// macOS dark-mode system colors, matching MemoryGraphPage.swift node types.
const TYPE_COLOR: Record<string, string> = {
  person: '#64D2FF', // .cyan
  place: '#00FF9E', // mint Color(0,1,0.62)
  organization: '#FF9F0A', // .orange
  thing: '#BF5AF2', // .purple
  concept: '#0A84FF' // .systemBlue
}

interface Pos {
  x: number
  y: number
  vx: number
  vy: number
}

export function GraphPage() {
  const auth = useAuth((s) => s.state)
  const [nodes, setNodes] = useState<KnowledgeGraphNode[]>([])
  const [edges, setEdges] = useState<KnowledgeGraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [tick, setTick] = useState(0)
  const posRef = useRef<Map<string, Pos>>(new Map())

  const load = async () => {
    setLoading(true)
    try {
      const g = await api.getKnowledgeGraph()
      setNodes(g.nodes ?? [])
      setEdges(g.edges ?? [])
    } catch {
      setNodes([])
      setEdges([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Force-directed layout: seed positions, then relax on a short animation.
  const W = 900
  const H = 560
  useEffect(() => {
    const pos = new Map<string, Pos>()
    const all = [{ id: '__user__', label: auth?.name || 'You' } as KnowledgeGraphNode, ...nodes]
    all.forEach((n, i) => {
      const angle = (i / Math.max(1, all.length)) * Math.PI * 2
      pos.set(n.id, { x: W / 2 + Math.cos(angle) * 200, y: H / 2 + Math.sin(angle) * 160, vx: 0, vy: 0 })
    })
    pos.set('__user__', { x: W / 2, y: H / 2, vx: 0, vy: 0 })
    posRef.current = pos

    let frame = 0
    let raf = 0
    const userEdges: KnowledgeGraphEdge[] = nodes.map((n) => ({ id: 'u' + n.id, source_id: '__user__', target_id: n.id }))
    const allEdges = [...edges, ...userEdges]
    const step = () => {
      const p = posRef.current
      // Repulsion
      const ids = [...p.keys()]
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = p.get(ids[i])!
          const b = p.get(ids[j])!
          let dx = a.x - b.x
          let dy = a.y - b.y
          let d2 = dx * dx + dy * dy
          if (d2 < 0.01) {
            dx = Math.cos(i + j) * 0.5
            dy = Math.sin(i + j) * 0.5
            d2 = 0.25
          }
          const f = 9000 / d2
          const d = Math.sqrt(d2)
          a.vx += (dx / d) * f
          a.vy += (dy / d) * f
          b.vx -= (dx / d) * f
          b.vy -= (dy / d) * f
        }
      }
      // Spring along edges
      for (const e of allEdges) {
        const a = p.get(e.source_id)
        const b = p.get(e.target_id)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const f = (d - 120) * 0.02
        a.vx += (dx / d) * f
        a.vy += (dy / d) * f
        b.vx -= (dx / d) * f
        b.vy -= (dy / d) * f
      }
      for (const [id, n] of p) {
        if (id === '__user__') {
          n.x = W / 2
          n.y = H / 2
          continue
        }
        n.vx *= 0.85
        n.vy *= 0.85
        n.x = Math.max(40, Math.min(W - 40, n.x + n.vx))
        n.y = Math.max(40, Math.min(H - 40, n.y + n.vy))
      }
      setTick((t) => t + 1)
      frame++
      if (frame < 220) raf = requestAnimationFrame(step)
    }
    if (all.length > 1) raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  const rebuild = async () => {
    setRebuilding(true)
    try {
      await api.rebuildKnowledgeGraph()
      // Rebuild runs in the background server-side; poll once after a delay.
      setTimeout(() => void load().then(() => setRebuilding(false)), 6000)
    } catch {
      setRebuilding(false)
    }
  }

  const userPos = posRef.current.get('__user__')
  const renderEdges = useMemo(() => {
    const userEdges = nodes.map((n) => ({ id: 'u' + n.id, source_id: '__user__', target_id: n.id }))
    return [...edges, ...userEdges]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '44px 26px 14px' }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>Memory Graph</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', marginTop: 2 }}>
            People, places, and ideas Omi has connected from your memories
          </div>
        </div>
        <button className="btn-secondary" style={{ fontSize: 12.5 }} onClick={() => void rebuild()} disabled={rebuilding}>
          {rebuilding ? 'Rebuilding…' : 'Rebuild graph'}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '0 20px 20px' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={22} />
          </div>
        ) : nodes.length === 0 ? (
          <EmptyState
            title="Brain map will appear once enough linked memories are available"
            subtitle="Omi maps the people, places and concepts in your life. Try Rebuild graph."
          />
        ) : (
          <div className="card" style={{ height: '100%', overflow: 'hidden', background: '#1A1A1A' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" data-tick={tick}>
              {renderEdges.map((e) => {
                const a = posRef.current.get(e.source_id)
                const b = posRef.current.get(e.target_id)
                if (!a || !b) return null
                return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
              })}
              {userPos && (
                <g>
                  <circle cx={userPos.x} cy={userPos.y} r={30} fill="#fff" />
                  <text x={userPos.x} y={userPos.y + 36} textAnchor="middle" fill="#fff" fontSize={13} fontWeight={600}>
                    {auth?.name || 'You'}
                  </text>
                </g>
              )}
              {nodes.map((n) => {
                const p = posRef.current.get(n.id)
                if (!p) return null
                const color = TYPE_COLOR[n.node_type ?? 'concept'] || '#3B82F6'
                return (
                  <g key={n.id}>
                    <circle cx={p.x} cy={p.y} r={14} fill={color} opacity={0.9} />
                    <text x={p.x} y={p.y + 24} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={11}>
                      {n.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
