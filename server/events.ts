export type Attention = 'permission' | 'idle' | 'done'

export interface CockpitEvent {
  id: number
  tag: string
  sessionId: string | null
  cwd: string | null
  message: string | null
  ts: number
}

/**
 * Which tags mean "this session is waiting on the human". `prompt_submit` is the
 * only one that clears — it proves the human answered.
 */
const TAG_ATTENTION: Record<string, Attention | null> = {
  permission_prompt: 'permission',
  agent_needs_input: 'permission',
  idle_prompt: 'idle',
  agent_completed: 'done',
  stop: 'done',
  prompt_submit: null,
}

const MAX_EVENTS = 50
const MAX_MESSAGE = 200

/** Events the feed shows. `prompt_submit` is state-only, never displayed. */
const SILENT_TAGS = new Set(['prompt_submit'])

function extractMessage(tag: string, payload: any): string | null {
  const raw =
    typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.last_assistant_message === 'string'
        ? payload.last_assistant_message
        : null
  if (!raw) return null
  const flat = raw.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_MESSAGE ? `${flat.slice(0, MAX_MESSAGE)}…` : flat
}

export class EventLog {
  private events: CockpitEvent[] = []
  private attention = new Map<string, Attention>()
  private seq = 0

  record(tag: string, payload: any): void {
    const sessionId = typeof payload?.session_id === 'string' ? payload.session_id : null

    if (sessionId && tag in TAG_ATTENTION) {
      const next = TAG_ATTENTION[tag]
      if (next === null) this.attention.delete(sessionId)
      else this.attention.set(sessionId, next)
    }

    if (SILENT_TAGS.has(tag)) return

    this.events.unshift({
      id: ++this.seq,
      tag,
      sessionId,
      cwd: typeof payload?.cwd === 'string' ? payload.cwd : null,
      message: extractMessage(tag, payload),
      ts: Date.now(),
    })
    if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS
  }

  recent(): CockpitEvent[] {
    return this.events
  }

  attentionFor(sessionId: string): Attention | null {
    return this.attention.get(sessionId) ?? null
  }

  /** Drop attention state for sessions that no longer exist. */
  prune(liveIds: Set<string>): void {
    for (const id of this.attention.keys()) {
      if (!liveIds.has(id)) this.attention.delete(id)
    }
  }
}
