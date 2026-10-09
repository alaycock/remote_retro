import { useState } from "react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import {
  selectActionItems,
  selectAllUsers,
  selectCurrentUserId,
  selectIsFacilitator,
  selectUsersById,
} from "../store/selectors"
import { deleteIdea, updateIdea } from "../store/thunks"
import type { Idea } from "../types"
import { Avatar } from "./Avatar"
import { ConfirmDialog } from "./ConfirmDialog"
import { IdeaCard } from "./IdeaCard"

export function ActionItemList({ editable }: { editable: boolean }) {
  const dispatch = useAppDispatch()
  const items = useAppSelector(selectActionItems)
  const users = useAppSelector(selectUsersById)
  const allUsers = useAppSelector(selectAllUsers)
  const me = useAppSelector(selectCurrentUserId)
  const isFacilitator = useAppSelector(selectIsFacilitator)
  const [pendingDelete, setPendingDelete] = useState<Idea | null>(null)

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-base-content/50">No action items yet.</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const canEdit = editable && (item.user_id === me || isFacilitator)
          const assignee = item.assignee_id != null ? users[item.assignee_id] : undefined
          return (
            <IdeaCard
              key={item.id}
              idea={item}
              canEdit={canEdit}
              onSave={(body) => dispatch(updateIdea({ id: item.id, body }))}
              onDelete={() => setPendingDelete(item)}
              meta={
                canEdit ? (
                  <label className="-ml-1 flex items-center gap-1.5 rounded-field py-0.5 pl-1 focus-within:ring-2 focus-within:ring-primary/60">
                    {assignee ? (
                      <Avatar user={assignee} size="xs" />
                    ) : (
                      <span className="hero-user-micro size-3.5" aria-hidden="true" />
                    )}
                    <span className="sr-only">Owner</span>
                    <select
                      className="select select-ghost select-xs max-w-40 border-0 focus:outline-none focus-visible:outline-none"
                      value={item.assignee_id ?? ""}
                      onChange={(e) => dispatch(updateIdea({ id: item.id, assignee_id: Number(e.target.value) }))}
                    >
                      {item.assignee_id == null && <option value="">Unassigned</option>}
                      {allUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {assignee ? (
                      <Avatar user={assignee} size="xs" />
                    ) : (
                      <span className="hero-user-micro size-3.5" aria-hidden="true" />
                    )}
                    {assignee?.name ?? "Unassigned"}
                  </span>
                )
              }
            />
          )
        })}
      </ul>
      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete this action item?"
        confirmLabel="Delete"
        tone="error"
        onConfirm={() => {
          if (pendingDelete) dispatch(deleteIdea(pendingDelete.id))
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      >
        {pendingDelete && <p className="break-words whitespace-pre-wrap">“{pendingDelete.body}”</p>}
      </ConfirmDialog>
    </>
  )
}
