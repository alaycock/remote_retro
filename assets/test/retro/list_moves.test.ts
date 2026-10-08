import { CARD_W } from "../../js/retro/constants"
import {
  EJECT_GAP_X,
  EJECT_GAP_Y,
  JOIN_OVERLAP,
  freeSlot,
  joinPosition,
  joins,
  type Card,
} from "../../js/retro/stages/listMoves"

const card = (id: number, x: number, y: number, groupId: number | null = null, h = 120): Card => ({ id, x, y, h, groupId })

describe("joinPosition", () => {
  it("tucks the card under the group's lowest card, same x", () => {
    const group = [card(1, 0, 0, 10), card(2, 20, 100, 10, 160)]
    const at = joinPosition(group, [], 120)!
    expect(at).toEqual({ x: 20, y: 100 + 160 - JOIN_OVERLAP })
    expect(joins({ ...at, h: 120 }, group[1])).toBe(true)
  })

  it("joins a lone idea", () => {
    expect(joinPosition([card(1, 300, 40)], [], 120)).toEqual({ x: 300, y: 40 + 120 - JOIN_OVERLAP })
  })

  it("avoids landing on a card outside the target (which would merge groups)", () => {
    const group = [card(1, 0, 0, 10)]
    const neighbour = card(2, 0, 200, 11)
    const at = joinPosition(group, [neighbour], 120)!
    expect(at).toEqual({ x: CARD_W - JOIN_OVERLAP, y: 0 })
    expect(joins({ ...at, h: 120 }, group[0])).toBe(true)
    expect(joins({ ...at, h: 120 }, neighbour)).toBe(false)
  })

  it("returns null without targets", () => {
    expect(joinPosition([], [], 120)).toBeNull()
  })
})

describe("freeSlot", () => {
  it("opens a column right of everything when the right edge is a group", () => {
    const cards = [card(1, 0, 50, 10), card(2, 100, 100, 10), card(3, 0, 400)]
    const at = freeSlot(cards, 120)
    expect(at).toEqual({ x: 100 + CARD_W + EJECT_GAP_X, y: 50 })
  })

  it("stacks below earlier ejected cards in the right-most column, touching nothing", () => {
    const cards = [card(1, 0, 0, 10), card(2, 0, 96, 10), card(3, 400, 0), card(4, 400, 136, null, 200)]
    const at = freeSlot(cards, 120)
    expect(at).toEqual({ x: 400, y: 136 + 200 + EJECT_GAP_Y })
    for (const c of cards) expect(joins({ ...at, h: 120 }, c)).toBe(false)
  })

  it("uses a gap between ejected cards when there's room", () => {
    const cards = [card(1, 0, 0, 10), card(2, 0, 96, 10), card(3, 400, 0), card(4, 400, 300)]
    expect(freeSlot(cards, 120)).toEqual({ x: 400, y: 120 + EJECT_GAP_Y })
  })

  it("starts at the origin on an empty board", () => {
    expect(freeSlot([], 120)).toEqual({ x: 0, y: 0 })
  })
})
