import { act, fireEvent, screen } from "@testing-library/react"
import { vi } from "vitest"
import { StageTimer, formatTime } from "../../js/retro/components/StageTimer"
import { timerUpdated } from "../../js/retro/store/slices"
import type { TimerState } from "../../js/retro/types"
import { mockChannel, renderWithStore, retro, setup, snapshot } from "./helpers"

const playChime = vi.fn()
vi.mock("../../js/retro/chime", () => ({ playChime: () => playChime(), primeChime: () => {} }))

const idle: TimerState = { status: "idle", duration_ms: 180_000, remaining_ms: 180_000 }

function room({ timer = idle, stage = "idea-generation" as const, userId = 1, push = mockChannel().channel } = {}) {
  const store = setup(snapshot({ retro: retro({ stage }), timer }), { userId, channel: push })
  renderWithStore(<StageTimer />, store)
  return store
}

beforeEach(() => {
  playChime.mockClear()
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance"] })
})
afterEach(() => vi.useRealTimers())

describe("StageTimer", () => {
  it("formats minutes and seconds, rounding up", () => {
    expect(formatTime(180_000)).toBe("3:00")
    expect(formatTime(61_001)).toBe("1:02")
    expect(formatTime(400)).toBe("0:01")
  })

  it("shows the facilitator an idle 3:00 they can adjust and start", async () => {
    const { channel, push } = mockChannel(() => Promise.resolve({ timer: idle }))
    room({ push: channel })
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 3:00")

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "One minute more" })))
    expect(push).toHaveBeenLastCalledWith("timer:command", { command: "add_minute" })
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Start timer" })))
    expect(push).toHaveBeenLastCalledWith("timer:command", { command: "start" })
    expect(screen.queryByRole("button", { name: /pause|reset/i })).not.toBeInTheDocument()
  })

  it("can't go below one minute", () => {
    room({ timer: { ...idle, duration_ms: 60_000, remaining_ms: 60_000 } })
    expect(screen.getByRole("button", { name: "One minute less" })).toBeDisabled()
  })

  it("is hidden from others until it starts, and outside timed stages", () => {
    const store = room({ userId: 2 })
    expect(screen.queryByRole("timer")).not.toBeInTheDocument()

    act(() => {
      store.dispatch(timerUpdated({ status: "running", duration_ms: 180_000, remaining_ms: 90_000 }))
    })
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 1:30 left")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("does not show in the lobby or action items", () => {
    room({ stage: "action-items" as never })
    expect(screen.queryByRole("timer")).not.toBeInTheDocument()
  })

  it("counts down, chimes once at zero, and leaves the stage alone", () => {
    const { channel, push } = mockChannel()
    room({ timer: { status: "running", duration_ms: 180_000, remaining_ms: 2_000 }, push: channel })
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 0:02 left")
    expect(screen.getByRole("button", { name: "Pause timer" })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 0:01 left")
    expect(playChime).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1_500))
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: Time's up")
    expect(playChime).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(5_000))
    expect(playChime).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Stop and reset timer" })).toBeInTheDocument()
  })

  it("doesn't chime for someone who joins after it ran out", () => {
    room({ timer: { status: "done", duration_ms: 180_000, remaining_ms: 0 } })
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: Time's up")
    expect(playChime).not.toHaveBeenCalled()
  })

  it("holds still while paused, offering resume and reset", () => {
    room({ timer: { status: "paused", duration_ms: 180_000, remaining_ms: 75_000 } })
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 1:15 left, paused")
    expect(screen.getByRole("button", { name: "Resume timer" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stop and reset timer" })).toBeInTheDocument()
  })
})
