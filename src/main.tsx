import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.tsx'
import { applyDensity, readDensity } from './components/Density.tsx'
import { applyTheme, readTheme } from './theme.ts'
import './index.css'

// Apply before first paint so the panel never flashes at the wrong scale or
// in the previous theme's colours.
applyDensity(readDensity())
applyTheme(readTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
