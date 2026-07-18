import { until } from '../format.ts'
import type { LimitsView } from '../ws.ts'

interface Props {
  limits: LimitsView
  now: number
}

function Bar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const hot = clamped >= 80
  return (
    <div className="h-1.5 bg-ink-raised rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${hot ? 'bg-warn' : 'bg-accent'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function LimitsPanel({ limits, now }: Props) {
  if (limits.state !== 'ok') {
    return (
      <div className="border-t border-ink-line px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-ink-faint">plan usage</span>
          <span className="text-xs text-ink-muted">{limits.detail ?? limits.state}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-ink-line px-3 py-2 flex gap-4">
      {limits.limits.map((l) => {
        const resets = until(l.resetsAt, now)
        return (
          <div key={l.key} className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-ink-muted truncate">{l.label}</span>
              <span className="text-xs tabular-nums text-ink-text">
                {Math.round(l.utilization)}%
              </span>
            </div>
            <div className="my-1">
              <Bar pct={l.utilization} />
            </div>
            {resets && (
              <span className="text-xs text-ink-faint tabular-nums">resets {resets}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
