// Shared clustering fixtures. test/remote_retro/grouping_parity_test.exs mirrors
// these exact coordinates, bodies and expectations (CARD_W 200, height
// cardHeight(body) with a 120 minimum, buffer 8). Update both together.
import type { Positioned } from "./geometry"

export interface ClusterFixture {
  name: string
  ideas: Positioned[]
  expected: number[][]
}

const idea = (
  id: number,
  x: number | null,
  y: number | null,
  category: Positioned["category"] = "happy",
  body = `idea ${id}`,
): Positioned => ({ id, x, y, category, body })

/** 200 characters: 9 wrapped lines, cardHeight 224. */
export const TALL = "x".repeat(200)
/** Five paragraphs: cardHeight 144. */
export const FIVE_LINES = "a\nb\nc\nd\ne"

export const CLUSTER_FIXTURES: ClusterFixture[] = [
  {
    name: "separate cards stay apart",
    ideas: [idea(1, 0, 0), idea(2, 400, 0), idea(3, 0, 400)],
    expected: [[1], [2], [3]],
  },
  {
    name: "two overlapping cards merge",
    ideas: [idea(1, 0, 0), idea(2, 100, 50)],
    expected: [[1, 2]],
  },
  {
    name: "chains merge transitively (1-2 and 2-3 overlap, 1-3 do not)",
    ideas: [idea(1, 0, 0), idea(2, 150, 0), idea(3, 300, 0), idea(4, 1000, 1000)],
    expected: [[1, 2, 3], [4]],
  },
  {
    name: "chain discovered out of id order still merges",
    ideas: [idea(5, 300, 0), idea(3, 0, 0), idea(9, 150, 60)],
    expected: [[3, 5, 9]],
  },
  {
    name: "overlap of exactly 8 on x does not group",
    ideas: [idea(1, 0, 0), idea(2, 192, 0)],
    expected: [[1], [2]],
  },
  {
    name: "overlap of 9 on x groups",
    ideas: [idea(1, 0, 0), idea(2, 191, 0)],
    expected: [[1, 2]],
  },
  {
    name: "overlap of exactly 8 on y does not group",
    ideas: [idea(1, 0, 0), idea(2, 0, 112)],
    expected: [[1], [2]],
  },
  {
    name: "overlap of 9 on y groups",
    ideas: [idea(1, 0, 0), idea(2, 0, 111)],
    expected: [[1, 2]],
  },
  {
    name: "edge-touching cards stay apart",
    ideas: [idea(1, 0, 0), idea(2, 200, 0), idea(3, 0, 120)],
    expected: [[1], [2], [3]],
  },
  {
    name: "overlap on only one axis does not group",
    ideas: [idea(1, 0, 0), idea(2, 50, 300)],
    expected: [[1], [2]],
  },
  {
    name: "negative coordinates work",
    ideas: [idea(1, -500, -300), idea(2, -400, -250), idea(3, 0, 0)],
    expected: [[1, 2], [3]],
  },
  {
    name: "action items and unpositioned ideas are excluded",
    ideas: [idea(1, 0, 0), idea(2, 10, 10, "action-item"), idea(3, null, null), idea(4, 20, 20)],
    expected: [[1, 4]],
  },
  {
    name: "two separate groups",
    ideas: [idea(1, 0, 0), idea(2, 50, 50), idea(3, 600, 0), idea(4, 650, 40), idea(5, 1200, 0)],
    expected: [[1, 2], [3, 4], [5]],
  },
  // Tall cards (heights 224 and 144) extend downwards from their top-left anchor.
  {
    name: "tall card reaches a card below only because of its height",
    ideas: [idea(1, 0, 0, "happy", TALL), idea(2, 0, 200)],
    expected: [[1, 2]],
  },
  {
    name: "tall card overlapping by exactly 8 below stays apart",
    ideas: [idea(1, 0, 0, "happy", TALL), idea(2, 0, 216)],
    expected: [[1], [2]],
  },
  {
    name: "tall card overlapping by 9 below groups",
    ideas: [idea(1, 0, 0, "happy", TALL), idea(2, 0, 215)],
    expected: [[1, 2]],
  },
  {
    name: "multi-line body grows the card",
    ideas: [idea(1, 0, 0, "happy", FIVE_LINES), idea(2, 50, 130)],
    expected: [[1, 2]],
  },
  {
    name: "tall card too far above does not reach",
    ideas: [idea(1, 0, 0, "happy", TALL), idea(2, 0, 230)],
    expected: [[1], [2]],
  },
  {
    name: "a tall card's height does not extend upwards",
    ideas: [idea(1, 0, 0), idea(2, 0, 115, "happy", TALL)],
    expected: [[1], [2]],
  },
  {
    name: "chain through a tall card",
    ideas: [idea(1, 0, 0), idea(2, 150, 50, "happy", TALL), idea(3, 300, 250)],
    expected: [[1, 2, 3]],
  },
]
