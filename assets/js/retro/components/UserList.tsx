import { useId, useState } from "react"
import { VOTE_LIMIT } from "../constants"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import {
  selectCurrentUserId,
  selectIsFacilitator,
  selectPresentUsers,
  selectRetro,
  selectTypingUserIds,
  selectVoteCountsByUser,
} from "../store/selectors"
import { handOffFacilitator } from "../store/thunks"
import type { User } from "../types"
import { Avatar } from "./Avatar"
import { ConfirmDialog } from "./ConfirmDialog"

/** Online participants with facilitator badge, per-stage status and facilitator hand-off. */
export function UserList() {
  const dispatch = useAppDispatch()
  const users = useAppSelector(selectPresentUsers)
  const retro = useAppSelector(selectRetro)
  const currentUserId = useAppSelector(selectCurrentUserId)
  const isFacilitator = useAppSelector(selectIsFacilitator)
  const typing = useAppSelector(selectTypingUserIds)
  const voteCounts = useAppSelector(selectVoteCountsByUser)
  const [handOffTo, setHandOffTo] = useState<User | null>(null)
  const headingId = useId()

  const stage = retro?.stage

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 flex items-center gap-2 text-sm font-semibold">
        Here now <span className="badge badge-sm badge-ghost">{users.length}</span>
      </h2>
      <ul className="space-y-1">
        {users.map((user) => {
          const facilitator = user.id === retro?.facilitator_id
          const votes = voteCounts[user.id] ?? 0
          return (
            <li key={user.id} className="group flex items-center gap-2 rounded-box px-1 py-1.5 hover:bg-base-200">
              <div className="relative">
                <Avatar user={user} />
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-base-100"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm leading-tight">
                  {user.name}
                  {user.id === currentUserId && <span className="text-base-content/50"> (you)</span>}
                </p>
                <p className="flex items-center gap-1 text-xs text-base-content/60">
                  {facilitator && <span className="badge badge-xs badge-primary">Facilitator</span>}
                  {stage === "idea-generation" && typing.includes(user.id) && <span>typing…</span>}
                  {stage === "voting" &&
                    (votes >= VOTE_LIMIT ? (
                      <span className="text-success">
                        <span className="hero-check-circle-micro size-3.5 align-[-3px]" aria-hidden="true" /> votes in
                      </span>
                    ) : (
                      <span>
                        {votes}/{VOTE_LIMIT} votes
                      </span>
                    ))}
                </p>
              </div>
              {isFacilitator && !facilitator && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setHandOffTo(user)}
                  aria-label={`Make ${user.name} the facilitator`}
                  title="Make facilitator"
                >
                  <span className="hero-arrows-right-left size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={handOffTo != null}
        title="Hand off facilitation"
        confirmLabel="Hand off"
        onCancel={() => setHandOffTo(null)}
        onConfirm={() => {
          if (handOffTo) dispatch(handOffFacilitator(handOffTo.id))
          setHandOffTo(null)
        }}
      >
        Make {handOffTo?.name} the facilitator? They'll control the stages and you won't be able to undo this
        yourself.
      </ConfirmDialog>
    </section>
  )
}

/** Overlapping avatars used as a compact trigger on small screens. */
export function AvatarStack({ users, max = 4 }: { users: User[]; max?: number }) {
  const shown = users.slice(0, max)
  const extra = users.length - shown.length
  return (
    <span className="flex -space-x-2">
      {shown.map((user) => (
        <Avatar key={user.id} user={user} size="xs" />
      ))}
      {extra > 0 && (
        <span className="inline-grid size-6 place-items-center rounded-full bg-base-300 text-[0.6rem] font-semibold ring-2 ring-base-100">
          +{extra}
        </span>
      )}
    </span>
  )
}
