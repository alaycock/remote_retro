import { VOTE_LIMIT } from "../constants"
import { GroupCard } from "../components/GroupCard"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectGroupsWithIdeas, selectMyVotesLeft, type GroupWithIdeas } from "../store/selectors"
import { createVote, retractVoteOnGroup } from "../store/thunks"

export function VotesLeft({ left }: { left: number }) {
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: VOTE_LIMIT }, (_, i) => (
          <span
            key={i}
            className={`size-3 rounded-full transition-colors ${i < left ? "bg-primary" : "bg-base-300"}`}
          />
        ))}
      </span>
      <span className="text-sm font-medium">
        {left === 0 ? "All votes used" : `${left} ${left === 1 ? "vote" : "votes"} left`}
      </span>
    </div>
  )
}

function VoteControls({ group, votesLeft }: { group: GroupWithIdeas; votesLeft: number }) {
  const dispatch = useAppDispatch()
  const name = group.label ?? (group.ideas.length === 1 ? group.ideas[0].body : "this group")
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-base-content/70">
        {group.myVoteCount > 0 ? (
          <span className="badge badge-primary badge-sm">
            {group.myVoteCount} {group.myVoteCount === 1 ? "vote" : "votes"} from you
          </span>
        ) : (
          <span className="text-base-content/40">No votes from you</span>
        )}
      </span>
      <span className="join">
        <button
          type="button"
          className="btn btn-sm join-item"
          disabled={group.myVoteCount === 0}
          onClick={() => dispatch(retractVoteOnGroup(group.id))}
          aria-label={`Remove a vote from ${name}`}
          title="Remove a vote"
        >
          <span className="hero-minus size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary join-item"
          disabled={votesLeft === 0}
          onClick={() => dispatch(createVote(group.id))}
          aria-label={`Vote for ${name}`}
          title="Vote"
        >
          <span className="hero-plus size-4" aria-hidden="true" />
          Vote
        </button>
      </span>
    </div>
  )
}

export function Voting() {
  const groups = useAppSelector(selectGroupsWithIdeas)
  const votesLeft = useAppSelector(selectMyVotesLeft)

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4">
      <div className="sticky top-0 z-10 -mx-3 mb-4 flex flex-wrap items-center justify-between gap-2 bg-base-200/90 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <div>
          <h1 className="text-lg font-semibold">Vote on what matters most</h1>
          <p className="text-sm text-base-content/60">Voting is blind. Totals are revealed in the next stage.</p>
        </div>
        <VotesLeft left={votesLeft} />
      </div>
      {groups.length === 0 ? (
        <p className="py-16 text-center text-base-content/60">There's nothing to vote on yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} footer={<VoteControls group={group} votesLeft={votesLeft} />} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
