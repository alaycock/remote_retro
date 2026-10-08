import { useAppSelector } from "../store/hooks"
import { selectAiStatus } from "../store/selectors"
import type { AiStatus } from "../types"

const COPY: Record<NonNullable<AiStatus>, string> = {
  grouping: "Gemini is grouping clearly related ideas…",
  labeling: "Gemini is suggesting labels…",
}

/**
 * Room-wide blocker while the server runs an AI pass. The room content is also
 * marked `inert` by the shell so keyboard users can't interact underneath.
 */
export function AiBusyOverlay() {
  const status = useAppSelector(selectAiStatus)
  if (!status) return null
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-base-300/60 p-4 backdrop-blur-[2px]">
      <div role="status" aria-live="polite" className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <span className="hero-sparkles size-8 animate-pulse text-primary" aria-hidden="true" />
          <p className="font-medium">{COPY[status]}</p>
          <p className="text-sm text-base-content/60">The board unlocks as soon as it's done.</p>
          <span className="loading loading-dots loading-md text-primary" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
