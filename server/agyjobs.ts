import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isAlive } from './sessions.ts'
import type { AgyJobView, AgyView } from './types.ts'

/** Where agy-job.sh keeps its background jobs; the env var is its own override. */
const JOBS_DIR = process.env.ANTIGRAVITY_JOBS ?? path.join(os.homedir(), '.antigravity-jobs')

/**
 * The plugin's own price table, so a rate change there follows through here
 * instead of being duplicated. Missing plugin, missing prices — the panel just
 * drops the cost figure rather than inventing one.
 */
const PRICES_FILE = path.join(
  os.homedir(),
  '.claude/plugins/marketplaces/antigravity-for-claude-code/prices.json',
)

/**
 * agy-job.sh records no tier, so cost is priced at the delegate's DEFAULT tier
 * (flash). A job explicitly run at --tier pro therefore reads low. The view
 * carries `estimated` so the UI can mark it rather than pass it off as exact.
 */
const ASSUMED_TIER = 'flash'

/**
 * agy-delegate appends an AGY_USAGE line here on every run when AGY_USAGE_LOG
 * (or the plugin's usage_log option) is set. This is the record of SYNCHRONOUS
 * delegation — the common case. The job registry above only ever holds
 * `agy-job start` background jobs, so a setup that never backgrounds anything
 * has an empty registry and a full log.
 */
const USAGE_LOG =
  process.env.AGY_USAGE_LOG ??
  process.env.CLAUDE_PLUGIN_OPTION_USAGE_LOG ??
  path.join(os.homedir(), '.claude/agy-usage.log')

interface Rate {
  in: number
  out: number
  cached_in?: number
}

let rates: Rate | null = null
/** What the same tokens would have cost on the orchestrator model, for the delta. */
let orchestratorRates: Rate | null = null
let cacheReadMult = 0.1

async function loadRates(): Promise<void> {
  try {
    const table = JSON.parse(await fs.readFile(PRICES_FILE, 'utf8'))
    const r = table[`gemini_${ASSUMED_TIER}`]
    if (r && typeof r.in === 'number' && typeof r.out === 'number') rates = r
    if (typeof table.cache_read_mult === 'number') cacheReadMult = table.cache_read_mult
    // `orchestrator` names the model Claude itself would have run this on.
    const o = table[table.orchestrator]
    if (o && typeof o.in === 'number' && typeof o.out === 'number') orchestratorRates = o
  } catch {
    rates = null // no plugin, or an unreadable table — cost simply goes unreported
  }
}

/** meta is `key=value` lines written by agy-job.sh. */
function parseMeta(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1)
  }
  return out
}

/**
 * The delegate prints `AGY_USAGE {json}` to stderr on every run, so the job's
 * err file carries its token counts. The last line wins: a --continue run
 * appends a second one.
 */
function parseUsage(err: string): { input: number; output: number; cacheRead: number } | null {
  let found: any = null
  for (const line of err.split('\n')) {
    if (!line.startsWith('AGY_USAGE ')) continue
    try {
      found = JSON.parse(line.slice('AGY_USAGE '.length)).usage ?? null
    } catch {
      /* a truncated line mid-write — keep whatever the previous one gave */
    }
  }
  if (!found) return null
  return {
    input: Number(found.input) || 0,
    output: Number(found.output) || 0,
    cacheRead: Number(found.cache_read) || 0,
  }
}

function costOf(u: { input: number; output: number; cacheRead: number }): number | null {
  if (!rates) return null
  const cachedRate = rates.cached_in ?? rates.in * cacheReadMult
  return (
    (u.input / 1_000_000) * rates.in +
    (u.output / 1_000_000) * rates.out +
    (u.cacheRead / 1_000_000) * cachedRate
  )
}

/**
 * Totals over the whole usage log. The log carries no timestamps, so this is
 * cumulative since the file was created — never "today". The file's mtime is
 * the only time signal available, and it dates the most recent delegation.
 */
