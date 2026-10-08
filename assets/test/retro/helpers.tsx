import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { Provider } from "react-redux"
import { vi } from "vitest"
import type { RetroChannel } from "../../js/retro/channel"
import { makeStore } from "../../js/retro/store"
import { currentUserSet, presenceSynced, snapshotReceived } from "../../js/retro/store/slices"
import type { Group, Idea, Retro, Snapshot, User, Vote } from "../../js/retro/types"

export const ada: User = { id: 1, name: "Ada Lovelace", given_name: "Ada", family_name: "Lovelace", picture: null }
export const bob: User = { id: 2, name: "Bob Builder", given_name: "Bob", family_name: "Builder", picture: null }

export const retro = (overrides: Partial<Retro> = {}): Retro => ({
  id: "r1",
  format: "happy_sad_confused",
  stage: "idea-generation",
  facilitator_id: 1,
  ai_status: null,
  inserted_at: "",
  ...overrides,
})

export const idea = (overrides: Partial<Idea> & { id: number }): Idea => ({
  retro_id: "r1",
  user_id: 1,
  category: "happy",
  body: `idea ${overrides.id}`,
  x: null,
  y: null,
  group_id: null,
  assignee_id: null,
  inserted_at: "",
  ...overrides,
})

export const group = (id: number, label: string | null = null): Group => ({
  id,
  retro_id: "r1",
  label,
  label_source: label ? "user" : null,
})

export const vote = (id: number, user_id: number, group_id: number): Vote => ({ id, user_id, group_id })

export function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return { retro: retro(), users: [ada, bob], ideas: [], groups: [], votes: [], ...overrides }
}

export function mockChannel(impl?: (event: string, payload: unknown) => Promise<unknown>) {
  const push = vi.fn(impl ?? (() => Promise.resolve({})))
  return { channel: { push } as unknown as RetroChannel, push }
}

export function setup(
  snap: Snapshot = snapshot(),
  { userId = 1, online = [1, 2], channel = mockChannel().channel } = {},
) {
  const store = makeStore(channel)
  store.dispatch(currentUserSet(userId))
  store.dispatch(snapshotReceived(snap))
  store.dispatch(
    presenceSynced(Object.fromEntries(online.map((id) => [String(id), { metas: [{ user_id: id, online_at: 0, phx_ref: "x" }] }]))),
  )
  return store
}

export function renderWithStore(ui: ReactElement, store: ReturnType<typeof makeStore>) {
  return { store, ...render(<Provider store={store}>{ui}</Provider>) }
}
