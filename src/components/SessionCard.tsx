import { ContextRing } from './ContextRing.tsx'
import { ago, homeRelative, modelLabel, tokens } from '../format.ts'
import type { SessionView } from '../ws.ts'

interface Props {
  session: SessionView
  now: number
  /** The only session on screen: fill the space instead of leaving a void. */
  solo?: boolean
  /** Slim row — no big ring. Context now lives in the footer bar. */
  compact?: boolean
}

function Badge({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-xs whitespace-nowrap ${
        dim
          ? 'border-ink-line text-ink-faint'
          : 'border-ink-line text-ink-muted bg-ink-raised'
      }`}
    >
      {children}
    </span>
  )
}

const ATTENTION_LABEL: Record<string, string> = {
  permission: 'needs approval',
  idle: 'waiting',
  done: 'done',
}

export function SessionCard({ session, now, solo, compact }: Props) {
  const u = session.usage
  const label = session.title ?? session.name ?? session.sessionId.slice(0, 8)
  const idle = u?.lastActivity ? now - u.lastActivity > 60_000 : true
  // Blocked mid-task is the only state worth pulling eyes across the desk.
  const blocked = session.attention === 'permission'
  const waiting = session.attention === 'idle' || session.attention === 'done'

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              blocked ? 'bg-accent animate-pulse' : idle ? 'bg-ink-faint' : 'bg-accent'
            }`}
          />
          <h2 className={`${solo && !compact ? 'text-2xl' : 'text-base'} truncate`}>{label}</h2>
        </div>
        <p className="text-xs text-ink-faint truncate mt-0.5">{homeRelative(session.cwd)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {session.attention && (
          <span className={`text-xs ${blocked ? 'text-accent' : 'text-ink-muted'}`}>
            {ATTENTION_LABEL[session.attention]}
          </span>
        )}
        <span className="text-xs text-ink-faint tabular-nums">
          {ago(u?.lastActivity ?? null, now)}
        </span>
      </div>
    </div>
  )

  const border = blocked ? 'border-accent' : waiting ? 'border-ink-muted' : 'border-ink-line'

  // Compact: a slim row with just the model badge. Context is in the footer bar.
  if (compact) {
    return (
      <div className={`bg-ink-surface border rounded-lg p-3 flex flex-col gap-2 ${border}`}>
        {header}
        <div className="flex flex-wrap gap-1">
          <Badge>{modelLabel(u?.model ?? null)}</Badge>
          {u?.speed === 'fast' && <Badge>fast</Badge>}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-ink-surface border rounded-lg p-3 flex flex-col gap-2 ${solo ? 'h-full' : ''} ${border}`}
    >
      {header}
      <div className={`flex items-center gap-3 ${solo ? 'flex-1 justify-center' : ''}`}>
        <ContextRing used={u?.contextTokens ?? 0} limit={u?.contextLimit ?? 200_000} solo={solo} />
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className={`${solo ? 'text-2xl' : 'text-sm'} text-ink-muted tabular-nums`}>
            {tokens(u?.contextTokens ?? 0)}
            <span className="text-ink-faint"> / {tokens(u?.contextLimit ?? 200_000)}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge>{modelLabel(u?.model ?? null)}</Badge>
            {u?.speed === 'fast' && <Badge>fast</Badge>}
            <Badge dim>effort —</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