async function readUsageLog(): Promise<{
  delegations: number
  spentUsd: number | null
  savedUsd: number | null
  lastAt: number | null
} | null> {
  let text: string
  let lastAt: number | null = null
  try {
    text = await fs.readFile(USAGE_LOG, 'utf8')
    lastAt = (await fs.stat(USAGE_LOG)).mtimeMs
  } catch {
    return null // no log configured, or nothing delegated yet
  }

  let input = 0
  let output = 0
  let cacheRead = 0
  let delegations = 0
  for (const line of text.split('\n')) {
    if (!line.startsWith('AGY_USAGE ')) continue
    try {
      const u = JSON.parse(line.slice('AGY_USAGE '.length)).usage ?? {}
      input += Number(u.input) || 0
      output += Number(u.output) || 0
      cacheRead += Number(u.cache_read) || 0
      delegations++
    } catch {
      /* a torn line from a concurrent append — skip it */
    }
  }
  if (delegations === 0) return null

  const spentUsd = costOf({ input, output, cacheRead })
  let savedUsd: number | null = null
  if (spentUsd !== null && orchestratorRates) {
    const onClaude =
      (input / 1_000_000) * orchestratorRates.in +
      (output / 1_000_000) * orchestratorRates.out +
      (cacheRead / 1_000_000) * orchestratorRates.in * cacheReadMult
    savedUsd = onClaude - spentUsd
  }
  return { delegations, spentUsd, savedUsd, lastAt }
}

async function readJob(dir: string, id: string): Promise<AgyJobView | null> {
  const read = async (name: string): Promise<string | null> => {
    try {
      return await fs.readFile(path.join(dir, name), 'utf8')
    } catch {
      return null
    }
  }

  const metaText = await read('meta')
  if (metaText === null) return null // not a job dir
  const meta = parseMeta(metaText)

  // Mirrors agy-job.sh's job_state(): an rc file decides, otherwise a live pid
  // means running, and a vanished pid with no rc means it was killed.
  const rcText = await read('rc')
  let status: AgyJobView['status']
  let rc: number | null = null
  if (rcText !== null) {
    rc = Number(rcText.trim())
    status = rc === 0 ? 'done' : 'failed'
  } else {
    const pidText = await read('pid')
    const pid = pidText ? Number(pidText.trim()) : NaN
    status = Number.isFinite(pid) && isAlive(pid) ? 'running' : 'failed'
  }

  const err = await read('err')
  const usage = err ? parseUsage(err) : null
  const cost = usage ? costOf(usage) : null

  const started = meta.started ? Date.parse(meta.started) : NaN

  return {
    id,
    task: meta.task ?? '',
    cwd: meta.cwd ?? '',
    startedAt: Number.isFinite(started) ? started : null,
    status,
    rc,
    tokens: usage ? usage.input + usage.output + usage.cacheRead : null,
    costUsd: cost,
    /** Priced at the default tier — see ASSUMED_TIER. */
    estimated: cost !== null,
  }
}

/**
 * Reads the whole job registry. There is no quota or rate-limit API for agy, so
 * this panel reports work and spend, never a limit gauge.
 */
export async function readAgy(): Promise<AgyView> {
  if (rates === null) await loadRates()

  // Two independent sources: the log covers synchronous delegation, the registry
  // covers `agy-job start` background work. Either one alone is enough to show
  // the panel — most setups only ever produce one of them.
  const usage = await readUsageLog()

  let names: string[] = []
  try {
    names = await fs.readdir(JOBS_DIR)
  } catch {
    /* no background jobs ever started */
  }

  const jobs: AgyJobView[] = []
  for (const name of names) {
    const job = await readJob(path.join(JOBS_DIR, name), name)
    if (job) jobs.push(job)
  }
  // Newest first; a job with no parseable start time sorts last.
  jobs.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))

  return {
    available: usage !== null || jobs.length > 0,
    jobs,
    activeCount: jobs.filter((j) => j.status === 'running').length,
    doneCount: jobs.filter((j) => j.status === 'done').length,
    delegations: usage?.delegations ?? 0,
    spentUsd: usage?.spentUsd ?? null,
    savedUsd: usage?.savedUsd ?? null,
    lastAt: usage?.lastAt ?? null,
  }
}
