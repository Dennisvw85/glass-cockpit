import { ago } from '../format.ts'
import type { CockpitEvent } from '../ws.ts'

interface Props {
  events: CockpitEvent[]
  now: number
  /** Full-width section below the sessions (portrait), vs. a fixed side rail. */
  block?: boolean
}

const TAG_LABEL: Record<string, string> = {
  permission_prompt: 'needs approval',
  agent_needs_input: 'needs input',
  idle_prompt: 'idle',
  agent_completed: 'agent done',
  stop: 'turn done',
}

/** Only the blocked-on-you tags earn the warn colour; the rest stay quiet. */
const LOUD = new Set(['permission_prompt', 'agent_needs_input'])

/** Clock face for the log gutter — the HUD reads times, not "3m ago". */
function clock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Feed({ events, now, block }: Props) {
  return (
    <aside
      className={`flex flex-col ${
        block ? 'w-full border-t border-ink-line' : 'hud-panel flex-1 min-h-0'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h2 className="hud-label text-xs text-hud">log</h2>
        <div className="hud-rule" />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        {events.length === 0 ? (
          <p className="text-xs text-ink-faint">standing by.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-ink-line tabular-nums shrink-0">
                    {clock(e.ts)}
                  </span>
                  <span
                    className={`text-xs truncate ${
                      LOUD.has(e.tag) ? 'text-warn' : 'text-ink-muted'
                    }`}
                  >
                    {TAG_LABEL[e.tag] ?? e.tag}
                  </span>
                  <div className="flex-1" />
                  <span className="text-xs text-ink-line tabular-nums shrink-0">
                    {ago(e.ts, now)}
                  </span>
                </div>
                {e.message && (
                  <p className="text-xs text-ink-faint line-clamp-2 pl-[3.25rem]">{e.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
