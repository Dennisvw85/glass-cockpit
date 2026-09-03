import { useEffect, useState } from 'react'

const KEY = 'cockpit.theme'

export interface Theme {
  id: string
  /** Shown in the picker. */
  label: string
  /** One line on what the theme is going for, for the picker's tooltip. */
  note: string
  /** iOS paints the status bar and the Home Screen splash from this. */
  themeColor: string
  /** Drives the UA's own widgets (form controls, the overscroll gutter). */
  scheme: 'dark' | 'light'
}

/**
 * The registry is the only place a theme is named. Adding one means adding an
 * entry here and a matching `[data-theme='<id>']` block in index.css — no
 * component changes, because components only ever reference the variables.
 */
export const THEMES: Theme[] = [
  {
    id: 'hud',
    label: 'HUD',
    note: 'Backlit glass instrument — cyan vectors on near-black.',
    themeColor: '#05070a',
    scheme: 'dark',
  },
  {
    id: 'grimoire',
    label: 'Grimoire',
    note: 'Ink on vellum — rubricated headings, gilt meters.',
    themeColor: '#ded0ac',
    scheme: 'light',
  },
]

const DEFAULT = THEMES[0].id

export function readTheme(): string {
  const saved = localStorage.getItem(KEY)
  return THEMES.some((t) => t.id === saved) ? saved! : DEFAULT
}

export function applyTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.scheme

  // The board is usually a Home Screen web app, where the status bar is painted
  // from these two and not from the page. Left alone, a parchment board would
  // sit under a black iOS bar.
  setMeta('theme-color', theme.themeColor)
  setMeta('color-scheme', theme.scheme)
  setMeta(
    'apple-mobile-web-app-status-bar-style',
    theme.scheme === 'light' ? 'default' : 'black-translucent',
  )
}

function setMeta(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

export function useTheme(): [string, (id: string) => void] {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  return [theme, setTheme]
}
