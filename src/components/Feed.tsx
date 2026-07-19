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

/** Only the blocked-on-you tags earn the accent; the rest stay quiet. */
const LOUD = new Set(['permission_prompt', 'agent_needs_input'])

export function Feed({ events, now, block }: Props) {
  return (
    <aside
      className={`flex flex-col ${
        block ? 'w-full border-t border-ink-line' : 'w-64 shrink-0 border-l border-ink-line'
      }`}
    >
      <h2 className="text-xs text-ink-faint px-3 py-2 border-b border-ink-line">
        activity
      </h2>
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-xs text-ink-faint px-3 py-2">Nothing yet.</p>
        ) : (
          <ul>
            {events.map((e) => (
              <li key={e.id} className="px-3 py-2 border-b border-ink-line/50">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-xs ${
                      LOUD.has(e.tag) ? 'text-accent' : 'text-ink-muted'
                    }`}
                  >
                    {TAG_LABEL[e.tag] ?? e.tag}
                  </span>
                  <span className="text-xs text-ink-faint tabular-nums shrink-0">
                    {ago(e.ts, now)}
                  </span>
                </div>
                {e.message && (
                  <p className="text-xs text-ink-faint mt-0.5 line-clamp-2">
                    {e.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
