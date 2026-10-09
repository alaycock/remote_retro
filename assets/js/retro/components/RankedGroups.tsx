import { useAppSelector } from "../store/hooks"
import { selectRankedGroups } from "../store/selectors"
import { GroupCard } from "./GroupCard"

/** Groups ordered by total votes, with tallies. Read-only. */
export function RankedGroups({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const groups = useAppSelector(selectRankedGroups)
  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-base-content/50">No groups to discuss.</p>
  }
  return (
    <ol className="flex flex-col gap-2">
      {groups.map((group) => (
        <li key={group.id}>
          <GroupCard
            compact
            headingLevel={headingLevel}
            group={group}
            badge={
              <span
                className={`badge badge-sm shrink-0 gap-1 tabular-nums ${group.voteCount > 0 ? "badge-primary" : "badge-ghost"}`}
              >
                <span className="hero-hand-raised-micro size-3.5" aria-hidden="true" />
                {group.voteCount} {group.voteCount === 1 ? "vote" : "votes"}
              </span>
            }
          />
        </li>
      ))}
    </ol>
  )
}
