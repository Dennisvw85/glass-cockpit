import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// iPad Mini 4 tops out at iPadOS 15.8 (Safari 15). Vite's default target assumes
// Safari 16+, which would ship syntax the tablet cannot parse. Pin it explicitly.
const LEGACY_TARGET = ['es2020', 'safari15']

export default defineConfig({
  plugins: [react()],
  build: {
    target: LEGACY_TARGET,
    outDir: 'dist',
    sourcemap: false,
  },
  esbuild: {
    target: LEGACY_TARGET,
  },
  optimizeDeps: {
    esbuildOptions: { target: LEGACY_TARGET },
  },
  server: {
    port: 5199,
    host: true, // bind 0.0.0.0 so the iPad can reach the dev server over LAN
    proxy: {
      '/api': { target: 'http://127.0.0.1:5200', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:5200', ws: true },
    },
  },
})
