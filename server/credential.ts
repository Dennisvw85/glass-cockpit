import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const SERVICE = 'Claude Code-credentials'
/** The Keychain item's account is the macOS username that ran `claude auth login`. */
const ACCOUNT = os.userInfo().username
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token'
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'

export const OAUTH_BETA = 'oauth-2025-04-20'

/** Refresh once the token has less than this left, so it never actually expires. */
const REFRESH_SKEW_MS = Number(process.env.COCKPIT_REFRESH_SKEW_MS ?? 30 * 60 * 1000)

export type TokenResult =
  | { state: 'ok'; accessToken: string; expiresAt: number }
  | { state: 'no-token' }
  | { state: 'refresh-failed'; detail: string }

/**
 * Claude Desktop authenticates through its own Electron session and never writes
 * here — only the standalone `claude` CLI does. So this entry exists exactly when
 * the user has logged into that CLI. It also holds `mcpOAuth` (23 MCP server
 * tokens); every write must preserve that block untouched.
 */
async function readRaw(): Promise<any | null> {
  try {
    const { stdout } = await exec('security', [
      'find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w',
    ])
    return JSON.parse(stdout.trim())
  } catch {
    return null
  }
}

async function writeRaw(full: any): Promise<void> {
  // execFile passes args directly (no shell), so the ~9KB JSON needs no escaping.
  await exec('security', [
    'add-generic-password', '-U', '-a', ACCOUNT, '-s', SERVICE, '-w', JSON.stringify(full),
  ])
}

/**
 * The refresh grant rotates the refresh token server-side, so the app and the CLI
 * must share one chain via the Keychain — an app-private copy would kill whichever
 * refreshed second. Concurrent callers share one in-flight refresh so the token
 * isn't rotated twice.
 */
let inFlight: Promise<TokenResult> | null = null

export function getToken(): Promise<TokenResult> {
  if (inFlight) return inFlight
  inFlight = doGetToken().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function doGetToken(): Promise<TokenResult> {
  const full = await readRaw()
  const oauth = full?.claudeAiOauth
  if (!oauth?.accessToken) return { state: 'no-token' }

  const expiresAt = Number(oauth.expiresAt ?? 0)
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return { state: 'ok', accessToken: oauth.accessToken, expiresAt }
  }
  if (!oauth.refreshToken) {
    return { state: 'refresh-failed', detail: 'Token expired and has no refresh token. Run `claude auth login`.' }
  }

  return refresh(full, oauth.refreshToken)
}

async function refresh(full: any, refreshToken: string): Promise<TokenResult> {
  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    return { state: 'refresh-failed', detail: `refresh request failed: ${(err as Error).message}` }
  }

  if (!res.ok) {
    // The grant was rejected — most likely the CLI refreshed independently and
    // rotated the token out from under us. Re-read: if a fresh token is now on
    // disk, use it rather than forcing a re-login.
    const reread = await readRaw()
    const o = reread?.claudeAiOauth
    if (o?.accessToken && Number(o.expiresAt ?? 0) - Date.now() > REFRESH_SKEW_MS) {
      return { state: 'ok', accessToken: o.accessToken, expiresAt: Number(o.expiresAt) }
    }
    return {
      state: 'refresh-failed',
      detail: `refresh rejected (${res.status}). Run \`claude auth login\`.`,
    }
  }

  const data: any = await res.json()
  if (!data?.access_token) {
    return { state: 'refresh-failed', detail: 'refresh response had no access_token.' }
  }

  // Merge into claudeAiOauth; leave mcpOAuth and everything else untouched.
  full.claudeAiOauth.accessToken = data.access_token
  if (data.refresh_token) full.claudeAiOauth.refreshToken = data.refresh_token
  const expiresAt = Date.now() + (Number(data.expires_in ?? 0) * 1000)
  full.claudeAiOauth.expiresAt = expiresAt
  if (typeof data.scope === 'string') full.claudeAiOauth.scopes = data.scope.split(' ')

  try {
    await writeRaw(full)
  } catch (err) {
    // The refresh succeeded but persisting failed — the rotated token is only in
    // memory. Return it so this run works; the next run will re-refresh.
    return { state: 'ok', accessToken: data.access_token, expiresAt }
  }
  return { state: 'ok', accessToken: data.access_token, expiresAt }
}
