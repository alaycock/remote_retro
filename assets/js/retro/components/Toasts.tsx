import { useEffect } from "react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectToasts } from "../store/selectors"
import { toastDismissed, type Toast } from "../store/slices"

const AUTO_DISMISS_MS = 6000

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch()
  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [dispatch, toast.id])

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`alert ${toast.kind === "error" ? "alert-error" : "alert-info"} max-w-sm shadow-lg`}
    >
      <span
        className={`${toast.kind === "error" ? "hero-exclamation-circle" : "hero-information-circle"} size-5 shrink-0`}
        aria-hidden="true"
      />
      <span className="text-sm whitespace-normal">{toast.message}</span>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle"
        aria-label="Dismiss"
        onClick={() => dispatch(toastDismissed(toast.id))}
      >
        <span className="hero-x-mark-micro size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = useAppSelector(selectToasts)
  return (
    <div className="toast toast-end toast-bottom z-50" aria-live="polite">
      {toasts.slice(-4).map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
