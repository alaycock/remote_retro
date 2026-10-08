export interface Throttled<A extends unknown[]> {
  (...args: A): void
  /** Run any pending trailing call now. */
  flush(): void
  /** Drop any pending trailing call. */
  cancel(): void
}

/** Leading + trailing throttle. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number): Throttled<A> {
  let last = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: A | null = null

  const run = () => {
    timer = null
    if (!pending) return
    const args = pending
    pending = null
    last = Date.now()
    fn(...args)
  }

  const throttled = ((...args: A) => {
    pending = args
    const wait = ms - (Date.now() - last)
    if (wait <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      run()
    } else if (!timer) {
      timer = setTimeout(run, wait)
    }
  }) as Throttled<A>

  throttled.flush = () => {
    if (timer) clearTimeout(timer)
    run()
  }
  throttled.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    pending = null
  }
  return throttled
}
