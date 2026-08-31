import { ago } from '../format.ts'
import type { AgyView } from '../ws.ts'

interface Props {
  agy: AgyView
  now: number
}

/** How many background jobs fit the rail before it starts scrolling out of sight. */
const SHOWN = 3

function dollars(v: number): string {
  // Sub-cent spend is normal for flash-tier work; don't round it away to $0.00.
  return v > 0 && v < 0.01 ? '<$0.01' : `$${v.toFixed(2)}`
}

/**
 * agy has no quota or rate-limit API, so unlike the plan gauges this panel can
 * never show a limit. What it shows instead is the point of delegating at all:
 * what the cheap model was handed, and what that avoided paying on the
 * orchestrator. Hides itself entirely when nothing has been delegated.
 */
export function AgyPanel({ agy, now }: Props) {
  if (!agy.available) return null

  const jobs = agy.jobs.slice(0, SHOWN)

  return (
    <div className="hud-panel p-3 shrink-0">
      <div className="flex items-center gap-2 mb-2.5">
        <h2 className="hud-label text-xs text-agy">agy delegation</h2>
        <div className="hud-rule" />
        {agy.activeCount > 0 && (
          <span className="hud-label text-[0.6rem] text-agy">{agy.activeCount} running</span>
        )}
      </div>

      {/* The headline: money not spent on the expensive model. */}
      {agy.savedUsd !== null && (
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-display font-bold text-2xl text-agy tabular-nums leading-none">
            {dollars(agy.savedUsd)}
          </span>
          <span className="hud-label text-[0.6rem] text-ink-faint">saved vs opus</span>
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span className="hud-label text-[0.65rem] text-ink-faint">spent</span>
        <div className="flex-1" />
        <span className="text-xs text-ink-muted tabular-nums">
          {agy.spentUsd === null ? '—' : dollars(agy.spentUsd)}
          {/* Priced at the default tier: neither source records one per run. */}
          <span className="hud-label text-[0.55rem] text-ink-faint ml-1">est</span>
        </span>
      </div>

      <div className="flex items-baseline gap-2 mt-1">
        <span className="hud-label text-[0.65rem] text-ink-faint">delegated</span>
        <div className="flex-1" />
        <span className="text-xs text-ink-muted tabular-nums">
          {agy.delegations}
          {agy.lastAt && <span className="text-ink-line"> · {ago(agy.lastAt, now)}</span>}
        </span>
      </div>

      {/* Background jobs only exist when someone ran `agy-job start`. */}
      {jobs.length > 0 && (
        <>
          <div className="h-px bg-ink-line my-2.5" />
          <ul className="flex flex-col gap-1.5">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 shrink-0 ${
                    j.status === 'running'
                      ? 'bg-agy'
                      : j.status === 'failed'
                        ? 'bg-warn'
                        : 'bg-ink-faint'
                  }`}
                />
                <span className="text-xs truncate min-w-0 flex-1">{j.task || j.id}</span>
                <span className="text-xs text-ink-line tabular-nums shrink-0">
                  {ago(j.startedAt, now)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
