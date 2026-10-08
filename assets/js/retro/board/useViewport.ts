import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react"
import type { Bounds } from "./geometry"
import {
  IDENTITY,
  fitBounds,
  panBy,
  pinch,
  wheelPixels,
  wheelZoomFactor,
  zoomAt,
  type Point,
  type Viewport,
} from "./viewport"

const KEY_ZOOM = 1.2

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

interface Gesture {
  start: Viewport
  // pointerId -> position at gesture start (container-relative)
  origin: Map<number, Point>
}

/**
 * Pan/zoom for the board container. Background pointer drags pan; two touch
 * pointers pinch; wheel pans, ctrl/meta-wheel (and trackpad pinch) zooms at the
 * cursor; +/-/0/1 keys. Cards must stopPropagation on pointerdown to drag
 * instead of panning.
 */
export function useViewport(containerRef: RefObject<HTMLElement | null>, initial: Viewport = IDENTITY) {
  const [viewport, setViewport] = useState<Viewport>(initial)
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)

  const local = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect()
      return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
    },
    [containerRef],
  )

  const size = useCallback(() => {
    const el = containerRef.current
    return { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 }
  }, [containerRef])

  const center = useCallback((): Point => {
    const { width, height } = size()
    return { x: width / 2, y: height / 2 }
  }, [size])

  const zoomBy = useCallback(
    (factor: number, at?: Point) => setViewport((v) => zoomAt(v, at ?? center(), v.scale * factor)),
    [center],
  )
  const zoomTo = useCallback((scale: number, at?: Point) => setViewport((v) => zoomAt(v, at ?? center(), scale)), [center])

  /** Fit bounds; returns false if the container has no size yet. */
  const fit = useCallback(
    (bounds: Bounds | null): boolean => {
      const s = size()
      if (!bounds || s.width === 0 || s.height === 0) return false
      setViewport(fitBounds(bounds, s))
      return true
    },
    [size],
  )

  const restartGesture = () => {
    gesture.current = pointers.current.size > 0 ? { start: viewportRef.current, origin: new Map(pointers.current) } : null
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return
    if (pointers.current.size >= 2) return
    containerRef.current?.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY))
    restartGesture()
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY))
    const { start, origin } = gesture.current
    const ids = [...origin.keys()]
    if (ids.length >= 2) {
      const [a, b] = ids
      setViewport(pinch(start, origin.get(a)!, origin.get(b)!, pointers.current.get(a)!, pointers.current.get(b)!))
    } else {
      const from = origin.get(ids[0])!
      const to = pointers.current.get(ids[0])!
      setViewport(panBy(start, to.x - from.x, to.y - from.y))
    }
  }

  const onPointerEnd = (e: PointerEvent<HTMLElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    restartGesture()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, fitAll: () => void) => {
    if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
    switch (e.key) {
      case "+":
      case "=":
        zoomBy(KEY_ZOOM)
        break
      case "-":
      case "_":
        zoomBy(1 / KEY_ZOOM)
        break
      case "0":
        zoomTo(1)
        break
      case "1":
        fitAll()
        break
      default:
        return
    }
    e.preventDefault()
  }

  // Wheel + Safari gesture events need non-passive native listeners so we can
  // stop the browser zooming/scrolling the page while over the board.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const d = wheelPixels(e, el.clientHeight)
      if (e.ctrlKey || e.metaKey) {
        const at = local(e.clientX, e.clientY)
        setViewport((v) => zoomAt(v, at, v.scale * wheelZoomFactor(d.y)))
      } else if (e.shiftKey && d.x === 0) {
        setViewport((v) => panBy(v, -d.y, 0))
      } else {
        setViewport((v) => panBy(v, -d.x, -d.y))
      }
    }
    let gestureStart = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureStart = viewportRef.current.scale
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const ge = e as Event & { scale: number; clientX: number; clientY: number }
      const at = local(ge.clientX, ge.clientY)
      setViewport((v) => zoomAt(v, at, gestureStart * ge.scale))
    }
    const prevent = (e: Event) => e.preventDefault()
    el.addEventListener("wheel", onWheel, { passive: false })
    el.addEventListener("gesturestart", onGestureStart)
    el.addEventListener("gesturechange", onGestureChange)
    el.addEventListener("gestureend", prevent)
    return () => {
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("gesturestart", onGestureStart)
      el.removeEventListener("gesturechange", onGestureChange)
      el.removeEventListener("gestureend", prevent)
    }
  }, [containerRef, local])

  return {
    viewport,
    setViewport,
    zoomBy,
    zoomTo,
    fit,
    onKeyDown,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  }
}
