import { useId, useState, type FormEvent } from "react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectAllUsers } from "../store/selectors"
import { createIdea } from "../store/thunks"
import { CharCount } from "./CharCount"
import { ENTER_HINT, submitOnEnter } from "./keyboard"
import { validateIdeaBody } from "./validation"

export function ActionItemForm() {
  const dispatch = useAppDispatch()
  const users = useAppSelector(selectAllUsers)
  const [body, setBody] = useState("")
  const [chosenAssigneeId, setAssigneeId] = useState("")
  // Default to the first participant; keep an explicit choice while that person is still listed.
  const assigneeId = users.some((u) => String(u.id) === chosenAssigneeId)
    ? chosenAssigneeId
    : String(users[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const bodyId = useId()
  const assigneeFieldId = useId()
  const hintId = useId()

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const problem = validateIdeaBody(body) ?? (assigneeId ? null : "Choose who owns this action item.")
    if (problem) {
      setError(problem)
      return
    }
    const submitted = body.trim()
    setBody("")
    setError(null)
    const result = await dispatch(
      createIdea({ category: "action-item", body: submitted, assignee_id: Number(assigneeId) }),
    )
    if (createIdea.rejected.match(result)) setBody((current) => current || submitted)
  }

  return (
    <form onSubmit={submit} noValidate className="card bg-base-100 shadow-sm" aria-label="Add an action item">
      <div className="card-body gap-3 p-4">
        <h2 className="card-title text-base">New action item</h2>
        <div>
          <label htmlFor={bodyId} className="sr-only">
            Action item
          </label>
          <textarea
            id={bodyId}
            className="textarea w-full resize-none"
            rows={3}
            placeholder="What will the team do next?"
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => submitOnEnter(e, () => void submit())}
            aria-describedby={hintId}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span id={hintId} className="text-xs text-base-content/50">
              {ENTER_HINT}
            </span>
            <CharCount value={body} />
          </div>
        </div>
        <div>
          <label htmlFor={assigneeFieldId} className="mb-1 block text-sm font-medium">
            Owner
          </label>
          <select
            id={assigneeFieldId}
            className="select w-full"
            value={assigneeId}
            onChange={(e) => {
              setAssigneeId(e.target.value)
              if (error) setError(null)
            }}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          <span className="hero-plus size-4" aria-hidden="true" />
          Add action item
        </button>
      </div>
    </form>
  )
}
