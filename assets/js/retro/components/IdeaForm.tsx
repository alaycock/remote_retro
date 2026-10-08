import { useId, useState, type FormEvent, type KeyboardEvent } from "react"
import { CATEGORY_META } from "../categories"
import { CategoryIcon } from "./CategoryIcon"
import { submitOnEnter } from "./keyboard"
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
  const categoryName = useId()

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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => submitOnEnter(e, () => void submit())

  return (
    <form onSubmit={submit} noValidate className="card bg-base-100 shadow-sm" aria-label="Submit an idea">
      <div className="card-body gap-3 p-3 sm:p-4">
        {/* On wide screens the row stretches, so the text box is exactly as tall as the
            category stack beside it. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <fieldset className="sm:w-40 sm:shrink-0">
            <legend className="sr-only">Category</legend>
            {/* Native radios (arrow keys move between them) styled as stacked buttons;
                a single row on narrow screens. */}
            <div className="join w-full sm:join-vertical">
              {categories.map((c) => (
                <label
                  key={c}
                  className={[
                    "btn btn-md join-item flex-1 justify-start gap-2 font-medium sm:w-full sm:flex-none",
                    "has-[:checked]:z-10 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name={categoryName}
                    value={c}
                    checked={c === category}
                    onChange={() => onCategoryChange(c)}
                    className="sr-only"
                  />
                  <CategoryIcon category={c} />
                  {CATEGORY_META[c].label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-1 flex-col">
            <label htmlFor={bodyId} className="sr-only">
              Idea
            </label>
            <textarea
              id={bodyId}
              className={`textarea w-full resize-none sm:min-h-0 sm:flex-1 ${error ? "textarea-error" : ""}`}
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
          </div>
          <button type="submit" className="btn btn-primary sm:self-start">
            <span className="hero-plus size-4" aria-hidden="true" />
            Add idea
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          {error ? (
            <span id={errorId} className="text-error">
              {error}
            </span>
          ) : (
            <span className="hidden text-base-content/50 sm:inline">Press Enter to submit, Shift+Enter for a new line.</span>
          )}
          <span className="ml-auto">
            <CharCount value={body} />
          </span>
        </div>
      </div>
    </form>
  )
}
