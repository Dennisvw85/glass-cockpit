import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { WebSocketServer } from 'ws'
import { Hub } from './hub.ts'
import { MODELS, EFFORTS, PERMISSION_MODES } from './agent.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
// Deliberately not PORT: dev harnesses set that for the web server, and the API
// must not fight Vite for 5199.
const PORT = Number(process.env.COCKPIT_PORT ?? 5200)
const PROD = process.env.NODE_ENV === 'production'

/**
 * This binds 0.0.0.0 so the iPad can reach it, which puts session data, cwd
 * paths and titles on the LAN. Gate it behind a token that survives restarts.
 */
function loadToken(): string {
  if (process.env.COCKPIT_TOKEN) return process.env.COCKPIT_TOKEN
  const file = path.join(ROOT, '.cockpit-token')
  try {
    const existing = fs.readFileSync(file, 'utf8').trim()
    if (existing) return existing
  } catch {
    /* first run */
  }
  const token = crypto.randomBytes(4).toString('hex')
  fs.writeFileSync(file, token + '\n', { mode: 0o600 })
  return token
}

function lanAddress(): string {
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets ?? []) {
      if (n.family === 'IPv4' && !n.internal) return n.address
    }
  }
  return '127.0.0.1'
}

const TOKEN = loadToken()
const hub = new Hub()

const app = Fastify({ logger: false })

app.get('/api/health', async () => ({ ok: true, prod: PROD }))

app.get('/api/sessions', async (req, reply) => {
  if ((req.query as any)?.t !== TOKEN) return reply.code(401).send({ error: 'bad token' })
  return hub.message()
})

// Receives every Claude Code hook via hooks/notify.mjs. Always answers fast:
// a slow reply here stalls the session that fired it.
app.post('/hook', async (req, reply) => {
  if ((req.query as any)?.t !== TOKEN) return reply.code(401).send({ error: 'bad token' })
  const body = req.body as { tag?: string; payload?: unknown }
  if (typeof body?.tag === 'string') hub.onHook(body.tag, body.payload ?? {})
  return { ok: true }
})

/**
 * Called by hooks/permission.mjs. This request is held open while a real Claude
 * turn blocks on it, so it must always answer — the broker times out on its own.
 */
app.post('/hook/permission', async (req, reply) => {
  if ((req.query as any)?.t !== TOKEN) return reply.code(401).send({ error: 'bad token' })
  const b = (req.body ?? {}) as any
  return hub.permissions.request({
    sessionId: typeof b.sessionId === 'string' ? b.sessionId : null,
    toolName: typeof b.toolName === 'string' ? b.toolName : 'unknown',
    toolInput: b.toolInput,
    cwd: typeof b.cwd === 'string' ? b.cwd : null,
  })
})

// --- control plane: sessions this app owns and can drive ---

const guard = (req: any, reply: any): boolean => {
  if (req.query?.t !== TOKEN) {
    reply.code(401).send({ error: 'bad token' })
    return false
  }
  return true
}

app.post('/api/permissions/:id/:decision', async (req, reply) => {
  if (!guard(req, reply)) return
  const { id, decision } = req.params as { id: string; decision: string }
  if (decision !== 'allow' && decision !== 'deny') {
    return reply.code(400).send({ error: 'bad decision' })
  }
  if (!hub.permissions.decide(id, decision)) {
    return reply.code(404).send({ error: 'no such pending permission' })
  }
  return { ok: true }
})

app.post('/api/agents', async (req, reply) => {
  if (!guard(req, reply)) return
  const b = (req.body ?? {}) as Record<string, string>
  if (!MODELS.includes(b.model as any)) return reply.code(400).send({ error: 'bad model' })
  if (!EFFORTS.includes(b.effort as any)) return reply.code(400).send({ error: 'bad effort' })
  if (!PERMISSION_MODES.includes(b.permissionMode as any)) {
    return reply.code(400).send({ error: 'bad permissionMode' })
  }
  const agent = hub.agents.create({
    cwd: b.cwd || os.homedir(),
    model: b.model,
    effort: b.effort,
    permissionMode: b.permissionMode,
  })
  return { id: agent.id }
})

app.post('/api/agents/:id/:action', async (req, reply) => {
  if (!guard(req, reply)) return
  const { id, action } = req.params as { id: string; action: string }
  const agent = hub.agents.get(id)
  if (!agent) return reply.code(404).send({ error: 'no such agent' })
  const b = (req.body ?? {}) as Record<string, string>

  switch (action) {
    case 'prompt':
      if (!b.text?.trim()) return reply.code(400).send({ error: 'empty prompt' })
      return { ok: agent.send(b.text) }
    case 'model':
      if (!MODELS.includes(b.model as any)) return reply.code(400).send({ error: 'bad model' })
      return { ok: agent.setModel(b.model) }
    case 'permission':
      if (!PERMISSION_MODES.includes(b.mode as any)) {
        return reply.code(400).send({ error: 'bad mode' })
      }
      return { ok: agent.setPermissionMode(b.mode) }
    case 'effort':
      if (!EFFORTS.includes(b.effort as any)) return reply.code(400).send({ error: 'bad effort' })
      await agent.setEffort(b.effort)
      return { ok: true }
    case 'interrupt':
      return { ok: agent.interrupt() }
    case 'stop':
      return { ok: hub.agents.remove(id) }
    default:
      return reply.code(404).send({ error: 'no such action' })
  }
})

if (PROD) {
  app.register(fastifyStatic, { root: path.join(ROOT, 'dist') })
}

await hub.start()
await app.listen({ port: PORT, host: '0.0.0.0' })

const wss = new WebSocketServer({ server: app.server, path: '/ws' })
wss.on('connection', (socket, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.searchParams.get('t') !== TOKEN) {
    socket.close(4001, 'bad token')
    return
  }
  const unsubscribe = hub.subscribe((msg) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
  })
  socket.on('close', unsubscribe)
  socket.on('error', unsubscribe)
})

const webPort = PROD ? PORT : 5199
console.log(`\n  Claude Cockpit`)
console.log(`  local   http://127.0.0.1:${webPort}/?t=${TOKEN}`)
console.log(`  iPad    http://${lanAddress()}:${webPort}/?t=${TOKEN}\n`)

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void hub.stop().then(() => process.exit(0))
  })
}
