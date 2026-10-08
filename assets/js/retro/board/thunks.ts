import { createAsyncThunk, type ThunkAction, type UnknownAction } from "@reduxjs/toolkit"
import type { AppDispatch, RootState, ThunkExtra } from "../store"
import { groupUpserted, ideaMovedLocally, toastShown } from "../store/slices"
import { PushError } from "../channel"
import { RemoteDragStore } from "./remoteDrags"

// Like createAppAsyncThunk, but typed against the extra argument makeStore
// actually provides (`channel` may be undefined in tests/offline), which also
// keeps these dispatchable with the store's inferred AppDispatch.
const createBoardAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState
  dispatch: AppDispatch
  extra: Partial<ThunkExtra>
  rejectValue: string
}>()

type BoardThunk<R> = ThunkAction<R, RootState, Partial<ThunkExtra>, UnknownAction>

const reasonOf = (e: unknown) => (e instanceof PushError ? e.reason : e instanceof Error ? e.message : "unknown error")

/**
 * Broadcast-only drag position. Plain thunk (not createAsyncThunk) so the
 * 20 Hz stream doesn't dispatch pending/fulfilled actions through the store.
 */
export const pushDrag =
  (payload: { id: number; x: number; y: number }): BoardThunk<void> =>
  (_dispatch, _getState, extra) => {
    extra.channel?.push("idea:drag", payload).catch(() => {})
  }

/** Persist a drop; on rejection put the card back where it started. */
export const moveIdea = createBoardAsyncThunk(
  "board/moveIdea",
  async (
    { id, x, y, from }: { id: number; x: number; y: number; from?: { x: number; y: number } },
    { extra, dispatch, rejectWithValue },
  ) => {
    try {
      if (!extra.channel) throw new PushError("not connected")
      await extra.channel.push("idea:move", { id, x, y })
    } catch (e) {
      if (from) dispatch(ideaMovedLocally({ id, ...from }))
      const reason = reasonOf(e)
      dispatch(toastShown("error", `Couldn't move idea: ${reason}`))
      return rejectWithValue(reason)
    }
  },
)

/** Optimistically set a group label, then persist it. */
export const updateGroupLabel = createBoardAsyncThunk(
  "board/updateGroupLabel",
  async ({ id, label }: { id: number; label: string }, { extra, dispatch, getState, rejectWithValue }) => {
    const group = getState().groups.entities[id]
    if (group) dispatch(groupUpserted({ ...group, label: label.trim() || null, label_source: label.trim() ? "user" : null }))
    try {
      if (!extra.channel) throw new PushError("not connected")
      await extra.channel.push("group:update", { id, label })
    } catch (e) {
      if (group) dispatch(groupUpserted(group))
      const reason = reasonOf(e)
      dispatch(toastShown("error", `Couldn't save label: ${reason}`))
      return rejectWithValue(reason)
    }
  },
)

// One RemoteDragStore (and one `idea:dragged` registration) per channel
// instance: RetroChannel.on has no unsubscribe, so never register twice.
const storesByChannel = new WeakMap<object, RemoteDragStore>()

export const subscribeRemoteDrags = (): BoardThunk<RemoteDragStore> => (_dispatch, getState, extra) => {
  const channel = extra.channel
  if (!channel) return new RemoteDragStore()
  let store = storesByChannel.get(channel)
  if (!store) {
    const created = new RemoteDragStore()
    store = created
    storesByChannel.set(channel, created)
    channel.on("idea:dragged", ({ id, x, y, user_id }) => {
      if (user_id === getState().ui.currentUserId) return
      created.set(id, { x, y, userId: user_id })
    })
  }
  return store
}
