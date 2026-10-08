import { CARD_W, OVERLAP_BUFFER, cardHeight } from "../constants"

/**
 * Board positions for moves made from the Group & label list view. The server
 * groups ideas by card overlap (> OVERLAP_BUFFER on both axes), so moving an idea
 * in or out of a group is just choosing where its card lands on the board.
 */

export interface Card {
  id: number
  x: number
  y: number
  h: number
  /** Server group id, if any. */
  groupId: number | null
}

export interface Point {
  x: number
  y: number
}

/** How far a joining card tucks under / beside its target (well over OVERLAP_BUFFER). */
export const JOIN_OVERLAP = 12
/** Horizontal gap between the board's content and the ejected-cards column. */
export const EJECT_GAP_X = 80
/** Clearance kept around an ejected card so it never touches another card. */
export const EJECT_GAP_Y = 16

export function toCards(ideas: { id: number; x: number | null; y: number | null; body: string; group_id: number | null }[]) {
  const cards: Card[] = []
  for (const idea of ideas) {
    if (idea.x == null || idea.y == null) continue
    cards.push({ id: idea.id, x: idea.x, y: idea.y, h: cardHeight(idea.body), groupId: idea.group_id })
  }
  return cards
}

/** Would the server consider these two cards overlapping (i.e. grouped)? */
export function joins(a: { x: number; y: number; h: number }, b: { x: number; y: number; h: number }) {
  const ox = Math.min(a.x + CARD_W, b.x + CARD_W) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return ox > OVERLAP_BUFFER && oy > OVERLAP_BUFFER
}

function touches(a: { x: number; y: number; h: number }, b: { x: number; y: number; h: number }, gap: number) {
  return a.x < b.x + CARD_W + gap && b.x < a.x + CARD_W + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
}

/**
 * Where to drop a card of height `h` so it joins `targets` (the cards of a group, or
 * a lone idea) and nothing else. First choice: under the lowest target card, same x,
 * tucked up by JOIN_OVERLAP. If that would also touch a card outside the group (which
 * would merge groups), try under the other cards, then beside the right-most ones.
 */
export function joinPosition(targets: Card[], others: Card[], h: number): Point | null {
  if (targets.length === 0) return null
  const below = [...targets]
    .sort((a, b) => b.y + b.h - (a.y + a.h) || a.x - b.x)
    .map((c) => ({ x: c.x, y: c.y + c.h - JOIN_OVERLAP }))
  const beside = [...targets]
    .sort((a, b) => b.x - a.x || a.y - b.y)
    .map((c) => ({ x: c.x + CARD_W - JOIN_OVERLAP, y: c.y }))
  const candidates = [...below, ...beside]
  const clean = candidates.find((p) => !others.some((o) => joins({ ...p, h }, o)))
  return clean ?? candidates[0]
}

/**
 * A spot for a card of height `h` that touches no card at all, to the right of
 * everything on the board. Cards ejected one after another stack in one column: if
 * the right-most column holds only ungrouped cards, reuse it; otherwise open a new
 * column EJECT_GAP_X past the right edge.
 */
export function freeSlot(cards: Card[], h: number, groupSizes: Map<number, number> = groupSizesOf(cards)): Point {
  if (cards.length === 0) return { x: 0, y: 0 }
  const right = Math.max(...cards.map((c) => c.x + CARD_W))
  const minY = Math.min(...cards.map((c) => c.y))
  const edge = cards.filter((c) => c.x + CARD_W === right)
  const solo = (c: Card) => c.groupId == null || (groupSizes.get(c.groupId) ?? 0) <= 1
  const x = edge.every(solo) ? edge[0].x : right + EJECT_GAP_X

  let y = minY
  for (;;) {
    const blocking = cards.filter((c) => touches({ x, y, h }, c, EJECT_GAP_Y))
    if (blocking.length === 0) return { x, y }
    y = Math.max(...blocking.map((c) => c.y + c.h)) + EJECT_GAP_Y
  }
}

export function groupSizesOf(cards: Card[]) {
  const sizes = new Map<number, number>()
  for (const c of cards) if (c.groupId != null) sizes.set(c.groupId, (sizes.get(c.groupId) ?? 0) + 1)
  return sizes
}
