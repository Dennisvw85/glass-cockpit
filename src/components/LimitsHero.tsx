import { until } from '../format.ts'
import type { LimitsView } from '../ws.ts'

interface Props {
  limits: LimitsView
  now: number
}

const R = 40
const CIRC = 2 * Math.PI * R

function Gauge({
  label,
  pct,
  resets,
  accent,
  hot,
}: {
  label: string
  pct: number
  resets: string | null
  accent: boolean
  hot: boolean
}) {
  const p = Math.max(0, Math.min(100, pct)) / 100
  const stroke = hot ? '#d9a441' : '#d97757'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: '9rem', height: '9rem' }}>
        <svg viewBox="0 0 96 96" className="w-full h-full">
          <circle cx="48" cy="48" r={R} fill="none" stroke="#26262b" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - p)}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-4xl tabular-nums ${hot ? 'text-warn' : 'text-ink-text'}`}>
            {Math.round(pct)}
            <span className="text-ink-faint text-lg">%</span>
          </span>
        </div>
      </div>
      <div className={`text-sm ${accent ? 'text-accent' : 'text-ink-muted'}`}>{label}</div>
      <div className="text-xs text-ink-faint tabular-nums h-4">
        {resets ? `resets ${resets}` : ''}
      </div>
    </div>
  )
}

/**
 * The hero: usage-against-limit is the first thing you want from across the desk,
 * so the gauges lead. Model-scoped limits (Fable) render in accent to stand out
 * from the two headline windows.
 */
export function LimitsHero({ limits, now }: Props) {
  if (limits.state !== 'ok') {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-ink-muted">
        plan usage — {limits.detail ?? limits.state}
      </div>
    )
  }
  const headline = new Set(['5-hour', '7-day'])
  return (
    <div className="flex items-start justify-around gap-4 py-4 flex-wrap">
      {limits.limits.map((l) => (
        <Gauge
          key={l.key}
          label={l.label}
          pct={l.utilization}
          resets={until(l.resetsAt, now)}
          accent={!headline.has(l.label)}
          hot={l.severity !== 'normal' || l.utilization >= 80}
        />
      ))}
    </div>
  )
}
