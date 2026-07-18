#!/usr/bin/env node
// PreToolUse hook for Cockpit-owned sessions: holds the tool call until a human
// taps allow/deny on the dashboard.
//
// Failure is always "stay out of the way": if Cockpit is unreachable or slow, we
// print nothing and exit 0, which leaves Claude Code's normal permission logic
// untouched rather than blocking or force-denying.
import { readFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Slightly longer than the broker's own timeout, so the broker decides first. */
const HTTP_TIMEOUT_MS = 130_000

const bail = () => process.exit(0) // silence = defer to normal permission logic

const watchdog = setTimeout(bail, HTTP_TIMEOUT_MS + 5_000)
watchdog.unref()

let token = ''
try {
  token = readFileSync(path.join(ROOT, '.cockpit-token'), 'utf8').trim()
} catch {
  bail()
}

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('error', bail)
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    bail()
    return
  }

  const body = JSON.stringify({
    sessionId: payload.session_id ?? null,
    toolName: payload.tool_name ?? 'unknown',
    toolInput: payload.tool_input ?? {},
    cwd: payload.cwd ?? null,
  })

  const req = http.request(
    {
      host: '127.0.0.1',
      port: Number(process.env.COCKPIT_PORT ?? 5200),
      path: `/hook/permission?t=${encodeURIComponent(token)}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
      timeout: HTTP_TIMEOUT_MS,
    },
    (res) => {
      let out = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (out += c))
      res.on('end', () => {
        let d
        try {
          d = JSON.parse(out)
        } catch {
          bail()
          return
        }
        if (d.decision !== 'allow' && d.decision !== 'deny') bail()
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: d.decision,
              permissionDecisionReason: d.reason ?? 'Cockpit',
            },
          }),
        )
        process.exit(0)
      })
    },
  )
  req.on('error', bail)
  req.on('timeout', () => {
    req.destroy()
    bail()
  })
  req.end(body)
})
