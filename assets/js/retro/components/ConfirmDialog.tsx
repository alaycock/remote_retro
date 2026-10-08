import { useId, type ReactNode } from "react"
import { useNativeDialog } from "../hooks/useNativeDialog"

interface ConfirmDialogProps {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: "primary" | "warning" | "error"
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const TONES = { primary: "btn-primary", warning: "btn-warning", error: "btn-error" }

/** Native <dialog> confirmation; Escape and backdrop clicks cancel. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useNativeDialog(open)
  const titleId = useId()

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="modal-box">
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        {children && <div className="py-3 text-base-content/80">{children}</div>}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${TONES[tone]}`} onClick={onConfirm} disabled={busy} autoFocus>
            {busy && <span className="loading loading-spinner loading-sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel} aria-hidden="true" />
    </dialog>
  )
}
