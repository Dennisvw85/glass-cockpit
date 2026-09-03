import { until } from '../format.ts'
import type { LimitsView } from '../ws.ts'

interface Props {
  limits: LimitsView
  now: number
  /** Smaller rings so three fit across a portrait phone. */
  compact?: boolean
}

const R = 40
const CIRC = 2 * Math.PI * R

/** Outer tick ring: a dashed circle is 36 tick marks for the price of one node. */
const TICK_R = 46
const TICK_CIRC = 2 * Math.PI * TICK_R
const TICK_ON = 1.5
const TICK_GAP = TICK_CIRC / 36 - TICK_ON

function Gauge({
  label,
  pct,
  resets,
  accent,
  hot,
  compact,
}: {
  label: string
  pct: number
  resets: string | null
  accent: boolean
  hot: boolean
  compact?: boolean
}) {
  const p = Math.max(0, Math.min(100, pct)) / 100
  const stroke = hot ? 'var(--c-warn)' : accent ? 'var(--c-accent)' : 'var(--c-primary)'
  const box = compact ? '6rem' : '9.5rem'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: box, height: box }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50"
            cy="50"
            r={TICK_R}
            fill="none"
            stroke="var(--c-primary)"
            strokeOpacity="0.3"
            strokeWidth="4"
            strokeDasharray={`${TICK_ON} ${TICK_GAP}`}
          />
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--c-primary)" strokeOpacity="0.13" strokeWidth="7" />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="7"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - p)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-display font-bold leading-none tabular-nums ${
              compact ? 'text-2xl' : 'text-[2.6rem]'
            } ${hot ? 'text-warn' : 'text-ink-text'}`}
          >
            {Math.round(pct)}
          </span>
          {!compact && (
            <span className="hud-label text-[0.6rem] text-ink-faint mt-0.5">percent</span>
          )}
        </div>
      </div>
      <div className={`hud-label ${compact ? 'text-[0.65rem]' : 'text-xs'} text-ink-text`}>
        {label}
      </div>
      <div className="text-xs text-ink-faint tabular-nums h-4">
        {resets ? `reset T-${resets}` : ''}
      </div>
    </div>
  )
}

/**
 * The hero: usage-against-limit is the first thing you want from across the desk,
 * so the gauges lead. Model-scoped limits (Fable) render in the warm accent to
 * stand out from the two cyan headline windows.
 */
export function LimitsHero({ limits, now, compact }: Props) {
  if (limits.state !== 'ok') {
    return (
      <div className="hud-label flex items-center justify-center py-6 text-xs text-ink-muted">
        plan usage — {limits.detail ?? limits.state}
      </div>
    )
  }
  const headline = new Set(['5-hour', '7-day'])
  return (
    <div className={`flex items-start justify-around gap-2 flex-wrap ${compact ? 'py-3' : 'py-4'}`}>
      {limits.limits.map((l) => (
        <Gauge
          key={l.key}
          label={l.label}
          pct={l.utilization}
          resets={until(l.resetsAt, now)}
          accent={!headline.has(l.label)}
          hot={l.severity !== 'normal' || l.utilization >= 80}
          compact={compact}
        />
      ))}
    </div>
  )
}
