import { useEffect, useRef, useState } from "react"
import { AiBusyOverlay } from "./components/AiBusyOverlay"
import { ConnectionBanner } from "./components/ConnectionBanner"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { Header } from "./components/Header"
import { Modal } from "./components/Modal"
import { Toasts } from "./components/Toasts"
import { UserList } from "./components/UserList"
import { STAGE_CONFIGS } from "./stages"
import { useAppSelector } from "./store/hooks"
import { selectAiStatus, selectRetro } from "./store/selectors"

/** The retro room: header + stepper, current stage, participants, overlays. */
export function App() {
  const retro = useAppSelector(selectRetro)
  const aiBusy = useAppSelector(selectAiStatus) != null
  const [helpOpen, setHelpOpen] = useState(false)
  const [participantsOpen, setParticipantsOpen] = useState(false)

  // Show the stage guidance whenever the stage changes (not on first load). If Gemini
  // starts working on entry, wait until it's done: a native dialog sits in the top
  // layer and would otherwise cover the busy overlay.
  const previousStage = useRef(retro?.stage)
  const [helpPending, setHelpPending] = useState(false)
  useEffect(() => {
    if (!retro) return
    if (previousStage.current && previousStage.current !== retro.stage && STAGE_CONFIGS[retro.stage].help) {
      setHelpPending(true)
    }
    previousStage.current = retro.stage
  }, [retro?.stage])
  useEffect(() => {
    if (helpPending && !aiBusy) {
      setHelpPending(false)
      setHelpOpen(true)
    }
  }, [helpPending, aiBusy])

  if (!retro) return null

  const config = STAGE_CONFIGS[retro.stage]
  const StageComponent = config.component

  return (
    <div className="flex h-dvh flex-col bg-base-200 text-base-content">
      <div inert={aiBusy} className="flex min-h-0 flex-1 flex-col">
        <Header
          onShowHelp={config.help ? () => setHelpOpen(true) : null}
          onShowParticipants={() => setParticipantsOpen(true)}
        />
        <ConnectionBanner />
        <div className="flex min-h-0 flex-1">
          <main className={`relative min-h-0 min-w-0 flex-1 ${config.fullBleed ? "overflow-hidden" : "overflow-y-auto"}`}>
            <ErrorBoundary resetKey={retro.stage}>
              <StageComponent />
            </ErrorBoundary>
          </main>
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-base-300 bg-base-100 p-3 lg:block">
            <UserList />
          </aside>
        </div>
      </div>

      <Modal open={helpOpen} title={config.title} onClose={() => setHelpOpen(false)}>
        {config.help?.(retro.format)}
      </Modal>
      <Modal open={participantsOpen} title="Participants" onClose={() => setParticipantsOpen(false)} closeLabel="Close">
        <UserList />
      </Modal>

      <AiBusyOverlay />
      <Toasts />
    </div>
  )
}
