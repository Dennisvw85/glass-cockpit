import { useEffect, useState } from 'react'

const KEY = 'cockpit.density'
/** 16px on this panel ~= 10px on a 102ppi desktop monitor. 13 ~= MacBook Retina. */
const STEPS = [13, 16, 18] as const

export function readDensity(): number {
  const raw = Number(localStorage.getItem(KEY))
  return STEPS.includes(raw as any) ? raw : 16
}

export function applyDensity(px: number): void {
  document.documentElement.style.fontSize = `${px}px`
}

export function Density() {
  const [px, setPx] = useState(readDensity)

  useEffect(() => {
    applyDensity(px)
    localStorage.setItem(KEY, String(px))
  }, [px])

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s) => (
        <button
          key={s}
          onClick={() => setPx(s)}
          className={`px-3 min-h-[44px] rounded border text-xs tabular-nums ${
            s === px
              ? 'border-accent text-accent'
              : 'border-ink-line text-ink-faint'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
