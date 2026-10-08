import { useEffect, useState } from "react"
import { useAppSelector } from "../store/hooks"
import { selectConnected } from "../store/selectors"

/** Phoenix usually reconnects within a second; only surface outages that last. */
export const BANNER_DELAY_MS = 1500

export function ConnectionBanner() {
  const connected = useAppSelector(selectConnected)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (connected) {
      setShow(false)
      return
    }
    const timer = setTimeout(() => setShow(true), BANNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [connected])

  if (!show) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-sm text-warning-content">
      <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      Connection lost. Reconnecting…
    </div>
  )
}
