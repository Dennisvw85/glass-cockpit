/**
 * iOS has no Web Push below 16.4, so attention has to be signalled in-page.
 * Audio stays locked until a real user gesture, hence unlock() being wired to
 * the sound toggle rather than fired on load.
 */
let ctx: AudioContext | null = null

export function unlockAudio(): void {
  if (ctx) {
    void ctx.resume()
    return
  }
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as any).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  void ctx.resume()
}

export function beep(times = 2): void {
  if (!ctx || ctx.state !== 'running') return
  for (let i = 0; i < times; i++) {
    const at = ctx.currentTime + i * 0.18
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, at)
    // Ramp rather than switch: an instant gain change clicks audibly.
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14)
    osc.start(at)
    osc.stop(at + 0.15)
  }
}
