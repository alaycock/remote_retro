import { useState } from "react"
import { nextStage, prevStage, STAGE_CONFIGS } from "../stages"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectAiStatus, selectAllVotesIn, selectIsFacilitator, selectStage } from "../store/selectors"
import { changeStage } from "../store/thunks"
import type { Stage } from "../types"
import { ConfirmDialog } from "./ConfirmDialog"

/**
 * Facilitator Back / Next (or Re-open) buttons. Moves are immediate because Back is
 * always available; only a move that can lose work (see `prevWarning`) confirms first.
 */
export function StageControls() {
  const dispatch = useAppDispatch()
  const stage = useAppSelector(selectStage)
  const isFacilitator = useAppSelector(selectIsFacilitator)
  const aiStatus = useAppSelector(selectAiStatus)
  const allVotesIn = useAppSelector(selectAllVotesIn)
  // The stage the warning was raised from; it is ignored once the stage changes so a
  // stale dialog can never render copy for a different stage.
  const [warningFrom, setWarningFrom] = useState<Stage | null>(null)
  const [busy, setBusy] = useState(false)

  if (!stage || !isFacilitator) return null

  const config = STAGE_CONFIGS[stage]
  const next = nextStage(stage)
  const prev = prevStage(stage)
  const disabled = aiStatus != null || busy
  const isReopen = stage === "closed"

  const go = async (target: Stage | null) => {
    setWarningFrom(null)
    if (!target) return
    setBusy(true)
    try {
      await dispatch(changeStage(target))
    } finally {
      setBusy(false)
    }
  }

  const goBack = () => (config.prevWarning ? setWarningFrom(stage) : go(prev))

  return (
    <div className="flex items-center gap-2">
      {prev && config.prevCopy && (
        <button
          type="button"
          className={`btn btn-sm ${isReopen ? "btn-primary" : "btn-ghost"}`}
          disabled={disabled}
          onClick={goBack}
          title={isReopen ? undefined : `Back to ${STAGE_CONFIGS[prev].title.toLowerCase()}`}
        >
          <span className={`${isReopen ? "hero-arrow-uturn-left" : "hero-arrow-left"} size-4`} aria-hidden="true" />
          {config.prevCopy}
        </button>
      )}
      {stage === "voting" && allVotesIn && (
        <span className="badge badge-success badge-soft gap-1 font-medium" role="status">
          <span className="hero-check-circle-micro size-4" aria-hidden="true" />
          All votes in
        </span>
      )}
      {next && config.nextCopy && (
        <button type="button" className="btn btn-sm btn-primary" disabled={disabled} onClick={() => go(next)}>
          {busy && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
          {config.nextCopy}
          <span className="hero-arrow-right size-4" aria-hidden="true" />
        </button>
      )}
      {prev && config.prevWarning && (
        <ConfirmDialog
          open={warningFrom === stage}
          title={`Back to ${STAGE_CONFIGS[prev].title.toLowerCase()}?`}
          confirmLabel="Go back"
          tone="warning"
          busy={busy}
          onConfirm={() => go(prev)}
          onCancel={() => setWarningFrom(null)}
        >
          {config.prevWarning}
        </ConfirmDialog>
      )}
    </div>
  )
}
