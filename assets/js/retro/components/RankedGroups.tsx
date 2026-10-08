import { useAppSelector } from "../store/hooks"
import { selectRankedGroups } from "../store/selectors"
import { GroupCard } from "./GroupCard"

/** Groups ordered by total votes, with tallies. Read-only. */
export function RankedGroups() {
  const groups = useAppSelector(selectRankedGroups)
  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-base-content/50">No groups to discuss.</p>
  }
  return (
    <ol className="flex flex-col gap-2">
      {groups.map((group, i) => (
        <li key={group.id}>
          <GroupCard
            compact
            group={group}
            badge={
              <span className="badge badge-ghost badge-sm shrink-0 tabular-nums" aria-label={`Rank ${i + 1}`}>
                #{i + 1}
              </span>
            }
            footer={
              <span className={`badge badge-sm ${group.voteCount > 0 ? "badge-primary" : "badge-ghost"}`}>
                {group.voteCount} {group.voteCount === 1 ? "vote" : "votes"}
              </span>
            }
          />
        </li>
      ))}
    </ol>
  )
}
