import { useEffect, useRef, useState } from "react"
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

export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
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
  const [pending, setPending] = useState(false)

  useEffect(() => primeChime(), [])

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

  const send = async (command: TimerCommand) => {
    setPending(true)
    try {
      await dispatch(commandTimer(command))
    } finally {
      setPending(false)
    }
  }

  const done = status === "done"
  const time = formatTime(remaining)
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
          disabled={pending || timer.duration_ms <= MIN_MS}
          onClick={() => send("remove_minute")}
        />
      )}
      <span
        className={`flex items-center gap-1 px-1.5 font-mono text-sm tabular-nums ${
          status === "paused" ? "text-base-content/50" : ""
        }`}
        aria-hidden="true"
      >
        <span className={`${done ? "hero-bell-micro" : "hero-clock-micro"} size-4 opacity-70`} />
        {done ? "0:00" : time}
      </span>
      {isFacilitator && status === "idle" && (
        <TimerButton
          icon="hero-plus-micro"
          label="One minute more"
          disabled={pending || timer.duration_ms >= MAX_MS}
          onClick={() => send("add_minute")}
        />
      )}
      {isFacilitator && status === "running" && (
        <TimerButton icon="hero-pause-micro" label="Pause timer" disabled={pending} onClick={() => send("pause")} />
      )}
      {isFacilitator && (status === "idle" || status === "paused") && (
        <TimerButton
          icon="hero-play-micro"
          label={status === "paused" ? "Resume timer" : "Start timer"}
          disabled={pending}
          onClick={() => send("start")}
        />
      )}
      {isFacilitator && status !== "idle" && (
        <TimerButton
          icon="hero-stop-micro"
          label="Stop and reset timer"
          disabled={pending}
          onClick={() => send("reset")}
        />
      )}
    </div>
  )
}

function TimerButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: string
  label: string
  disabled: boolean
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
      <span className={`${icon} size-4`} aria-hidden="true" />
    </button>
  )
}
