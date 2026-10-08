import { useId, useState, type FormEvent, type KeyboardEvent } from "react"
import { CATEGORY_META } from "../categories"
import { useThrottle } from "../hooks/useThrottle"
import { useAppDispatch } from "../store/hooks"
import { createIdea, sendTyping } from "../store/thunks"
import type { Category } from "../types"
import { CharCount } from "./CharCount"
import { validateIdeaBody } from "./validation"

interface IdeaFormProps {
  categories: readonly Category[]
  category: Category
  onCategoryChange: (category: Category) => void
}

const TYPING_THROTTLE_MS = 2000

export function IdeaForm({ categories, category, onCategoryChange }: IdeaFormProps) {
  const dispatch = useAppDispatch()
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const notifyTyping = useThrottle(() => dispatch(sendTyping()), TYPING_THROTTLE_MS)
  const bodyId = useId()
  const errorId = useId()
  const categoryId = useId()

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const problem = validateIdeaBody(body)
    if (problem) {
      setError(problem)
      return
    }
    const submitted = body.trim()
    setBody("")
    setError(null)
    const result = await dispatch(createIdea({ category, body: submitted }))
    // Restore the text if the server rejected it and the user hasn't started a new one.
    if (createIdea.rejected.match(result)) setBody((current) => current || submitted)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card bg-base-100 shadow-sm" aria-label="Submit an idea">
      <div className="card-body gap-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="sm:w-40">
            <label htmlFor={categoryId} className="sr-only">
              Category
            </label>
            <select
              id={categoryId}
              className="select w-full"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value as Category)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor={bodyId} className="sr-only">
              Idea
            </label>
            <textarea
              id={bodyId}
              className={`textarea w-full resize-none ${error ? "textarea-error" : ""}`}
              rows={2}
              placeholder={CATEGORY_META[category].prompt}
              value={body}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => {
                setBody(e.target.value)
                if (error) setError(validateIdeaBody(e.target.value))
                notifyTyping()
              }}
              onKeyDown={onKeyDown}
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span id={errorId} className="text-xs text-error">
                {error}
              </span>
              <CharCount value={body} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary sm:self-start">
            <span className="hero-plus size-4" aria-hidden="true" />
            Add idea
          </button>
        </div>
        <p className="hidden text-xs text-base-content/50 sm:block">Press Enter to submit, Shift+Enter for a new line.</p>
      </div>
    </form>
  )
}
