import { useEffect, useId, useRef, useState } from "react"
import { Board } from "../board/Board"
import { CategoryIcon } from "../components/CategoryIcon"
import { MAX_LABEL_LENGTH } from "../constants"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectAiStatus, selectGroupsWithIdeas, type GroupWithIdeas } from "../store/selectors"
import { updateGroupLabel } from "../store/thunks"

type View = "list" | "board"
const SAVE_DEBOUNCE_MS = 400

/**
 * Group & label: the board for dragging ideas into groups (labels float above each
 * group), and a list view for naming groups clearly. Same data, two views. Always
 * opens on the board; the List choice lasts only while you're in the stage.
 */
export function Grouping() {
  const [view, choose] = useState<View>("board")

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-base-300 bg-base-100 px-4 py-2">
        <div role="tablist" aria-label="Grouping view" className="tabs tabs-box tabs-sm">
          {(["board", "list"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={`tab gap-1.5 ${view === key ? "tab-active" : ""}`}
              onClick={() => choose(key)}
            >
              <span className={`${key === "list" ? "hero-list-bullet-micro" : "hero-squares-2x2-micro"} size-4`} aria-hidden="true" />
              {key === "list" ? "List" : "Board"}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">{view === "list" ? <LabelList onRegroup={() => choose("board")} /> : <Board mode="grouping" />}</div>
    </div>
  )
}

function LabelList({ onRegroup }: { onRegroup: () => void }) {
  const groups = useAppSelector(selectGroupsWithIdeas)
  const multi = groups.filter((g) => g.ideas.length > 1)
  const singles = groups.filter((g) => g.ideas.length === 1)
  const unlabeled = multi.filter((g) => !g.label).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Name each group</h1>
            <p className="text-sm text-base-content/70">
              Give each group a short title so it's easy to vote on. To change the groups,{" "}
              <button type="button" className="link" onClick={onRegroup}>
                switch to the board
              </button>
              .
            </p>
          </div>
          {multi.length > 0 && (
            <span className={`badge ${unlabeled ? "badge-warning badge-soft" : "badge-success badge-soft"}`} role="status">
              {unlabeled ? `${unlabeled} of ${multi.length} unlabeled` : "All groups labeled"}
            </span>
          )}
        </header>

        {multi.length === 0 ? (
          <p className="rounded-box border border-dashed border-base-300 p-6 text-center text-sm text-base-content/60">
            No groups yet — every idea stands on its own. Drag ideas together on the board to group them.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {multi.map((group) => (
              <li key={group.id}>
                <GroupLabelCard group={group} />
              </li>
            ))}
          </ul>
        )}

        {singles.length > 0 && (
          <section aria-labelledby="ungrouped-heading" className="space-y-2">
            <h2 id="ungrouped-heading" className="text-sm font-semibold text-base-content/70">
              Ungrouped ideas ({singles.length})
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {singles.map((group) => (
                <li key={group.id} className="flex items-start gap-2 rounded-box bg-base-100 p-3 text-sm shadow-sm">
                  <CategoryIcon category={group.ideas[0].category} size="sm" labelled />
                  <span className="min-w-0 break-words">{group.ideas[0].body}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function GroupLabelCard({ group }: { group: GroupWithIdeas }) {
  const inputId = useId()
  return (
    <article className={`card h-full bg-base-100 shadow-sm ${group.label ? "" : "ring-2 ring-warning/40"}`}>
      <div className="card-body gap-3 p-4">
        <LabelInput id={inputId} group={group} />
        <ul className="space-y-1.5 text-sm text-base-content/80">
          {group.ideas.map((idea) => (
            <li key={idea.id} className="flex items-start gap-2">
              <CategoryIcon category={idea.category} size="sm" labelled />
              <span className="min-w-0 break-words">{idea.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/** Debounced label field; keeps the user's text while focused even if a server echo arrives. */
function LabelInput({ id, group }: { id: string; group: GroupWithIdeas }) {
  const dispatch = useAppDispatch()
  const aiBusy = useAppSelector(selectAiStatus) != null
  const [value, setValue] = useState(group.label ?? "")
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!focused.current) setValue(group.label ?? "")
  }, [group.label])

  useEffect(() => () => clearTimeout(timer.current), [])

  const save = (label: string) => {
    clearTimeout(timer.current)
    if (label.trim() !== (group.label ?? "")) void dispatch(updateGroupLabel({ id: group.id, label }))
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Label for group of {group.ideas.length} ideas
      </label>
      <input
        id={id}
        className="input input-sm w-full font-semibold"
        placeholder="Add a label"
        maxLength={MAX_LABEL_LENGTH}
        value={value}
        disabled={aiBusy}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          save(value)
        }}
        onChange={(e) => {
          const next = e.target.value
          setValue(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => save(next), SAVE_DEBOUNCE_MS)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
        }}
      />
      {group.label_source === "ai" && group.label && (
        <span className="badge badge-secondary badge-soft badge-sm shrink-0 gap-1" title="Suggested by Gemini">
          <span className="hero-sparkles-micro size-3.5" aria-hidden="true" />
          AI
        </span>
      )}
    </div>
  )
}
