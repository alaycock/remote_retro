import { type ReactNode, useEffect, useRef, useState } from "react"
import { playChime, primeChime } from "../chime"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectIsFacilitator, selectStage, selectTimer } from "../store/selectors"
import type { TimerSliceState } from "../store/slices"
import { commandTimer } from "../store/thunks"
import type { Stage, TimerCommand } from "../types"

const TIMED_STAGES: readonly Stage[] = ["idea-generation", "grouping", "voting"]
const MIN_MS = 60_000
const MAX_MS = 60 * 60_000
const TICK_MS = 250
const STEP_MS = 60_000
/** +/- update instantly; the final duration is sent once clicking pauses for this long. */
const ADJUST_DEBOUNCE_MS = 400

/** Always `MM:SS`, so the width never changes as the minutes tick over (with tabular digits). */
export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** Remaining ms on this client's clock; ticks while running. */
function useRemaining(timer: TimerSliceState | null): number {
  const [now, setNow] = useState(() => performance.now())
  const running = timer?.status === "running"

  useEffect(() => {
    if (!running) return
    setNow(performance.now())
    const id = setInterval(() => setNow(performance.now()), TICK_MS)
    return () => clearInterval(id)
  }, [running, timer?.receivedAt])

  if (!timer) return 0
  if (timer.status !== "running") return timer.remaining_ms
  return Math.max(0, timer.remaining_ms - (now - timer.receivedAt))
}

/**
 * The facilitator's countdown for ideas, group & label and voting. Off until started; when it
 * reaches zero everyone hears a soft chime and nothing else happens (the stage stays open).
 * Everyone else sees it once it has been started.
 */
export function StageTimer() {
  const dispatch = useAppDispatch()
  const stage = useAppSelector(selectStage)
  const timer = useAppSelector(selectTimer)
  const isFacilitator = useAppSelector(selectIsFacilitator)
  const remaining = useRemaining(timer)
  // The duration the facilitator is dialling in with +/-, shown immediately and sent debounced.
  const [draftMs, setDraftMs] = useState<number | null>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => primeChime(), [])
  useEffect(() => () => clearTimeout(draftTimer.current), [])

  // Drop an unsent draft when the stage changes (every stage starts back at 3:00).
  useEffect(() => {
    clearTimeout(draftTimer.current)
    setDraftMs(null)
  }, [stage])

  // Chime once per run, only when we watched it reach zero (not when joining after it ended).
  const chimedFor = useRef<number | null>(null)
  const runningOut = timer?.status === "running" && timer.remaining_ms > 0 && remaining <= 0
  useEffect(() => {
    if (runningOut && timer && chimedFor.current !== timer.receivedAt) {
      chimedFor.current = timer.receivedAt
      playChime()
    }
  }, [runningOut, timer])

  if (!stage || !TIMED_STAGES.includes(stage) || !timer) return null

  const status = timer.status === "running" && remaining <= 0 ? "done" : timer.status
  if (!isFacilitator && status === "idle") return null

  // Optimistic (see `commandTimer`), so buttons never wait on the server.
  const send = (command: TimerCommand) => void dispatch(commandTimer(command))

  const sendDraft = (ms: number) => {
    clearTimeout(draftTimer.current)
    draftTimer.current = undefined
    // Clear the draft only if no newer click happened while this was in flight.
    void dispatch(commandTimer({ command: "set_minutes", minutes: ms / STEP_MS })).finally(() =>
      setDraftMs((current) => (current === ms && draftTimer.current === undefined ? null : current)),
    )
  }

  const durationMs = draftMs ?? timer.duration_ms
  const adjust = (delta: number) => {
    const next = Math.min(MAX_MS, Math.max(MIN_MS, durationMs + delta))
    if (next === durationMs) return
    setDraftMs(next)
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => sendDraft(next), ADJUST_DEBOUNCE_MS)
  }

  const start = () => {
    // Send a still-debouncing duration first; the channel handles pushes in order.
    if (draftMs != null && draftTimer.current !== undefined) sendDraft(draftMs)
    send({ command: "start" })
  }

  const done = status === "done"
  const time = formatTime(status === "idle" ? durationMs : remaining)
  const label = { idle: time, running: `${time} left`, paused: `${time} left, paused`, done: "Time's up" }[status]

  return (
    <div
      role="timer"
      aria-label={`Timer: ${label}`}
      className={`flex items-center gap-0.5 rounded-full border px-1 py-0.5 transition-colors ${
        done ? "border-success/40 bg-success/10 text-success" : "border-base-300 bg-base-100"
      }`}
    >
      {isFacilitator && status === "idle" && (
        <TimerButton
          icon="hero-minus-micro"
          label="One minute less"
          disabled={durationMs <= MIN_MS}
          onClick={() => adjust(-STEP_MS)}
        />
      )}
      <span
        className={`flex items-center gap-1 px-1.5 font-mono text-sm tabular-nums ${
          status === "paused" ? "text-base-content/50" : ""
        }`}
        aria-hidden="true"
      >
        <span className={`${done ? "hero-bell-micro" : "hero-clock-micro"} size-4 opacity-70`} />
        {done ? "00:00" : time}
      </span>
      {isFacilitator && status === "idle" && (
        <TimerButton
          icon="hero-plus-micro"
          label="One minute more"
          disabled={durationMs >= MAX_MS}
          onClick={() => adjust(STEP_MS)}
        />
      )}
      {isFacilitator && status === "running" && (
        <TimerButton icon={<PauseGlyph />} label="Pause timer" onClick={() => send({ command: "pause" })} />
      )}
      {isFacilitator && (status === "idle" || status === "paused") && (
        <TimerButton
          icon={<PlayGlyph />}
          label={status === "paused" ? "Resume timer" : "Start timer"}
          onClick={start}
        />
      )}
      {isFacilitator && status !== "idle" && (
        <TimerButton icon={<StopGlyph />} label="Stop and reset timer" onClick={() => send({ command: "reset" })} />
      )}
      {/* The chime is audio-only and role="timer" isn't announced, so say it for screen readers. */}
      <span className="sr-only" aria-live="polite">
        {done ? "Time's up" : ""}
      </span>
    </div>
  )
}

// Transport glyphs drawn to share one optical box (10px tall, centred in 16), unlike the stock
// micro icons, whose 12px pause bars look heavier and off-centre next to the 10px stop square.
const glyph = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="size-4" aria-hidden="true">
    {children}
  </svg>
)
const PauseGlyph = () =>
  glyph(
    <>
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </>,
  )
// A triangle's visual centre sits right of its box's left edge, so it's nudged right to look centred.
const PlayGlyph = () => glyph(<path d="M5 3.9a1 1 0 0 1 1.52-.85l6.2 4.1a1 1 0 0 1 0 1.7l-6.2 4.1A1 1 0 0 1 5 12.1Z" />)
const StopGlyph = () => glyph(<rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />)

function TimerButton({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs btn-circle"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {typeof icon === "string" ? <span className={`${icon} size-4`} aria-hidden="true" /> : icon}
    </button>
  )
}
