/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // One accent, minimal semantics. Everything else is neutral.
        ink: {
          bg: '#0c0c0d',
          surface: '#141416',
          raised: '#1b1b1f',
          line: '#26262b',
          text: '#e8e8ea',
          muted: '#8a8a93',
          faint: '#5c5c66',
        },
        accent: '#d97757',
        warn: '#d9a441',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
