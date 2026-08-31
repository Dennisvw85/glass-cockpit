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
          {/* Square, not round: the HUD has no soft edges. */}
          <span
            className={`w-2 h-2 ${connected ? 'bg-go' : 'bg-warn animate-pulse'}`}
            style={connected ? { boxShadow: '0 0 8px #7ee787' } : undefined}
          />
          <span className={`hud-label text-xs ${connected ? 'text-go' : 'text-warn'}`}>
            {connected ? 'live' : 'offline'}
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
            <span className="hud-label text-xs text-ink-faint shrink-0">context</span>
          </>
        )}
      </div>

      {/* line 2 — the bar alone, along the bottom edge */}
      {hasCtx && (
        <div className="flex items-center gap-3 text-base">
          <span className="relative flex-1 min-w-0 h-2.5 bg-ink-raised overflow-hidden">
            <span
              className={`block h-full ${hot ? 'bg-warn' : 'bg-hud'}`}
              style={{
                width: `${pct * 100}%`,
                boxShadow: hot ? '0 0 10px rgba(217,164,65,0.8)' : '0 0 10px rgba(111,211,232,0.8)',
              }}
            />
            {/* Scale ticks, cut out of the channel every 40px. */}
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(90deg, #05070a 1px, transparent 1px)',
                backgroundSize: '40px 100%',
              }}
            />
          </span>
          <span
            className={`font-display font-bold tabular-nums shrink-0 ${
              hot ? 'text-warn' : 'text-hud'
            }`}
          >
            {Math.round(pct * 100)}%
          </span>
          <span className="text-xs text-ink-faint tabular-nums shrink-0">
            {tokens(focus!.contextTokens!)} / {tokens(focus!.contextLimit!)}
          </span>
        </div>
      )}
    </div>
  )
}
