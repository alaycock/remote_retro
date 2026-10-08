import { useId, type ReactNode } from "react"
import { useNativeDialog } from "../hooks/useNativeDialog"

interface ModalProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  closeLabel?: string
}

/** Informational native <dialog> with a single close action. */
export function Modal({ open, title, children, onClose, closeLabel = "Got it" }: ModalProps) {
  const ref = useNativeDialog(open)
  const titleId = useId()

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-box">
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        <div className="py-3 text-base-content/80">{children}</div>
        <div className="modal-action">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </dialog>
  )
}
