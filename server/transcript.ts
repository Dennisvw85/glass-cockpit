import fs from 'node:fs/promises'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import chokidar from 'chokidar'
import { PROJECTS_DIR } from './paths.ts'
import type { UsageSnapshot } from './types.ts'

/**
 * Transcripts run to tens of megabytes. We only ever need the newest assistant
 * turn, so the first read seeks to the tail and every later read is incremental
 * from the stored offset.
 */
const TAIL_BYTES = 2_000_000

interface State {
  file: string
  sessionId: string
  offset: number
  decoder: StringDecoder
  carry: string
  model: string | null
  contextTokens: number
  outputTokens: number
  speed: string | null
  lastActivity: number | null
  aiTitle: string | null
  customTitle: string | null
}

function newState(file: string, sessionId: string): State {
  return {
    file,
    sessionId,
    offset: 0,
    decoder: new StringDecoder('utf8'),
    carry: '',
    model: null,
    contextTokens: 0,
    outputTokens: 0,
    speed: null,
    lastActivity: null,
    aiTitle: null,
    customTitle: null,
  }
}

function applyLine(st: State, line: string): void {
  const trimmed = line.trim()
  if (!trimmed) return
  let e: any
  try {
    e = JSON.parse(trimmed)
  } catch {
    return
  }

  switch (e.type) {
    case 'assistant': {
      // Subagent turns share the transcript but carry their own context window.
      // Counting them would report the wrong number for the main thread.
      if (e.isSidechain) return
      const msg = e.message
      if (!msg || typeof msg !== 'object') return
      if (typeof msg.model === 'string' && msg.model !== '<synthetic>') {
        st.model = msg.model
      }
      const u = msg.usage
      if (u && typeof u === 'object') {
        const ctx =
          (u.input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0)
        if (ctx > 0) {
          st.contextTokens = ctx
          st.outputTokens = u.output_tokens ?? 0
          st.speed = typeof u.speed === 'string' ? u.speed : null
        }
      }
      if (e.timestamp) st.lastActivity = Date.parse(e.timestamp)
      break
    }
    case 'user': {
      if (e.isSidechain) return
      if (e.timestamp) st.lastActivity = Date.parse(e.timestamp)
      break
    }
    case 'ai-title':
      if (typeof e.aiTitle === 'string') st.aiTitle = e.aiTitle
      break
    case 'custom-title':
      if (typeof e.customTitle === 'string') st.customTitle = e.customTitle
      break
  }
}

async function pump(st: State): Promise<void> {
  let size: number
  try {
    size = (await fs.stat(st.file)).size
  } catch {
    return
  }

  // Truncated or replaced underneath us.
  if (size < st.offset) {
    st.offset = 0
    st.carry = ''
    st.decoder = new StringDecoder('utf8')
  }

  let start = st.offset
  let dropPartialHead = false
  if (st.offset === 0 && size > TAIL_BYTES) {
    start = size - TAIL_BYTES
    dropPartialHead = true
  }
  if (start >= size) return

  const fh = await fs.open(st.file, 'r')
  try {
    const len = size - start
    const buf = Buffer.alloc(len)
    await fh.read(buf, 0, len, start)
    let text = st.carry + st.decoder.write(buf)
    st.carry = ''

    if (dropPartialHead) {
      const nl = text.indexOf('\n')
      text = nl === -1 ? '' : text.slice(nl + 1)
    }

    const lines = text.split('\n')
    // The final chunk has no newline yet — hold it until the writer finishes.
    st.carry = lines.pop() ?? ''
    for (const line of lines) applyLine(st, line)
    st.offset = size
  } finally {
    await fh.close()
  }
}

export async function findTranscript(sessionId: string): Promise<string | null> {
  let dirs: string[]
  try {
    dirs = await fs.readdir(PROJECTS_DIR)
  } catch {
    return null
  }
  for (const d of dirs) {
    const p = path.join(PROJECTS_DIR, d, `${sessionId}.jsonl`)
    try {
      await fs.access(p)
      return p
    } catch {
      /* keep looking */
    }
  }
  return null
}

export class Tailer {
  private states = new Map<string, State>()
  private byFile = new Map<string, State>()
  private watcher = chokidar.watch([], { ignoreInitial: true })

  constructor(
    private onUpdate: () => void,
    /** Injected so the window comes from the live Models API, not a stale table. */
    private limitFor: (model: string | null) => number,
  ) {
    this.watcher.on('change', (file) => {
      const st = this.byFile.get(file)
      if (!st) return
      void pump(st).then(this.onUpdate)
    })
  }

  async track(sessionId: string): Promise<void> {
    if (this.states.has(sessionId)) return
    const file = await findTranscript(sessionId)
    if (!file) return
    const st = newState(file, sessionId)
    this.states.set(sessionId, st)
    this.byFile.set(file, st)
    await pump(st)
    this.watcher.add(file)
  }

  untrack(sessionId: string): void {
    const st = this.states.get(sessionId)
    if (!st) return
    this.watcher.unwatch(st.file)
    this.byFile.delete(st.file)
    this.states.delete(sessionId)
  }

  tracked(): string[] {
    return [...this.states.keys()]
  }

  title(sessionId: string): string | null {
    const st = this.states.get(sessionId)
    if (!st) return null
    return st.customTitle ?? st.aiTitle
  }

  transcriptPath(sessionId: string): string | null {
    return this.states.get(sessionId)?.file ?? null
  }

  usage(sessionId: string): UsageSnapshot | null {
    const st = this.states.get(sessionId)
    if (!st) return null
    return {
      model: st.model,
      contextTokens: st.contextTokens,
      contextLimit: this.limitFor(st.model),
      outputTokens: st.outputTokens,
      speed: st.speed,
      lastActivity: st.lastActivity,
    }
  }

  async close(): Promise<void> {
    await this.watcher.close()
  }
}
