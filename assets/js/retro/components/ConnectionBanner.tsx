import { useAppSelector } from "../store/hooks"
import { selectConnected } from "../store/selectors"

export function ConnectionBanner() {
  const connected = useAppSelector(selectConnected)
  if (connected) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-sm text-warning-content">
      <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      Connection lost. Reconnecting…
    </div>
  )
}
