import { useAppSelector } from "../store/hooks"
import { selectPresentUsers, selectStage } from "../store/selectors"
import { StageControls } from "./StageControls"
import { StageStepper } from "./StageStepper"
import { StageTimer } from "./StageTimer"
import { ThemeToggle } from "./ThemeToggle"
import { AvatarStack } from "./UserList"

interface HeaderProps {
  onShowHelp: (() => void) | null
  onShowParticipants: () => void
}

export function Header({ onShowHelp, onShowParticipants }: HeaderProps) {
  const stage = useAppSelector(selectStage)
  const users = useAppSelector(selectPresentUsers)

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-base-300 bg-base-100 px-3 py-2 sm:px-4">
      <a href="/retros" className="flex items-center gap-2 font-semibold" title="Your retros">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-content">
          <span className="hero-arrow-path-rounded-square-micro size-4" aria-hidden="true" />
        </span>
        <span className="hidden sm:inline">Remote Retro</span>
      </a>

      <div className="min-w-0 flex-1">{stage && <StageStepper stage={stage} />}</div>

      <div className="flex items-center gap-1">
        <StageTimer />
        {onShowHelp && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onShowHelp}
            aria-label="Stage guidance"
            title="Stage guidance"
          >
            <span className="hero-question-mark-circle size-5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm lg:hidden"
          onClick={onShowParticipants}
          aria-label={`Show participants (${users.length} here)`}
        >
          <AvatarStack users={users} />
        </button>
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex w-full justify-end empty:hidden sm:w-auto">
        <StageControls />
      </div>
    </header>
  )
}
