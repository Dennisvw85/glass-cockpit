/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every colour resolves through a CSS variable so a theme can restyle the
      // board by redefining them in one block (see the top of index.css). The
      // names stay semantic — `hud` is "the primary structural accent", which is
      // cyan on the HUD and gilt in the grimoire.
      colors: {
        ink: {
          bg: 'var(--c-bg)',
          surface: 'var(--c-surface)',
          raised: 'var(--c-raised)',
          line: 'var(--c-line)',
          text: 'var(--c-text)',
          muted: 'var(--c-muted)',
          faint: 'var(--c-faint)',
        },
        hud: 'var(--c-primary)',
        agy: 'var(--c-agy)',
        go: 'var(--c-go)',
        accent: 'var(--c-accent)',
        warn: 'var(--c-warn)',
        track: 'var(--c-track)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
}
