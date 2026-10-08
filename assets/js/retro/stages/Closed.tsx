import { useState } from "react"
import { ActionItemList } from "../components/ActionItemList"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { RankedGroups } from "../components/RankedGroups"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectActionItems, selectAiStatus, selectIsFacilitator, selectUsersById } from "../store/selectors"
import { changeStage } from "../store/thunks"

function CopySummaryButton() {
  const items = useAppSelector(selectActionItems)
  const users = useAppSelector(selectUsersById)
  const [copied, setCopied] = useState(false)
  if (items.length === 0) return null

  const copy = async () => {
    const text = items
      .map((item) => `- ${item.body} (${(item.assignee_id != null && users[item.assignee_id]?.name) || "Unassigned"})`)
      .join("\n")
    try {
      await navigator.clipboard.writeText(`Action items\n${text}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g. insecure context); nothing else to do.
    }
  }

  return (
    <button type="button" className="btn btn-sm" onClick={copy}>
      <span className={`${copied ? "hero-check" : "hero-clipboard-document-list"} size-4`} aria-hidden="true" />
      {copied ? "Copied" : "Copy action items"}
    </button>
  )
}

export function Closed() {
  const dispatch = useAppDispatch()
  const isFacilitator = useAppSelector(selectIsFacilitator)
  const aiBusy = useAppSelector(selectAiStatus) != null
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4">
      <div className="card mb-4 bg-base-100 shadow-sm">
        <div className="card-body flex-row flex-wrap items-center gap-4 p-4">
          <span className="hero-check-badge size-10 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">This retro is closed</h1>
            <p className="text-sm text-base-content/70">
              Here's what the team discussed and committed to. You can come back to it any time from{" "}
              <a href="/retros" className="link">
                your retros
              </a>
              .
            </p>
          </div>
          <div className="flex gap-2">
            <CopySummaryButton />
            {isFacilitator && (
              <button type="button" className="btn btn-sm btn-primary" disabled={aiBusy} onClick={() => setConfirming(true)}>
                <span className="hero-arrow-uturn-left size-4" aria-hidden="true" />
                Re-open retro
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="closed-action-items" className="lg:order-2">
          <h2 id="closed-action-items" className="mb-3 text-lg font-semibold">
            Action items
          </h2>
          <ActionItemList editable={false} />
        </section>
        <section aria-labelledby="closed-topics" className="lg:order-1">
          <h2 id="closed-topics" className="mb-3 text-lg font-semibold">
            Topics by votes
          </h2>
          <RankedGroups />
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Re-open retro"
        confirmLabel="Re-open"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          void dispatch(changeStage("action-items"))
        }}
      >
        Re-open this retro? It will return to the action items stage.
      </ConfirmDialog>
    </div>
  )
}
