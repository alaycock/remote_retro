import { colorFromSeed, PALETTE } from "./colors"
import {
  MAX_SCALE,
  MIN_SCALE,
  fitBounds,
  pinch,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from "./viewport"

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe("viewport math", () => {
  const v: Viewport = { tx: 120, ty: -40, scale: 0.75 }

  it("screen <-> world round-trips", () => {
    const p = { x: 333, y: 77 }
    const back = worldToScreen(v, screenToWorld(v, p))
    close(back.x, p.x)
    close(back.y, p.y)
    expect(screenToWorld({ tx: 10, ty: 20, scale: 2 }, { x: 30, y: 60 })).toEqual({ x: 10, y: 20 })
  })

  it("zoomAt keeps the world point under the cursor fixed", () => {
    const at = { x: 400, y: 250 }
    const before = screenToWorld(v, at)
    for (const scale of [0.3, 1, 1.9]) {
      const next = zoomAt(v, at, scale)
      expect(next.scale).toBe(scale)
      const after = screenToWorld(next, at)
      close(after.x, before.x)
      close(after.y, before.y)
    }
  })

  it("zoomAt clamps scale", () => {
    expect(zoomAt(v, { x: 0, y: 0 }, 100).scale).toBe(MAX_SCALE)
    expect(zoomAt(v, { x: 0, y: 0 }, 0.001).scale).toBe(MIN_SCALE)
  })

  it("fitBounds centres the bounds within padding", () => {
    const bounds = { minX: -100, minY: 200, maxX: 1900, maxY: 1200 }
    const size = { width: 1080, height: 800 }
    const fit = fitBounds(bounds, size, 80)
    close(fit.scale, Math.min((1080 - 160) / 2000, (800 - 160) / 1000))
    const tl = worldToScreen(fit, { x: bounds.minX, y: bounds.minY })
    const br = worldToScreen(fit, { x: bounds.maxX, y: bounds.maxY })
    close((tl.x + br.x) / 2, 540)
    close((tl.y + br.y) / 2, 400)
    expect(tl.x).toBeGreaterThanOrEqual(80 - 1e-6)
    expect(tl.y).toBeGreaterThanOrEqual(80 - 1e-6)
    expect(br.x).toBeLessThanOrEqual(1000 + 1e-6)
  })

  it("fitBounds does not zoom past 100% for small content", () => {
    expect(fitBounds({ minX: 0, minY: 0, maxX: 200, maxY: 120 }, { width: 1200, height: 800 }).scale).toBe(1)
  })

  it("pinch scales by finger distance around the moving midpoint", () => {
    const start: Viewport = { tx: 0, ty: 0, scale: 1 }
    const a0 = { x: 100, y: 100 }
    const b0 = { x: 200, y: 100 }
    const worldMid = screenToWorld(start, { x: 150, y: 100 })
    const next = pinch(start, a0, b0, { x: 50, y: 150 }, { x: 250, y: 150 })
    expect(next.scale).toBe(2)
    const mid = worldToScreen(next, worldMid)
    close(mid.x, 150)
    close(mid.y, 150)
  })
})

describe("colorFromSeed", () => {
  it("is stable and cycles the palette", () => {
    expect(colorFromSeed(1)).toBe(PALETTE[0])
    expect(colorFromSeed(2)).toBe(PALETTE[1])
    expect(colorFromSeed(PALETTE.length + 1)).toBe(PALETTE[0])
    expect(colorFromSeed(42)).toBe(colorFromSeed(42))
  })
})
