import { modelLabel, tokens } from '../format.ts'

export interface Focus {
  model: string | null
  /** null when unobservable (desktop sessions on the monitor). */
  effort: string | null
  contextTokens: number | null
  contextLimit: number | null
}

interface Props {
  connected: boolean
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
 * Two-line footer. Line 1 is at-a-glance status with the "Context Window" label on
 * the right; line 2 is the bar alone, so it sits at the very bottom edge. Bottom
 * padding respects the iOS home-indicator safe area.
 */
export function StatusBar({ connected, focus }: Props) {
  const hasCtx = focus && focus.contextTokens !== null && focus.contextLimit !== null
  const pct =
    hasCtx && focus!.contextLimit! > 0
      ? Math.min(1, focus!.contextTokens! / focus!.contextLimit!)
      : 0
  const hot = pct >= 0.8

  return (
    <div
      className="border-t border-ink-line px-4 pt-3 flex flex-col gap-2.5 shrink-0"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* line 1 — status, with the Context Window label pushed right */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-base">
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

        {hasCtx && (
          <>
            <span className="text-ink-line shrink-0">·</span>
            <span className="text-ink-muted shrink-0">Context Window</span>
          </>
        )}
      </div>

      {/* line 2 — the bar alone, along the bottom edge */}
      {hasCtx && (
        <div className="flex items-center gap-3 text-base">
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
