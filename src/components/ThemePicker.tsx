import { THEMES, useTheme } from '../theme.ts'

/**
 * One cycling button rather than one button per theme: the header already runs
 * out of room on the iPad Mini's 1024px landscape, and a row of named buttons
 * grows with every theme added while this does not. Shape matches the sound
 * toggle beside it — both are "tap to change what the board does".
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme()
  const i = Math.max(0, THEMES.findIndex((t) => t.id === theme))
  const current = THEMES[i]
  const next = THEMES[(i + 1) % THEMES.length]

  return (
    <button
      onClick={() => setTheme(next.id)}
      title={`${current.note} — tap for ${next.label}`}
      className="hud-label px-3 min-h-[44px] border text-xs border-ink-line text-ink-muted"
    >
      {current.label}
    </button>
  )
}
