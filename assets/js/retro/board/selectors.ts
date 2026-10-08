import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "../store"
import { groupsAdapter, ideasAdapter } from "../store/slices"
import type { Group, Idea } from "../types"
import { boundsOf, clusters, isPlaced, type Bounds } from "./geometry"
import { colorFromSeed } from "./colors"

export type PlacedIdea = Idea & { x: number; y: number }

const ideaSelectors = ideasAdapter.getSelectors((s: RootState) => s.ideas)
const groupSelectors = groupsAdapter.getSelectors((s: RootState) => s.groups)

export const selectAiBusy = (s: RootState) => Boolean(s.retro?.ai_status)

export const selectBoardIdeas = createSelector([ideaSelectors.selectAll], (ideas) =>
  ideas.filter((i) => i.category !== "action-item"),
)

export const selectPlacedIdeas = createSelector([selectBoardIdeas], (ideas) => ideas.filter(isPlaced) as PlacedIdea[])

export const selectUnplacedIdeas = createSelector([selectBoardIdeas], (ideas) => ideas.filter((i) => !isPlaced(i)))

export interface BoardCluster {
  ideaIds: number[]
  /** Persisted group this cluster corresponds to (best guess while dragging). */
  groupId: number | null
  group: Group | null
  color: string | null
  bounds: Bounds
}

export interface BoardLayout {
  clusters: BoardCluster[]
  colorByIdea: Map<number, string>
}

/**
 * Live grouping preview from current (possibly locally dragged) positions.
 * Each client-side cluster is matched to a persisted group: biggest clusters
 * first claim the group most of their ideas currently belong to, so colours and
 * labels follow a group while it's being rearranged and before the server
 * reconciles.
 */
export const selectBoardLayout = createSelector(
  [selectPlacedIdeas, groupSelectors.selectEntities],
  (ideas, groups): BoardLayout => {
    const byId = new Map(ideas.map((i) => [i.id, i]))
    const raw = clusters(ideas)
    const order = raw.map((_, i) => i).sort((a, b) => raw[b].length - raw[a].length || raw[a][0] - raw[b][0])
    const claimed = new Set<number>()
    const groupIds: (number | null)[] = raw.map(() => null)

    for (const index of order) {
      const counts = new Map<number, number>()
      for (const id of raw[index]) {
        const gid = byId.get(id)?.group_id
        if (gid != null && !claimed.has(gid)) counts.set(gid, (counts.get(gid) ?? 0) + 1)
      }
      let best: number | null = null
      let bestCount = 0
      for (const [gid, count] of counts) {
        if (count > bestCount || (count === bestCount && best !== null && gid < best)) {
          best = gid
          bestCount = count
        }
      }
      if (best !== null) {
        claimed.add(best)
        groupIds[index] = best
      }
    }

    const colorByIdea = new Map<number, string>()
    const result = raw.map((ids, index): BoardCluster => {
      const groupId = groupIds[index]
      const color = ids.length > 1 ? colorFromSeed(groupId ?? ids[0]) : null
      if (color) ids.forEach((id) => colorByIdea.set(id, color))
      return {
        ideaIds: ids,
        groupId,
        group: groupId != null ? (groups[groupId] ?? null) : null,
        color,
        bounds: boundsOf(ids.map((id) => byId.get(id)!))!,
      }
    })
    return { clusters: result, colorByIdea }
  },
)

export const selectUsers = (s: RootState) => s.users.entities
export const selectCurrentUserId = (s: RootState) => s.ui.currentUserId
