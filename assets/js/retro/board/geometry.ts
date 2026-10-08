import { CARD_W, OVERLAP_BUFFER, cardHeight } from "../constants"
import type { Category } from "../types"

/** Minimal shape needed for clustering; a subset of `Idea`. */
export interface Positioned {
  id: number
  x: number | null
  y: number | null
  category: Category
  /** Sets the card's height via `cardHeight`; missing means a minimum-height card. */
  body?: string | null
}

/** A placed card box: top-left anchor plus the body that sets its height. */
export interface Box {
  x: number
  y: number
  body?: string | null
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const isPlaced = <T extends Positioned>(idea: T): idea is T & { x: number; y: number } =>
  idea.category !== "action-item" && Number.isFinite(idea.x) && Number.isFinite(idea.y)

/**
 * Two cards (top-left anchored, CARD_W x cardHeight(body)) belong together when
 * their AABBs overlap by MORE than OVERLAP_BUFFER on BOTH axes.
 * Must match RemoteRetro.Grouping (lib/remote_retro/grouping.ex).
 */
export function overlaps(a: Box, b: Box): boolean {
  return boxesOverlap(a, cardHeight(a.body), b, cardHeight(b.body))
}

function boxesOverlap(a: Box, ha: number, b: Box, hb: number): boolean {
  const ox = Math.min(a.x + CARD_W, b.x + CARD_W) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + ha, b.y + hb) - Math.max(a.y, b.y)
  return ox > OVERLAP_BUFFER && oy > OVERLAP_BUFFER
}

/**
 * Connected components of the overlap graph (union-find). Ideas without x/y and
 * action items are excluded. Each cluster's ids are ascending; clusters are
 * ordered by their smallest id. Singletons are included.
 */
export function clusters(ideas: readonly Positioned[]): number[][] {
  const placed = ideas.filter(isPlaced).sort((a, b) => a.id - b.id)
  const heights = placed.map((idea) => cardHeight(idea.body))
  const parent = placed.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (boxesOverlap(placed[i], heights[i], placed[j], heights[j])) {
        const ri = find(i)
        const rj = find(j)
        // Keep the smaller index as root so roots are stable/ordered.
        if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj)
      }
    }
  }
  const byRoot = new Map<number, number[]>()
  placed.forEach((idea, i) => {
    const root = find(i)
    const list = byRoot.get(root)
    if (list) list.push(idea.id)
    else byRoot.set(root, [idea.id])
  })
  return [...byRoot.values()].sort((a, b) => a[0] - b[0])
}

/** Bounding box (world units) of a set of placed cards (real heights), or null if empty. */
export function boundsOf(points: readonly Box[]): Bounds | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + CARD_W)
    maxY = Math.max(maxY, p.y + cardHeight(p.body))
  }
  return { minX, minY, maxX, maxY }
}
