import { useEffect, useId, useRef, type ReactNode } from "react"
import { useNativeDialog } from "../hooks/useNativeDialog"

interface ModalProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  closeLabel?: string
  /**
   * While set, the dialog can't be dismissed (button, Escape and backdrop are all
   * ignored) and the button shows this text with the AI sparkles instead of closeLabel.
   */
  busyLabel?: string | null
  /** Short explanation shown beside the disabled button while busy. */
  busyHint?: string | null
}

/** Informational native <dialog> with a single close action. */
export function Modal({ open, title, children, onClose, closeLabel = "Got it", busyLabel = null, busyHint = null }: ModalProps) {
  const ref = useNativeDialog(open)
  const titleId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const busy = busyLabel != null
  const close = () => {
    if (!busy) onClose()
  }

  // Once the wait is over, put focus on the now-enabled button so Enter/Space dismisses.
  const wasBusy = useRef(busy)
  useEffect(() => {
    if (wasBusy.current && !busy && open) buttonRef.current?.focus()
    wasBusy.current = busy
  }, [busy, open])

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="modal-box">
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        <div className="py-3 text-base-content/80">{children}</div>
        <div className="modal-action items-center">
          <p role="status" aria-live="polite" className="mr-auto text-sm text-base-content/60">
            {busy ? busyHint : null}
          </p>
          {/* While busy, keep the button legible: daisyUI's disabled grey nearly vanishes in dark mode. */}
          <button
            ref={buttonRef}
            type="button"
            className={`btn btn-primary ${busy ? "gap-2 disabled:border-primary/25 disabled:bg-primary/10 disabled:text-primary" : ""}`}
            onClick={close}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="hero-sparkles size-5 animate-pulse" aria-hidden="true" />
                {busyLabel}
              </>
            ) : (
              closeLabel
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={close} aria-hidden="true" />
    </dialog>
  )
}
