import type { Bounds } from "./geometry"

/** Per-user view onto the unbounded board. screen = world * scale + t. */
export interface Viewport {
  tx: number
  ty: number
  scale: number
}

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export const MIN_SCALE = 0.2
export const MAX_SCALE = 2.5
export const FIT_PADDING = 80
/** Fit never zooms in past 100%, so a near-empty board isn't comically large. */
export const FIT_MAX_SCALE = 1

export const IDENTITY: Viewport = { tx: 0, ty: 0, scale: 1 }

export const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

export const screenToWorld = (v: Viewport, p: Point): Point => ({
  x: (p.x - v.tx) / v.scale,
  y: (p.y - v.ty) / v.scale,
})

export const worldToScreen = (v: Viewport, p: Point): Point => ({
  x: p.x * v.scale + v.tx,
  y: p.y * v.scale + v.ty,
})

/** Zoom to `scale` (clamped) keeping the world point under screen point `at` fixed. */
export function zoomAt(v: Viewport, at: Point, scale: number): Viewport {
  const next = clampScale(scale)
  const world = screenToWorld(v, at)
  return { scale: next, tx: at.x - world.x * next, ty: at.y - world.y * next }
}

export const panBy = (v: Viewport, dx: number, dy: number): Viewport => ({ ...v, tx: v.tx + dx, ty: v.ty + dy })

/** Viewport that centres `bounds` in a `size` screen area with padding. */
export function fitBounds(bounds: Bounds, size: Size, padding = FIT_PADDING): Viewport {
  const pad = Math.min(padding, size.width / 8, size.height / 8)
  const bw = Math.max(1, bounds.maxX - bounds.minX)
  const bh = Math.max(1, bounds.maxY - bounds.minY)
  const scale = clampScale(
    Math.min(FIT_MAX_SCALE, (size.width - 2 * pad) / bw, (size.height - 2 * pad) / bh),
  )
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return { scale, tx: size.width / 2 - cx * scale, ty: size.height / 2 - cy * scale }
}

/**
 * Two-pointer pinch: the world point that was under the start midpoint stays
 * under the current midpoint, scaled by the change in finger distance.
 */
export function pinch(start: Viewport, startA: Point, startB: Point, a: Point, b: Point): Viewport {
  const startDist = Math.max(1, Math.hypot(startA.x - startB.x, startA.y - startB.y))
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  const startMid = { x: (startA.x + startB.x) / 2, y: (startA.y + startB.y) / 2 }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const world = screenToWorld(start, startMid)
  const scale = clampScale(start.scale * (dist / startDist))
  return { scale, tx: mid.x - world.x * scale, ty: mid.y - world.y * scale }
}

/** Normalise a wheel delta to pixels. */
export function wheelPixels(e: { deltaX: number; deltaY: number; deltaMode: number }, pageHeight = 800): Point {
  const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? pageHeight : 1
  return { x: e.deltaX * factor, y: e.deltaY * factor }
}

/** Multiplicative zoom factor for a ctrl/meta wheel (incl. trackpad pinch). */
export function wheelZoomFactor(deltaY: number): number {
  const clamped = Math.max(-50, Math.min(50, deltaY))
  return Math.exp(-clamped * 0.01)
}
