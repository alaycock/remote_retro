// Shared clustering fixtures. The Elixir tests for RemoteRetro.Grouping should
// mirror these exact coordinates and expectations (CARD_W 200, CARD_H 120, buffer 8).
import type { Positioned } from "./geometry"

export interface ClusterFixture {
  name: string
  ideas: Positioned[]
  expected: number[][]
}

const idea = (id: number, x: number | null, y: number | null, category: Positioned["category"] = "happy"): Positioned => ({
  id,
  x,
  y,
  category,
})

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
]
