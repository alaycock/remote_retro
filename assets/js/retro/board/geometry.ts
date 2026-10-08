import { CARD_H, CARD_W, OVERLAP_BUFFER } from "../constants"
import type { Category } from "../types"

/** Minimal shape needed for clustering; a subset of `Idea`. */
export interface Positioned {
  id: number
  x: number | null
  y: number | null
  category: Category
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
 * Two cards (top-left anchored, CARD_W x CARD_H) belong together when their
 * AABBs overlap by MORE than OVERLAP_BUFFER on BOTH axes.
 * Must match RemoteRetro.Grouping (lib/remote_retro/grouping.ex).
 */
export function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const ox = Math.min(a.x + CARD_W, b.x + CARD_W) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + CARD_H, b.y + CARD_H) - Math.max(a.y, b.y)
  return ox > OVERLAP_BUFFER && oy > OVERLAP_BUFFER
}

/**
 * Connected components of the overlap graph (union-find). Ideas without x/y and
 * action items are excluded. Each cluster's ids are ascending; clusters are
 * ordered by their smallest id. Singletons are included.
 */
export function clusters(ideas: readonly Positioned[]): number[][] {
  const placed = ideas.filter(isPlaced).sort((a, b) => a.id - b.id)
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
      if (overlaps(placed[i], placed[j])) {
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

/** Bounding box (world units) of a set of placed cards, or null if empty. */
export function boundsOf(points: readonly { x: number; y: number }[]): Bounds | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + CARD_W)
    maxY = Math.max(maxY, p.y + CARD_H)
  }
  return { minX, minY, maxX, maxY }
}
