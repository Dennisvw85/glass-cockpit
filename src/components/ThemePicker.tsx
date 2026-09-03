import { THEMES, useTheme } from '../theme.ts'

/**
 * Sits beside the density control, and matches its shape deliberately: same
 * 44px touch target, same selected-state treatment. Two settings that both
 * change how the board looks should not look like two different kinds of
 * control.
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme()

  return (
    <div className="flex items-center gap-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.note}
          aria-pressed={t.id === theme}
          className={`px-3 min-h-[44px] border text-xs hud-label ${
            t.id === theme ? 'border-accent text-accent' : 'border-ink-line text-ink-faint'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
