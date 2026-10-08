import { useState } from "react"
import { nextStage, prevStage, STAGE_CONFIGS } from "../stages"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectAiStatus, selectAllVotesIn, selectIsFacilitator, selectStage } from "../store/selectors"
import { changeStage } from "../store/thunks"
import type { Stage } from "../types"
import { ConfirmDialog } from "./ConfirmDialog"

type Direction = "next" | "prev"

/** Facilitator Back / Next (or Re-open) buttons with a confirmation dialog. */
export function StageControls() {
  const dispatch = useAppDispatch()
  const stage = useAppSelector(selectStage)
  const isFacilitator = useAppSelector(selectIsFacilitator)
  const aiStatus = useAppSelector(selectAiStatus)
  const allVotesIn = useAppSelector(selectAllVotesIn)
  const [pending, setPending] = useState<Direction | null>(null)
  const [busy, setBusy] = useState(false)

  if (!stage || !isFacilitator) return null

  const config = STAGE_CONFIGS[stage]
  const next = nextStage(stage)
  const prev = prevStage(stage)
  const disabled = aiStatus != null || busy
  const isReopen = stage === "closed"
  const target: Stage | null = pending === "next" ? next : pending === "prev" ? prev : null

  const confirm = async () => {
    if (!target) return
    setBusy(true)
    try {
      await dispatch(changeStage(target))
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {prev && config.prevCopy && (
        <button
          type="button"
          className={`btn btn-sm ${isReopen ? "btn-primary" : "btn-ghost"}`}
          disabled={disabled}
          onClick={() => setPending("prev")}
          title={isReopen ? undefined : `Back to ${STAGE_CONFIGS[prev].title.toLowerCase()}`}
        >
          <span className={`${isReopen ? "hero-arrow-uturn-left" : "hero-arrow-left"} size-4`} aria-hidden="true" />
          {config.prevCopy}
        </button>
      )}
      {next && config.nextCopy && (
        <div className="indicator">
          {stage === "voting" && allVotesIn && (
            <span className="indicator-item badge badge-success badge-xs" title="All votes in!">
              <span className="sr-only">All votes in!</span>
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={disabled}
            onClick={() => setPending("next")}
          >
            {config.nextCopy}
            <span className="hero-arrow-right size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <ConfirmDialog
        open={pending != null}
        title={
          pending === "prev"
            ? isReopen
              ? "Re-open retro"
              : `Back to ${prev ? STAGE_CONFIGS[prev].title.toLowerCase() : ""}`
            : next === "closed"
              ? "Close retro"
              : `Continue to ${next ? STAGE_CONFIGS[next].title.toLowerCase() : ""}`
        }
        confirmLabel={pending === "prev" ? (isReopen ? "Re-open" : "Go back") : "Continue"}
        tone={pending === "prev" && !isReopen ? "warning" : "primary"}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        {pending === "prev" ? config.prevConfirm : config.nextConfirm}
      </ConfirmDialog>
    </div>
  )
}
