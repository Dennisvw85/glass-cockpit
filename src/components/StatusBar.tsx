import { ago, modelLabel, tokens } from '../format.ts'

export interface Focus {
  model: string | null
  /** null when unobservable (desktop sessions on the monitor). */
  effort: string | null
  contextTokens: number | null
  contextLimit: number | null
}

interface Props {
  connected: boolean
  updatedAt: number
  now: number
  focus: Focus | null
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="whitespace-nowrap shrink-0">
      {label && <span className="text-ink-faint">{label} </span>}
      <span className={accent ? 'text-accent' : 'text-ink-text'}>{value}</span>
    </span>
  )
}

/**
 * Two-line footer. Line 1 is at-a-glance status; line 2 gives the Context Window
 * its own full-width bar — the old "4th gauge", now a proper graph that can't get
 * squeezed to a sliver by a crowded single line.
 */
export function StatusBar({ connected, updatedAt, now, focus }: Props) {
  const hasCtx = focus && focus.contextTokens !== null && focus.contextLimit !== null
  const pct =
    hasCtx && focus!.contextLimit! > 0
      ? Math.min(1, focus!.contextTokens! / focus!.contextLimit!)
      : 0
  const hot = pct >= 0.8

  return (
    <div className="border-t border-ink-line px-4 py-3 flex flex-col gap-2.5 shrink-0">
      {/* line 1 — status */}
      <div className="flex items-center gap-4 text-base overflow-x-auto">
        <span className="flex items-center gap-2 shrink-0">
          <span
            className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-accent' : 'bg-warn animate-pulse'}`}
          />
          <span className={connected ? 'text-accent' : 'text-warn'}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </span>

        <span className="text-ink-line shrink-0">·</span>

        {focus ? (
          <>
            <Field label="" value={modelLabel(focus.model)} />
            <span className="text-ink-line shrink-0">·</span>
            <Field label="effort" value={focus.effort ?? '—'} accent={!!focus.effort} />
          </>
        ) : (
          <span className="text-ink-faint">no active session</span>
        )}

        <span className="ml-auto text-sm text-ink-faint tabular-nums shrink-0">
          {connected ? `updated ${ago(updatedAt || null, now)}` : 'reconnecting…'}
        </span>
      </div>

      {/* line 2 — context window as a full-width bar */}
      {hasCtx && (
        <div className="flex items-center gap-3 text-base">
          <span className="text-ink-muted shrink-0">Context Window</span>
          <span className="flex-1 min-w-0 h-3 bg-ink-raised rounded-full overflow-hidden border border-ink-line">
            <span
              className={`block h-full rounded-full ${hot ? 'bg-warn' : 'bg-accent'}`}
              style={{ width: `${pct * 100}%` }}
            />
          </span>
          <span className={`tabular-nums shrink-0 ${hot ? 'text-warn' : 'text-ink-text'}`}>
            {Math.round(pct * 100)}%
          </span>
          <span className="text-ink-faint tabular-nums shrink-0">
            {tokens(focus!.contextTokens!)} / {tokens(focus!.contextLimit!)}
          </span>
        </div>
      )}
    </div>
  )
}
