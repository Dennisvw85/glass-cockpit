import os from 'node:os'
import path from 'node:path'

export const CLAUDE_DIR = process.env.CLAUDE_COCKPIT_DIR ?? path.join(os.homedir(), '.claude')
export const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions')
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

/**
 * Claude Code slugifies the cwd into a project dir name, but the exact rules are
 * undocumented (spaces, dots and slashes all collapse to "-"). Rather than
 * reimplement a guess, find the transcript by session id across project dirs.
 */
export function transcriptGlob(sessionId: string): string {
  return path.join(PROJECTS_DIR, '*', `${sessionId}.jsonl`)
}
