import { useEffect, useRef, useState } from 'react'
import { SessionCard } from './components/SessionCard.tsx'
import { Density } from './components/Density.tsx'
import { LimitsHero } from './components/LimitsHero.tsx'
import { StatusBar, type Focus } from './components/StatusBar.tsx'
import { Feed } from './components/Feed.tsx'
import { AgyPanel } from './components/AgyPanel.tsx'
import { Console } from './components/Console.tsx'
import { Permissions } from './components/Permissions.tsx'
import { beep, unlockAudio } from './alert.ts'
import { useCockpit } from './ws.ts'

const SOUND_KEY = 'cockpit.sound'

function useClock(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

const VIEW_KEY = 'cockpit.view'
type View = 'monitor' | 'console'

const LAYOUT_KEY = 'cockpit.layout'
type Layout = 'ipad' | 'iphone'

/** Portrait stacks everything, so cap the session list to leave room for the feed. */
const PORTRAIT_SESSIONS = 2

export function App() {
  const { sessions, agents, permissions, events, limits, agy, connected, authError } = useCockpit()
  const now = useClock(1000)
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) === '1')
  const [view, setView] = useState<View>(
    () => (localStorage.getItem(VIEW_KEY) as View) ?? 'monitor',
  )
  // Default to whichever layout matches the device's shape; the switch overrides.
  const [layout, setLayout] = useState<Layout>(() => {
    const saved = localStorage.getItem(LAYOUT_KEY)
    if (saved === 'ipad' || saved === 'iphone') return saved
    return typeof window !== 'undefined' && window.innerWidth < window.innerHeight
      ? 'iphone'
      : 'ipad'
  })
  const previouslyBlocked = useRef<Set<string>>(new Set())
  const previousPerms = useRef<Set<string>>(new Set())

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, layout)
  }, [layout])

  // Beep only on the rising edge of a block, not for every frame it stays blocked.
  useEffect(() => {
    const blocked = new Set(
      sessions.filter((s) => s.attention === 'permission').map((s) => s.sessionId),
    )
    let fresh = false
    for (const id of blocked) {
      if (!previouslyBlocked.current.has(id)) fresh = true
    }
    previouslyBlocked.current = blocked
    if (fresh && sound) beep()
  }, [sessions, sound])

  useEffect(() => {
    const ids = new Set(permissions.map((p) => p.id))
    let fresh = false
    for (const id of ids) if (!previousPerms.current.has(id)) fresh = true
    previousPerms.current = ids
    if (fresh && sound) beep(3)
  }, [permissions, sound])

  const toggleSound = () => {
    const next = !sound
    // Must happen inside the click for iOS to honour it.
    if (next) unlockAudio()
    setSound(next)
    localStorage.setItem(SOUND_KEY, next ? '1' : '0')
  }

  const blockedCount = sessions.filter((s) => s.attention === 'permission').length

  // The status bar summarizes the session in focus: the owned agent in console,
  // the most-recent desktop session on the monitor (where effort is unknowable).
  const focusAgent = agents[0]
  const focusSession = sessions[0]
  const focus: Focus | null =
    view === 'console'
      ? focusAgent
        ? { model: focusAgent.model, effort: focusAgent.effort, contextTokens: null, contextLimit: null }
        : null
      : focusSession?.usage
        ? {
            model: focusSession.usage.model,
            effort: null,
            contextTokens: focusSession.usage.contextTokens,
            contextLimit: focusSession.usage.contextLimit,
          }
        : null

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden hud-grid ${
        layout === 'iphone' ? 'max-w-[430px] mx-auto border-x border-ink-line' : ''
      }`}
    >
      <header
        className="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap px-3 pb-2 border-b border-ink-line shrink-0"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="hud-label text-lg font-bold text-hud">◆ Cockpit</h1>
          <span className="self-center w-px h-5 bg-ink-line" />
          {(['monitor', 'console'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`hud-label text-xs px-2 min-h-[44px] ${
                v === view ? 'text-hud' : 'text-ink-faint'
              }`}
            >
              {v}
            </button>
          ))}
          {blockedCount + permissions.length > 0 && (
            <span className="hud-label text-xs text-warn">
              ▲ {blockedCount + permissions.length} needs you
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {(['ipad', 'iphone'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setLayout(d)}
                title={d === 'ipad' ? 'iPad Mini 4 · landscape' : 'iPhone 11 · portrait'}
                className={`hud-label px-3 min-h-[44px] border text-xs ${
                  d === layout ? 'border-hud text-hud' : 'border-ink-line text-ink-faint'
                }`}
              >
                {d === 'ipad' ? 'iPad' : 'iPhone'}
              </button>
            ))}
          </div>
          <button
            onClick={toggleSound}
            className={`hud-label px-3 min-h-[44px] border text-xs ${
              sound ? 'border-hud text-hud' : 'border-ink-line text-ink-faint'
            }`}
          >
            sound {sound ? 'on' : 'off'}
          </button>
          <Density />
          <span
            className={`w-1.5 h-1.5 ${connected ? 'bg-go' : 'bg-ink-faint'}`}
            title={connected ? 'connected' : 'reconnecting'}
          />
        </div>
      </header>

      <Permissions permissions={permissions} now={now} />

      {authError ? (
        <p className="text-ink-muted text-sm p-3">
          Missing or invalid token. Open the URL printed by the server, including
          its <span className="text-accent">?t=</span> parameter.
        </p>
      ) : view === 'console' ? (
        <div className="flex-1 min-h-0">
          <Console agents={agents} />
        </div>
      ) : layout === 'iphone' ? (
        // Portrait: everything stacked in one scrolling column.
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <LimitsHero limits={limits} now={now} compact />
          <div className="border-t border-ink-line p-3">
            {sessions.length === 0 ? (
              <p className="hud-label text-ink-faint text-xs">
                {connected ? 'no active sessions' : 'acquiring link…'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Only the 2 most recent, so the activity feed still fits on screen. */}
                {sessions.slice(0, PORTRAIT_SESSIONS).map((s) => (
                  <SessionCard key={s.sessionId} session={s} now={now} compact />
                ))}
                {sessions.length > PORTRAIT_SESSIONS && (
                  <p className="text-xs text-ink-faint">
                    +{sessions.length - PORTRAIT_SESSIONS} more running
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="px-3 pb-3">
            <AgyPanel agy={agy} now={now} />
          </div>
          <Feed events={events} now={now} block />
        </div>
      ) : (
        // Landscape: gauges over a two-column [sessions | feed].
        <div className="flex-1 flex flex-col min-h-0">
          <LimitsHero limits={limits} now={now} />
          <div className="flex-1 flex min-h-0 gap-3 px-3 pb-3">
            <main className="hud-panel flex-1 min-w-0 p-3 overflow-y-auto overflow-x-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-2.5">
                <h2 className="hud-label text-xs text-hud">active sessions</h2>
                <div className="hud-rule" />
                <span className="hud-label text-xs text-ink-faint tabular-nums">
                  {String(sessions.length).padStart(2, '0')}
                </span>
              </div>
              {sessions.length === 0 ? (
                <p className="hud-label text-ink-faint text-xs">
                  {connected ? 'no active sessions' : 'acquiring link…'}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {sessions.map((s) => (
                    <SessionCard key={s.sessionId} session={s} now={now} compact />
                  ))}
                </div>
              )}
            </main>
            <div className="w-64 shrink-0 flex flex-col gap-3 min-h-0">
              <AgyPanel agy={agy} now={now} />
              <Feed events={events} now={now} />
            </div>
          </div>
        </div>
      )}

      <StatusBar connected={connected} focus={focus} />
    </div>
  )
}
