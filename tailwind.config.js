/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // One accent, minimal semantics. Everything else is neutral.
        // HUD: near-black glass, cyan vector lines, amber for load, green for go.
        ink: {
          bg: '#05070a',
          surface: 'rgba(111,211,232,0.045)',
          raised: 'rgba(111,211,232,0.08)',
          line: 'rgba(111,211,232,0.18)',
          text: '#dbe9ee',
          muted: '#7d949c',
          faint: '#5f7d88',
        },
        hud: '#6fd3e8',
        agy: '#c58cf5',
        go: '#7ee787',
        accent: '#d97757',
        warn: '#d9a441',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Chakra Petch', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
