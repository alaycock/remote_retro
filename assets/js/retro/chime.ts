/**
 * A soft, single bell "ding" synthesised with Web Audio (no asset to load).
 *
 * Browsers only let a page make sound after the user has interacted with it, so
 * `primeChime()` creates/resumes the AudioContext on the first pointer or key press.
 * Everyone in a retro clicks or types long before a timer runs out.
 */
let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (context) return context
  const Ctor = typeof window === "undefined" ? undefined : window.AudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

let primed = false
export function primeChime(): void {
  if (primed || typeof document === "undefined") return
  primed = true
  const unlock = () => {
    void audioContext()?.resume()
    document.removeEventListener("pointerdown", unlock, true)
    document.removeEventListener("keydown", unlock, true)
  }
  document.addEventListener("pointerdown", unlock, true)
  document.addEventListener("keydown", unlock, true)
}

// A bell's partials: the fundamental rings longest; the inharmonic overtone gives the
// "ding" its shimmer and fades fast, so it reads as a chime rather than a beep.
const PARTIALS = [
  { ratio: 1, gain: 0.16, decay: 1.6 },
  { ratio: 2.76, gain: 0.05, decay: 0.5 },
  { ratio: 5.4, gain: 0.015, decay: 0.25 },
]
const FUNDAMENTAL_HZ = 880

export function playChime(): void {
  const ctx = audioContext()
  if (!ctx) return
  void ctx.resume()
  const start = ctx.currentTime + 0.01
  const master = ctx.createGain()
  master.gain.value = 0.8
  master.connect(ctx.destination)

  for (const { ratio, gain, decay } of PARTIALS) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = FUNDAMENTAL_HZ * ratio
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, start + decay)
    osc.connect(env).connect(master)
    osc.start(start)
    osc.stop(start + decay + 0.05)
  }
}
