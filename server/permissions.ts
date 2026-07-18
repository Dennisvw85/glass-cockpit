import type { PendingPermission } from './types.ts'

/**
 * Tools that never need a human. Everything else gets held for a tap on the
 * iPad. Read-only by design — nothing here mutates state or reaches the network.
 */
const AUTO_ALLOW = new Set([
  'Read',
  'Glob',
  'Grep',
  'NotebookRead',
  'TodoWrite',
  'ToolSearch',
])

/**
 * The hook blocks a real Claude turn while we wait, so this can't wait forever.
 * On timeout we deny with a reason rather than hang the session.
 */
const DECISION_TIMEOUT_MS = 120_000

export type Decision = 'allow' | 'deny'

interface Waiter {
  pending: PendingPermission
  resolve: (d: { decision: Decision; reason: string }) => void
  timer: NodeJS.Timeout
}

export class PermissionBroker {
  private waiters = new Map<string, Waiter>()
  private seq = 0

  constructor(private onChange: () => void) {}

  /** Called by the hook endpoint. Resolves once the human taps, or on timeout. */
  request(input: {
    sessionId: string | null
    toolName: string
    toolInput: unknown
    cwd: string | null
  }): Promise<{ decision: Decision; reason: string }> {
    if (AUTO_ALLOW.has(input.toolName)) {
      return Promise.resolve({ decision: 'allow', reason: 'auto-allowed (read-only tool)' })
    }

    const id = `perm-${++this.seq}`
    const pending: PendingPermission = {
      id,
      sessionId: input.sessionId,
      toolName: input.toolName,
      preview: previewOf(input.toolName, input.toolInput),
      cwd: input.cwd,
      ts: Date.now(),
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id)
        this.onChange()
        resolve({ decision: 'deny', reason: 'no response from Cockpit within 2 minutes' })
      }, DECISION_TIMEOUT_MS)

      this.waiters.set(id, { pending, resolve, timer })
      this.onChange()
    })
  }

  decide(id: string, decision: Decision): boolean {
    const w = this.waiters.get(id)
    if (!w) return false
    clearTimeout(w.timer)
    this.waiters.delete(id)
    w.resolve({ decision, reason: `${decision} from Cockpit` })
    this.onChange()
    return true
  }

  list(): PendingPermission[] {
    return [...this.waiters.values()].map((w) => w.pending)
  }

  /** Release everything on shutdown so no hook is left hanging. */
  drain(): void {
    for (const w of this.waiters.values()) {
      clearTimeout(w.timer)
      w.resolve({ decision: 'deny', reason: 'Cockpit shutting down' })
    }
    this.waiters.clear()
  }
}

/** A one-line gist of the call, enough to judge it from across the desk. */
function previewOf(tool: string, input: any): string {
  if (!input || typeof input !== 'object') return ''
  const pick = (k: string) => (typeof input[k] === 'string' ? input[k] : null)
  const first =
    pick('command') ??
    pick('url') ??
    pick('file_path') ??
    pick('pattern') ??
    pick('query') ??
    pick('path') ??
    JSON.stringify(input)
  const flat = String(first).replace(/\s+/g, ' ').trim()
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat
}
