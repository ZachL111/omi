import React from 'react'
import type { ScoreData } from '../api/types'

// Semicircle productivity gauge, ported from DailyScoreWidget.swift. Color tiers:
// gray (no tasks), green >=80, lime #CCCC00 60-79, orange 40-59, red <40.

function ringColor(score: number, hasTasks: boolean): string {
  if (!hasTasks) return 'var(--bg-quaternary)'
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#CCCC00'
  if (score >= 40) return '#F59E0B'
  return '#EF4444'
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)]
  }
  const [x1, y1] = toXY(startDeg)
  const [x2, y2] = toXY(endDeg)
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  const sweep = endDeg < startDeg ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`
}

export function ScoreGauge({ data, size = 180 }: { data?: ScoreData; size?: number }) {
  const score = Math.max(0, Math.min(100, data?.score ?? 0))
  const completed = data?.completedTasks ?? 0
  const total = data?.totalTasks ?? 0
  const hasTasks = total > 0
  const stroke = Math.max(size * 0.085, 9)
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const progressEnd = 180 - (score / 100) * 180 // 180° -> 0°
  const color = ringColor(score, hasTasks)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size / 2 + 6 }}>
        <svg width={size} height={size / 2 + 6} style={{ overflow: 'visible' }}>
          <path d={arcPath(cx, cy, r, 180, 0)} fill="none" stroke="var(--bg-quaternary)" strokeWidth={stroke} strokeLinecap="round" />
          {hasTasks && (
            <path
              d={arcPath(cx, cy, r, 180, progressEnd)}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              style={{ transition: 'all 0.3s ease' }}
            />
          )}
        </svg>
        <div
          style={{
            position: 'absolute',
            top: '52%',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: size * 0.22,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {Math.round(score)}%
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
        {hasTasks ? (
          <>
            <span style={{ color, fontSize: 13 }}>●</span>
            {completed} of {total} tasks completed
          </>
        ) : (
          'No tasks due'
        )}
      </div>
    </div>
  )
}
