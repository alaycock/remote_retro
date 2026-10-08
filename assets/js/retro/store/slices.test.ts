import { makeStore } from "./index"
import { ideaPositionsSynced, snapshotReceived } from "./slices"
import type { Snapshot } from "../types"

const snapshot: Snapshot = {
  retro: { id: "r1", format: "happy_sad_confused", stage: "grouping", facilitator_id: 1, ai_status: null, inserted_at: "" },
  users: [{ id: 1, name: "Ada Lovelace", given_name: "Ada", family_name: "Lovelace", picture: null }],
  ideas: [
    { id: 2, retro_id: "r1", user_id: 1, category: "happy", body: "b", x: 0, y: 0, group_id: null, assignee_id: null, inserted_at: "" },
  ],
  groups: [],
  votes: [],
}

describe("store", () => {
  it("replaces state from a snapshot and applies group sync positions", () => {
    const store = makeStore()
    store.dispatch(snapshotReceived(snapshot))
    store.dispatch(ideaPositionsSynced([{ id: 2, group_id: 9, x: 10, y: 20 }]))
    const state = store.getState()
    expect(state.retro?.stage).toBe("grouping")
    expect(state.ideas.entities[2]).toMatchObject({ group_id: 9, x: 10, y: 20 })
  })
})
