import { useEffect, useRef, useState } from 'react'
import { control, type AgentView } from '../ws.ts'
import { homeRelative } from '../format.ts'

const MODELS = ['opus', 'sonnet', 'haiku'] as const
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
const PERMISSION_MODES = ['default', 'acceptEdits', 'plan'] as const

const KIND_STYLE: Record<string, string> = {
  user: 'text-ink-text',
  assistant: 'text-ink-muted',
  tool: 'text-ink-faint',
  system: 'text-ink-faint',
  error: 'text-warn',
}

function Pills({
  options,
  value,
  onPick,
  disabled,
}: {
  options: readonly string[]
  value: string
  onPick: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o}
          disabled={disabled}
          onClick={() => onPick(o)}
          className={`px-3 min-h-[44px] rounded border text-xs disabled:opacity-40 ${
            o === value ? 'border-accent text-accent' : 'border-ink-line text-ink-faint'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Launcher({ onStarted }: { onStarted: () => void }) {
  const [cwd, setCwd] = useState('')
  const [model, setModel] = useState<string>('sonnet')
  const [effort, setEffort] = useState<string>('medium')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const start = async () => {
    setBusy(true)
    setErr(null)
    try {
      await control('/api/agents', { cwd, model, effort, permissionMode: 'default' })
      onStarted()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-3 flex flex-col gap-3 max-w-xl">
      <p className="text-sm text-ink-muted">
        Start a session this dashboard owns. Unlike the desktop sessions on the
        monitor, this one can be driven from here.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-faint">working directory</span>
        <input
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="blank = home directory"
          className="bg-ink-surface border border-ink-line rounded px-2 min-h-[44px] text-sm text-ink-text"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-faint">model</span>
        <Pills options={MODELS} value={model} onPick={setModel} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-faint">effort</span>
        <Pills options={EFFORTS} value={effort} onPick={setEffort} />
      </div>
      {err && <p className="text-xs text-warn">{err}</p>}
      <button
        onClick={start}
        disabled={busy}
        className="self-start px-4 min-h-[44px] rounded border border-accent text-accent text-sm disabled:opacity-40"
      >
        {busy ? 'starting…' : 'start session'}
      </button>
    </div>
  )
}

export function Console({ agents }: { agents: AgentView[] }) {
  const agent = agents[0]
  const [draft, setDraft] = useState('')
  const [, force] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)

  // Follow the tail as output streams in.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [agent?.events.length])

  if (!agent) return <Launcher onStarted={() => force((n) => n + 1)} />

  const busy = agent.status === 'running' || agent.status === 'starting'
  const dead = agent.status === 'exited'

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await control(`/api/agents/${agent.id}/prompt`, { text }).catch(() => {})
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-ink-line flex-wrap">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            dead ? 'bg-ink-faint' : busy ? 'bg-accent animate-pulse' : 'bg-accent'
          }`}
        />
        <span className="text-xs text-ink-faint truncate">{homeRelative(agent.cwd)}</span>
        <Pills
          options={MODELS}
          value={agent.model.replace(/^claude-|-\d.*$/g, '') || agent.model}
          onPick={(m) => control(`/api/agents/${agent.id}/model`, { model: m })}
          disabled={dead}
        />
        <Pills
          options={EFFORTS}
          value={agent.effort}
          onPick={(e) => control(`/api/agents/${agent.id}/effort`, { effort: e })}
          disabled={dead}
        />
        <Pills
          options={PERMISSION_MODES}
          value={agent.permissionMode}
          onPick={(m) => control(`/api/agents/${agent.id}/permission`, { mode: m })}
          disabled={dead}
        />
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => control(`/api/agents/${agent.id}/interrupt`, {})}
            disabled={!busy}
            className="px-3 min-h-[44px] rounded border border-ink-line text-ink-faint text-xs disabled:opacity-40"
          >
            stop
          </button>
          <button
            onClick={() => control(`/api/agents/${agent.id}/stop`, {})}
            className="px-3 min-h-[44px] rounded border border-ink-line text-ink-faint text-xs"
          >
            close
          </button>
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {agent.events.length === 0 ? (
          <p className="text-xs text-ink-faint">
            {agent.status === 'starting' ? 'starting claude…' : 'Ready.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agent.events.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="text-xs text-ink-faint mr-2">
                  {e.kind === 'user' ? '›' : e.kind === 'tool' ? '⚙' : e.kind === 'error' ? '!' : '‹'}
                </span>
                <span className={`whitespace-pre-wrap ${KIND_STYLE[e.kind] ?? ''}`}>
                  {e.kind === 'tool' ? `${e.text}()` : e.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-ink-line p-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          disabled={dead}
          placeholder={dead ? 'session closed' : 'message claude…'}
          className="flex-1 min-h-[44px] bg-ink-surface border border-ink-line rounded px-2 text-sm text-ink-text disabled:opacity-40"
        />
        <button
          onClick={send}
          disabled={dead || !draft.trim()}
          className="px-4 min-h-[44px] rounded border border-accent text-accent text-sm disabled:opacity-40"
        >
          send
        </button>
      </div>
    </div>
  )
}
