import { useCallback, useRef } from "react"

/** Returns a stable function that invokes `fn` at most once per `ms` (leading edge). */
export function useThrottle(fn: () => void, ms: number): () => void {
  const last = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  return useCallback(() => {
    const now = Date.now()
    if (now - last.current >= ms) {
      last.current = now
      fnRef.current()
    }
  }, [ms])
}
