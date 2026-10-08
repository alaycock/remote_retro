import { cardHeight } from "../constants"
import { CLUSTER_FIXTURES, FIVE_LINES, TALL } from "./cluster_fixtures"
import { boundsOf, clusters, overlaps } from "./geometry"

describe("fixtures", () => {
  it("bodies have the heights the cases rely on", () => {
    expect(cardHeight("idea 1")).toBe(120)
    expect(cardHeight(TALL)).toBe(224)
    expect(cardHeight(FIVE_LINES)).toBe(144)
  })
})

describe("clusters()", () => {
  it.each(CLUSTER_FIXTURES)("$name", ({ ideas, expected }) => {
    expect(clusters(ideas)).toEqual(expected)
  })

  it("is independent of input order", () => {
    for (const { ideas, expected } of CLUSTER_FIXTURES) {
      expect(clusters([...ideas].reverse())).toEqual(expected)
    }
  })

  it("overlaps() is symmetric", () => {
    const a = { x: 0, y: 0 }
    const b = { x: 191, y: 111 }
    expect(overlaps(a, b)).toBe(true)
    expect(overlaps(b, a)).toBe(true)
  })

  it("overlaps() uses each card's own height", () => {
    const tall = { x: 0, y: 0, body: TALL }
    expect(overlaps(tall, { x: 0, y: 215 })).toBe(true)
    expect(overlaps({ x: 0, y: 0 }, { x: 0, y: 215 })).toBe(false)
    expect(overlaps({ x: 0, y: 215 }, tall)).toBe(true)
  })
})

describe("boundsOf()", () => {
  it("includes card size", () => {
    expect(boundsOf([{ x: 0, y: 0 }, { x: 100, y: -50 }])).toEqual({ minX: 0, minY: -50, maxX: 300, maxY: 120 })
    expect(boundsOf([{ x: 0, y: 0, body: TALL }, { x: 100, y: 150 }])).toEqual({ minX: 0, minY: 0, maxX: 300, maxY: 270 })
    expect(boundsOf([])).toBeNull()
  })
})
