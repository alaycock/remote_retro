import { act, fireEvent, render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import type { RetroChannel } from "../channel"
import { makeStore } from "../store"
import { currentUserSet, groupUpserted, snapshotReceived } from "../store/slices"
import type { Group, Idea, Snapshot } from "../types"
import { Board } from "./Board"
import { LABEL_DEBOUNCE_MS } from "./GroupLabel"

const idea = (id: number, x: number | null, y: number | null, group_id: number | null, body = `idea ${id}`): Idea => ({
  id,
  retro_id: "r1",
  user_id: 1,
  category: "happy",
  body,
  x,
  y,
  group_id,
  assignee_id: null,
  inserted_at: "",
})

const group = (id: number, label: string | null = null, label_source: Group["label_source"] = null): Group => ({
  id,
  retro_id: "r1",
  label,
  label_source,
})

function setup({ ideas, groups = [], aiStatus = null }: { ideas: Idea[]; groups?: Group[]; aiStatus?: "grouping" | null }) {
  const handlers = new Map<string, (payload: unknown) => void>()
  const channel = {
    push: vi.fn().mockResolvedValue({}),
    on: vi.fn((event: string, cb: (payload: unknown) => void) => handlers.set(event, cb)),
  }
  const store = makeStore(channel as unknown as RetroChannel)
  const snapshot: Snapshot = {
    retro: { id: "r1", format: "happy_sad_confused", stage: "grouping", facilitator_id: 1, ai_status: aiStatus, inserted_at: "" },
    users: [
      { id: 1, name: "Ada Lovelace", given_name: "Ada", family_name: "Lovelace", picture: null },
      { id: 2, name: "Grace Hopper", given_name: "Grace", family_name: "Hopper", picture: null },
    ],
    ideas,
    groups,
    votes: [],
  }
  store.dispatch(snapshotReceived(snapshot))
  store.dispatch(currentUserSet(1))
  const utils = render(
    <Provider store={store}>
      <Board mode="grouping" />
    </Provider>,
  )
  const pushes = (event: string) => channel.push.mock.calls.filter(([e]) => e === event).map(([, p]) => p)
  return { ...utils, store, channel, handlers, pushes }
}

const card = (body: string) => screen.getByRole("button", { name: new RegExp(body) })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("Board drag", () => {
  it("throttles idea:drag pushes and sends one idea:move on drop", async () => {
    const { pushes, store } = setup({ ideas: [idea(1, 100, 100, 1)], groups: [group(1)] })
    const el = card("idea 1")

    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 0, clientY: 0, pointerType: "mouse" })
    for (let i = 1; i <= 10; i++) {
      fireEvent.pointerMove(el, { pointerId: 1, clientX: i * 10, clientY: i * 5, pointerType: "mouse" })
      act(() => vi.advanceTimersByTime(10))
    }
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 100, clientY: 50, pointerType: "mouse" })
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    const drags = pushes("idea:drag")
    // 100ms of movement at 50ms throttle: leading + ~1 trailing, never one per move.
    expect(drags.length).toBeGreaterThanOrEqual(2)
    expect(drags.length).toBeLessThanOrEqual(3)
    expect(drags[0]).toEqual({ id: 1, x: 110, y: 105 })
    expect(pushes("idea:move")).toEqual([{ id: 1, x: 200, y: 150 }])
    expect(store.getState().ideas.entities[1]).toMatchObject({ x: 200, y: 150 })
  })

  it("does not push on a click without movement", () => {
    const { pushes } = setup({ ideas: [idea(1, 0, 0, 1)] })
    const el = card("idea 1")
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 5, clientY: 5 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 6, clientY: 6 })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 6, clientY: 6 })
    expect(pushes("idea:drag")).toEqual([])
    expect(pushes("idea:move")).toEqual([])
  })

  it("refuses to drag while AI is busy", () => {
    const { pushes } = setup({ ideas: [idea(1, 0, 0, 1)], aiStatus: "grouping" })
    const el = card("idea 1")
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 50, clientY: 50 })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 50, clientY: 50 })
    expect(channel(pushes)).toEqual([])
    function channel(p: typeof pushes) {
      return [...p("idea:drag"), ...p("idea:move")]
    }
  })

  it("nudges a focused card with arrow keys", () => {
    const { pushes } = setup({ ideas: [idea(1, 0, 0, 1)] })
    const el = card("idea 1")
    el.focus()
    fireEvent.keyDown(el, { key: "ArrowRight" })
    fireEvent.keyDown(el, { key: "ArrowUp" })
    expect(pushes("idea:move")).toEqual([
      { id: 1, x: 10, y: 0 },
      { id: 1, x: 10, y: -10 },
    ])
  })

  it("animates and locks cards being dragged by someone else, then expires", () => {
    const { handlers, pushes } = setup({ ideas: [idea(1, 0, 0, 1)] })
    const onDragged = handlers.get("idea:dragged")!
    act(() => onDragged({ id: 1, x: 300, y: 40, user_id: 2 }))
    const el = card("idea 1")
    expect(el).toHaveAttribute("data-locked", "true")
    expect(el.style.transform).toContain("translate(300px, 40px)")
    expect(screen.getByLabelText("Grace is moving this")).toBeInTheDocument()

    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 50, clientY: 50 })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 50, clientY: 50 })
    expect(pushes("idea:move")).toEqual([])

    act(() => vi.advanceTimersByTime(3000))
    expect(el).not.toHaveAttribute("data-locked")
    expect(el.style.transform).toContain("translate(0px, 0px)")
  })

  it("ignores its own idea:dragged echoes", () => {
    const { handlers } = setup({ ideas: [idea(1, 0, 0, 1)] })
    act(() => handlers.get("idea:dragged")!({ id: 1, x: 300, y: 40, user_id: 1 }))
    expect(card("idea 1")).not.toHaveAttribute("data-locked")
  })

  it("registers idea:dragged once per channel even if the board remounts", () => {
    const { channel, unmount, store } = setup({ ideas: [idea(1, 0, 0, 1)] })
    unmount()
    render(
      <Provider store={store}>
        <Board mode="labeling" />
      </Provider>,
    )
    expect(channel.on.mock.calls.filter(([e]) => e === "idea:dragged")).toHaveLength(1)
  })

  it("renders nothing for unplaced ideas and action items, but lists unplaced", () => {
    const action = { ...idea(3, 0, 0, null, "action thing"), category: "action-item" as const }
    setup({ ideas: [idea(1, 0, 0, 1), idea(2, null, null, null, "floating"), action] })
    expect(screen.getAllByRole("button", { name: /^happy idea/ })).toHaveLength(1)
    expect(screen.getByText("1 unplaced idea")).toBeInTheDocument()
    expect(screen.queryByText("action thing")).not.toBeInTheDocument()
  })

  it("zooms with ctrl+wheel", () => {
    setup({ ideas: [idea(1, 0, 0, 1)] })
    fireEvent.wheel(screen.getByTestId("board"), { ctrlKey: true, deltaY: -50, clientX: 0, clientY: 0 })
    expect(screen.getByRole("button", { name: /Zoom 165%/ })).toBeInTheDocument()
  })
})

