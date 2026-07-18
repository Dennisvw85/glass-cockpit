import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.tsx'
import { applyDensity, readDensity } from './components/Density.tsx'
import './index.css'

// Apply before first paint so the panel never flashes at the wrong scale.
applyDensity(readDensity())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
