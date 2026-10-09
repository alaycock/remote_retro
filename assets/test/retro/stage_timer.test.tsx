import { act, fireEvent, screen } from "@testing-library/react"
import { vi } from "vitest"
import { StageTimer, formatTime } from "../../js/retro/components/StageTimer"
import { timerUpdated } from "../../js/retro/store/slices"
import type { TimerState } from "../../js/retro/types"
import { PushError } from "../../js/retro/channel"
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
  it("formats MM:SS, rounding up", () => {
    expect(formatTime(180_000)).toBe("03:00")
    expect(formatTime(61_001)).toBe("01:02")
    expect(formatTime(400)).toBe("00:01")
    expect(formatTime(3_600_000)).toBe("60:00")
  })

  it("shows the facilitator an idle 3:00 they can adjust instantly and start", async () => {
    const { channel, push } = mockChannel((_event, payload) =>
      Promise.resolve({ timer: { ...idle, duration_ms: 360_000, remaining_ms: 360_000, ...(payload as object) } }),
    )
    room({ push: channel })
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 03:00")

    const more = screen.getByRole("button", { name: "One minute more" })
    for (let i = 0; i < 4; i++) fireEvent.click(more)
    fireEvent.click(screen.getByRole("button", { name: "One minute less" }))
    // Every click shows at once; nothing is sent until clicking pauses.
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 06:00")
    expect(push).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(400))
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenLastCalledWith("timer:command", { command: "set_minutes", minutes: 6 })
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 06:00")

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Start timer" })))
    expect(push).toHaveBeenLastCalledWith("timer:command", { command: "start" })
  })

  it("sends a still-pending duration before starting", async () => {
    const { channel, push } = mockChannel(() => Promise.resolve({ timer: idle }))
    room({ push: channel })
    fireEvent.click(screen.getByRole("button", { name: "One minute more" }))
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Start timer" })))
    expect(push.mock.calls).toEqual([
      ["timer:command", { command: "set_minutes", minutes: 4 }],
      ["timer:command", { command: "start" }],
    ])
  })

  it("stays between one and sixty minutes", () => {
    room({ timer: { ...idle, duration_ms: 120_000, remaining_ms: 120_000 } })
    const less = screen.getByRole("button", { name: "One minute less" })
    fireEvent.click(less)
    expect(less).toBeDisabled()
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 01:00")
  })

  it("is hidden from others until it starts, and outside timed stages", () => {
    const store = room({ userId: 2 })
    expect(screen.queryByRole("timer")).not.toBeInTheDocument()

    act(() => {
      store.dispatch(timerUpdated({ status: "running", duration_ms: 180_000, remaining_ms: 90_000 }))
    })
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 01:30 left")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("does not show in the lobby or action items", () => {
    room({ stage: "action-items" as never })
    expect(screen.queryByRole("timer")).not.toBeInTheDocument()
  })

  it("counts down, chimes once at zero, and leaves the stage alone", () => {
    const { channel, push } = mockChannel()
    room({ timer: { status: "running", duration_ms: 180_000, remaining_ms: 2_000 }, push: channel })
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 00:02 left")
    expect(screen.getByRole("button", { name: "Pause timer" })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 00:01 left")
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
    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 01:15 left, paused")
    expect(screen.getByRole("button", { name: "Resume timer" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stop and reset timer" })).toBeInTheDocument()
  })

  describe("play, pause and stop are optimistic", () => {
    const running: TimerState = { status: "running", duration_ms: 180_000, remaining_ms: 90_000 }
    const never = () => new Promise<never>(() => {})

    it("shows the new state before the server answers", () => {
      const { channel } = mockChannel(never)
      room({ timer: running, push: channel })
      act(() => vi.advanceTimersByTime(10_000))

      act(() => fireEvent.click(screen.getByRole("button", { name: "Pause timer" })))
      expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 01:20 left, paused")

      act(() => fireEvent.click(screen.getByRole("button", { name: "Resume timer" })))
      expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 01:20 left")

      act(() => fireEvent.click(screen.getByRole("button", { name: "Stop and reset timer" })))
      expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 03:00")

      act(() => fireEvent.click(screen.getByRole("button", { name: "Start timer" })))
      expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 03:00 left")
    })

    it("snaps to the server's timer when it refuses", async () => {
      const { channel } = mockChannel(() =>
        Promise.reject(
          new PushError("timer_changed", { timer: { status: "idle", duration_ms: 300_000, remaining_ms: 300_000 } }),
        ),
      )
      room({ timer: running, push: channel })
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pause timer" })))
      expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 05:00")
    })

    it("reverts when the server never answers", async () => {
      const { channel } = mockChannel(() => Promise.reject(new PushError("timeout")))
      room({ timer: running, push: channel })
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pause timer" })))
      expect(screen.getByRole("timer")).toHaveAccessibleName("Timer: 01:30 left")
      expect(screen.getByRole("button", { name: "Pause timer" })).toBeInTheDocument()
    })
  })
})
