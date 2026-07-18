#!/usr/bin/env node
// Claude Code hook -> Cockpit. Usage: notify.mjs <tag>
//
// This runs on every turn of every session, including when Cockpit is not
// running. It must never block Claude Code: every failure path exits 0 fast,
// and the whole process is capped by a watchdog.
import { readFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const tag = process.argv[2] ?? 'unknown'

// Nothing below is allowed to hang the parent session.
const watchdog = setTimeout(() => process.exit(0), 1500)
watchdog.unref()

let token = ''
try {
  token = readFileSync(path.join(ROOT, '.cockpit-token'), 'utf8').trim()
} catch {
  process.exit(0) // no token file means Cockpit was never started
}

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('error', () => process.exit(0))
process.stdin.on('end', () => {
  let payload = {}
  try {
    payload = JSON.parse(raw)
  } catch {
    /* forward the tag even if the payload is unreadable */
  }

  const body = JSON.stringify({ tag, payload })
  const req = http.request(
    {
      host: '127.0.0.1',
      port: Number(process.env.COCKPIT_PORT ?? 5200),
      path: `/hook?t=${encodeURIComponent(token)}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
      timeout: 400,
    },
    (res) => {
      res.resume()
      res.on('end', () => process.exit(0))
    },
  )
  req.on('error', () => process.exit(0)) // Cockpit down: silently give up
  req.on('timeout', () => {
    req.destroy()
    process.exit(0)
  })
  req.end(body)
})