describe("Board group labels", () => {
  const grouped = () => [idea(1, 0, 0, 7), idea(2, 50, 40, 7), idea(3, 900, 0, 8)]

  it("shows one label per multi-idea group and debounces group:update", async () => {
    const { pushes } = setup({ ideas: grouped(), groups: [group(7), group(8)] })
    const inputs = screen.getAllByRole("textbox")
    expect(inputs).toHaveLength(1)
    const input = screen.getByLabelText("Label for group of 2 ideas")
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "Fo" } })
    act(() => vi.advanceTimersByTime(200))
    fireEvent.change(input, { target: { value: "Foo" } })
    act(() => vi.advanceTimersByTime(LABEL_DEBOUNCE_MS - 1))
    expect(pushes("group:update")).toEqual([])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(pushes("group:update")).toEqual([{ id: 7, label: "Foo" }])
  })

  it("preserves the local value while focused, accepts server values when not", () => {
    const { store } = setup({ ideas: grouped(), groups: [group(7), group(8)] })
    const input = screen.getByLabelText("Label for group of 2 ideas") as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "Mine" } })
    act(() => {
      store.dispatch(groupUpserted(group(7, "Theirs", "user")))
    })
    expect(input.value).toBe("Mine")

    fireEvent.blur(input)
    act(() => {
      store.dispatch(groupUpserted(group(7, "Later", "user")))
    })
    expect(input.value).toBe("Later")
  })

  it("flushes a pending label on blur", () => {
    const { pushes } = setup({ ideas: grouped(), groups: [group(7), group(8)] })
    const input = screen.getByLabelText("Label for group of 2 ideas")
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "Quick" } })
    fireEvent.blur(input)
    expect(pushes("group:update")).toEqual([{ id: 7, label: "Quick" }])
  })

  it("shows the AI badge for AI labels", () => {
    setup({ ideas: grouped(), groups: [group(7, "Tooling", "ai"), group(8)] })
    expect(screen.getByLabelText("Suggested by AI")).toBeInTheDocument()
  })

  it("label follows a group dragged as a whole before the server responds", () => {
    setup({ ideas: grouped(), groups: [group(7), group(8)] })
    const wrapper = () => screen.getByLabelText("Label for group of 2 ideas").closest("div")!
    const before = wrapper().style.transform
    const el = card("idea 1")
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 0, clientY: -30 })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 0, clientY: -30 })
    // Idea 1 moved up 30 and still overlaps idea 2 (x overlap 150, y overlap 50)
    expect(wrapper().style.transform).not.toBe(before)
    expect(wrapper().style.transform).toContain("-66px")
  })
})

describe("Board labeling mode", () => {
  it("counts unlabeled groups", () => {
    const store = makeStore({ push: vi.fn().mockResolvedValue({}), on: vi.fn() } as unknown as RetroChannel)
    store.dispatch(
      snapshotReceived({
        retro: { id: "r1", format: "happy_sad_confused", stage: "labeling", facilitator_id: 1, ai_status: null, inserted_at: "" },
        users: [],
        ideas: [idea(1, 0, 0, 7), idea(2, 50, 40, 7), idea(3, 900, 0, 8), idea(4, 950, 40, 8), idea(5, 2000, 0, 9)],
        groups: [group(7), group(8, "Done", "user"), group(9)],
        votes: [],
      }),
    )
    render(
      <Provider store={store}>
        <Board mode="labeling" />
      </Provider>,
    )
    expect(screen.getByRole("status")).toHaveTextContent("1 group unlabeled")
  })
})
