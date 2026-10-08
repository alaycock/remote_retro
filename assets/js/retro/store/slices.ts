import { createEntityAdapter, createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { Group, Idea, IdeaPosition, PresenceState, Retro, Snapshot, User, Vote } from "../types"

export const snapshotReceived = (snapshot: Snapshot) => ({ type: "snapshot/received", payload: snapshot }) as const
const isSnapshot = (action: { type: string }): action is ReturnType<typeof snapshotReceived> =>
  action.type === "snapshot/received"

// Optimistic ideas carry temporary negative ids (-1, -2, …). Sort them after every saved
// idea, in creation order, so a new idea appears where it will end up (at the bottom)
// instead of jumping from the top once the server assigns its real id.
const ideaSortKey = (id: number) => (id < 0 ? Number.MAX_SAFE_INTEGER / 2 - id : id)
export const ideasAdapter = createEntityAdapter<Idea>({ sortComparer: (a, b) => ideaSortKey(a.id) - ideaSortKey(b.id) })
export const groupsAdapter = createEntityAdapter<Group>({ sortComparer: (a, b) => a.id - b.id })
export const votesAdapter = createEntityAdapter<Vote>()
export const usersAdapter = createEntityAdapter<User>()

export const retroSlice = createSlice({
  name: "retro",
  initialState: null as Retro | null,
  reducers: {
    retroUpdated: (_state, action: PayloadAction<Retro>) => action.payload,
  },
  extraReducers: (builder) => builder.addMatcher(isSnapshot, (_state, action) => action.payload.retro),
})

export const ideasSlice = createSlice({
  name: "ideas",
  initialState: ideasAdapter.getInitialState(),
  reducers: {
    ideaUpserted: ideasAdapter.upsertOne,
    ideaRemoved: ideasAdapter.removeOne,
    ideaPositionsSynced: (state, action: PayloadAction<IdeaPosition[]>) => {
      ideasAdapter.updateMany(
        state,
        action.payload.map(({ id, ...changes }) => ({ id, changes })),
      )
    },
    ideaMovedLocally: (state, action: PayloadAction<{ id: number; x: number; y: number }>) => {
      const { id, x, y } = action.payload
      ideasAdapter.updateOne(state, { id, changes: { x, y } })
    },
  },
  extraReducers: (builder) =>
    builder.addMatcher(isSnapshot, (state, action) => ideasAdapter.setAll(state, action.payload.ideas)),
})

export const groupsSlice = createSlice({
  name: "groups",
  initialState: groupsAdapter.getInitialState(),
  reducers: {
    groupUpserted: groupsAdapter.upsertOne,
    groupsReplaced: groupsAdapter.setAll,
  },
  extraReducers: (builder) =>
    builder.addMatcher(isSnapshot, (state, action) => groupsAdapter.setAll(state, action.payload.groups)),
})

export const votesSlice = createSlice({
  name: "votes",
  initialState: votesAdapter.getInitialState(),
  reducers: {
    voteAdded: votesAdapter.upsertOne,
    voteRemoved: votesAdapter.removeOne,
  },
  extraReducers: (builder) =>
    builder.addMatcher(isSnapshot, (state, action) => votesAdapter.setAll(state, action.payload.votes)),
})

export const usersSlice = createSlice({
  name: "users",
  initialState: usersAdapter.getInitialState(),
  reducers: {
    userUpserted: usersAdapter.upsertOne,
  },
  extraReducers: (builder) =>
    builder.addMatcher(isSnapshot, (state, action) => usersAdapter.setAll(state, action.payload.users)),
})

export const presenceSlice = createSlice({
  name: "presence",
  initialState: { onlineUserIds: [] as number[], typingUserIds: [] as number[] },
  reducers: {
    presenceSynced: (state, action: PayloadAction<PresenceState>) => {
      state.onlineUserIds = Object.values(action.payload).map((p) => p.metas[0].user_id)
    },
    userTyping: (state, action: PayloadAction<{ userId: number; typing: boolean }>) => {
      const { userId, typing } = action.payload
      state.typingUserIds = state.typingUserIds.filter((id) => id !== userId)
      if (typing) state.typingUserIds.push(userId)
    },
  },
})

export interface Toast {
  id: number
  kind: "error" | "info"
  message: string
}

export const uiSlice = createSlice({
  name: "ui",
  initialState: { currentUserId: 0, toasts: [] as Toast[], connected: false, devTools: false, aiEnabled: false },
  reducers: {
    devToolsEnabled: (state) => {
      state.devTools = true
    },
    currentUserSet: (state, action: PayloadAction<number>) => {
      state.currentUserId = action.payload
    },
    connectedChanged: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload
    },
    toastShown: {
      reducer: (state, action: PayloadAction<Toast>) => {
        state.toasts.push(action.payload)
      },
      prepare: (kind: Toast["kind"], message: string) => ({ payload: { id: Date.now() + Math.random(), kind, message } }),
    },
    toastDismissed: (state, action: PayloadAction<number>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
  },
  extraReducers: (builder) =>
    builder.addMatcher(isSnapshot, (state, action) => {
      state.aiEnabled = action.payload.ai_enabled === true
    }),
})

export const { retroUpdated } = retroSlice.actions
export const { ideaUpserted, ideaRemoved, ideaPositionsSynced, ideaMovedLocally } = ideasSlice.actions
export const { groupUpserted, groupsReplaced } = groupsSlice.actions
export const { voteAdded, voteRemoved } = votesSlice.actions
export const { userUpserted } = usersSlice.actions
export const { presenceSynced, userTyping } = presenceSlice.actions
export const { currentUserSet, devToolsEnabled, connectedChanged, toastShown, toastDismissed } = uiSlice.actions
