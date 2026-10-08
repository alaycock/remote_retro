import type { ReactNode } from "react"
import { CategoryIcon } from "./CategoryIcon"
import { groupTitle, type GroupWithIdeas } from "../store/selectors"

interface GroupCardProps {
  group: GroupWithIdeas
  /** Rendered in the card's footer (vote controls, tallies…). */
  footer?: ReactNode
  /** Rendered next to the title (e.g. rank). */
  badge?: ReactNode
  compact?: boolean
}

/** A group of ideas; singletons show the lone idea's text as the title. */
export function GroupCard({ group, footer, badge, compact = false }: GroupCardProps) {
  const title = groupTitle(group)
  const singleton = group.ideas.length === 1
  const titleId = `group-${group.id}-title`

  return (
    <article aria-labelledby={titleId} className="card h-full bg-base-100 shadow-sm">
      <div className={`card-body gap-2 ${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-start gap-2">
          {badge}
          <h3
            id={titleId}
            className={`min-w-0 flex-1 break-words ${singleton && !group.label ? "text-sm" : "font-semibold"} ${title ? "" : "text-base-content/50 italic"}`}
          >
            {singleton && !group.label && (
              <span className="mr-1.5 inline-block align-[-5px]">
                <CategoryIcon category={group.ideas[0].category} />
              </span>
            )}
            {title ?? "Unlabeled group"}
          </h3>
        </div>
        {!singleton && (
          <ul className="space-y-1 text-sm text-base-content/75">
            {group.ideas.map((idea) => (
              <li key={idea.id} className="flex gap-1.5">
                <CategoryIcon category={idea.category} size="sm" labelled />
                <span className="min-w-0 break-words">{idea.body}</span>
              </li>
            ))}
          </ul>
        )}
        {footer && <div className="mt-auto pt-1">{footer}</div>}
      </div>
    </article>
  )
}
