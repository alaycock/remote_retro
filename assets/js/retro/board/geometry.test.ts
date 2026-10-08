import { CLUSTER_FIXTURES } from "./cluster_fixtures"
import { boundsOf, clusters, overlaps } from "./geometry"

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
})

describe("boundsOf()", () => {
  it("includes card size", () => {
    expect(boundsOf([{ x: 0, y: 0 }, { x: 100, y: -50 }])).toEqual({ minX: 0, minY: -50, maxX: 300, maxY: 120 })
    expect(boundsOf([])).toBeNull()
  })
})
