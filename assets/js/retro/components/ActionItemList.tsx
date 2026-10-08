import { useAppDispatch, useAppSelector } from "../store/hooks"
import {
  selectActionItems,
  selectAllUsers,
  selectCurrentUserId,
  selectIsFacilitator,
  selectUsersById,
} from "../store/selectors"
import { deleteIdea, updateIdea } from "../store/thunks"
import { Avatar } from "./Avatar"
import { IdeaCard } from "./IdeaCard"

export function ActionItemList({ editable }: { editable: boolean }) {
  const dispatch = useAppDispatch()
  const items = useAppSelector(selectActionItems)
  const users = useAppSelector(selectUsersById)
  const allUsers = useAppSelector(selectAllUsers)
  const me = useAppSelector(selectCurrentUserId)
  const isFacilitator = useAppSelector(selectIsFacilitator)

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-base-content/50">No action items yet.</p>
  }

  return (
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
            onDelete={() => dispatch(deleteIdea(item.id))}
            meta={
              canEdit ? (
                <label className="flex items-center gap-1.5">
                  {assignee ? (
                    <Avatar user={assignee} size="xs" />
                  ) : (
                    <span className="hero-user-micro size-3.5" aria-hidden="true" />
                  )}
                  <span className="sr-only">Owner</span>
                  <select
                    className="select select-ghost select-xs max-w-40"
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
  )
}
