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

const ATTENTION_LABEL: Record<string, string> = {
  permission: '▲ needs approval',
  idle: 'waiting',
  done: 'done',
}

/** Thin vertical separator between meta fields, in the HUD's hairline colour. */
function Sep() {
  return <span className="text-ink-line">│</span>
}

export function SessionCard({ session, now, solo, compact }: Props) {
  const u = session.usage
  const label = session.title ?? session.name ?? session.sessionId.slice(0, 8)
  const idle = u?.lastActivity ? now - u.lastActivity > 60_000 : true
  // Blocked mid-task is the only state worth pulling eyes across the desk.
  const blocked = session.attention === 'permission'
  const waiting = session.attention === 'idle' || session.attention === 'done'

  // The status rail down the left edge carries the whole state read at a glance.
  const rail = blocked ? '#d9a441' : idle ? '#5f7d88' : '#7ee787'
  const statusText = blocked ? 'text-warn' : waiting ? 'text-ink-muted' : 'text-go'

  const meta = (
    <div className="flex items-center gap-2 text-xs text-ink-faint min-w-0">
      <span className="truncate">{homeRelative(session.cwd)}</span>
      <Sep />
      <span className="shrink-0">{modelLabel(u?.model ?? null)}</span>
      {u?.speed === 'fast' && (
        <>
          <Sep />
          <span className="shrink-0">fast</span>
        </>
      )}
      {compact && u?.contextTokens ? (
        <>
          <Sep />
          <span className="shrink-0 tabular-nums">{tokens(u.contextTokens)} ctx</span>
        </>
      ) : null}
    </div>
  )

  const header = (
    <div className="flex items-baseline gap-2 min-w-0">
      <h2 className={`${solo && !compact ? 'text-2xl' : 'text-base'} truncate min-w-0`}>
        {label}
      </h2>
      <div className="flex-1" />
      {session.attention ? (
        <span className={`hud-label text-[0.65rem] shrink-0 ${statusText}`}>
          {ATTENTION_LABEL[session.attention]}
        </span>
      ) : (
        <span className={`hud-label text-[0.65rem] shrink-0 ${statusText}`}>
          {idle ? 'idle' : 'running'}
        </span>
      )}
      <span className="text-xs text-ink-faint tabular-nums shrink-0">
        {ago(u?.lastActivity ?? null, now)}
      </span>
    </div>
  )

  const body = compact ? null : (
    <div className={`flex items-center gap-3 ${solo ? 'flex-1 justify-center' : ''}`}>
      <ContextRing used={u?.contextTokens ?? 0} limit={u?.contextLimit ?? 200_000} solo={solo} />
      <div className={`${solo ? 'text-2xl' : 'text-sm'} text-ink-muted tabular-nums`}>
        {tokens(u?.contextTokens ?? 0)}
        <span className="text-ink-faint"> / {tokens(u?.contextLimit ?? 200_000)}</span>
      </div>
    </div>
  )

  return (
    <div
      className={`flex flex-col gap-1.5 py-2.5 pl-3 pr-3 ${solo ? 'h-full' : ''}`}
      style={{
        borderLeft: `2px solid ${rail}`,
        background: blocked ? 'rgba(217,164,65,0.07)' : 'rgba(111,211,232,0.045)',
      }}
    >
      {header}
      {meta}
      {body}
    </div>
  )
}
