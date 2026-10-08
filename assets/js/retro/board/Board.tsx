import { useCallback, useLayoutEffect, useMemo, useRef } from "react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { boundsOf } from "./geometry"
import { GroupLabel } from "./GroupLabel"
import { StickyCard } from "./StickyCard"
import { ZoomControls } from "./ZoomControls"
import { subscribeRemoteDrags } from "./thunks"
import { selectAiBusy, selectBoardLayout, selectPlacedIdeas, selectUnplacedIdeas, selectUsers } from "./selectors"
import { useViewport } from "./useViewport"

export interface BoardProps {
  mode: "grouping" | "labeling"
}

const GRID = 24
const OUTLINE_PAD = 12

export function Board({ mode }: BoardProps) {
  const dispatch = useAppDispatch()
  const containerRef = useRef<HTMLDivElement>(null)
  const { viewport, zoomBy, zoomTo, fit, onKeyDown, handlers } = useViewport(containerRef)
  const remoteDrags = useMemo(() => dispatch(subscribeRemoteDrags()), [dispatch])

  const ideas = useAppSelector(selectPlacedIdeas)
  const unplaced = useAppSelector(selectUnplacedIdeas)
  const layout = useAppSelector(selectBoardLayout)
  const users = useAppSelector(selectUsers)
  const aiBusy = useAppSelector(selectAiBusy)

  const ideasRef = useRef(ideas)
  ideasRef.current = ideas
  const fitAll = useCallback(() => fit(boundsOf(ideasRef.current)), [fit])

  // Auto-fit once, as soon as there is something to fit and room to fit it in.
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (!fitted.current && ideas.length > 0) fitted.current = fitAll()
  }, [ideas.length, fitAll])

  // Gemini moves cards into new stacks (off to the side of the current layout), so
  // re-frame everything once it finishes. Positions arrive in the same snapshot.
  const wasAiBusy = useRef(aiBusy)
  useLayoutEffect(() => {
    if (wasAiBusy.current && !aiBusy) fitAll()
    wasAiBusy.current = aiBusy
  }, [aiBusy, fitAll])

  const groups = layout.clusters.filter((c) => c.ideaIds.length > 1 && c.group)
  const unlabeled = groups.filter((c) => !c.group?.label).length
  const { tx, ty, scale } = viewport

  return (
    <div
      ref={containerRef}
      data-testid="board"
      data-mode={mode}
      role="application"
      aria-label={`${mode === "labeling" ? "Labeling" : "Grouping"} board. Drag ideas to overlap them to form groups. Drag the background to pan; use + and - to zoom.`}
      aria-busy={aiBusy || undefined}
      tabIndex={0}
      className="relative h-full min-h-[480px] w-full select-none overflow-hidden overscroll-none bg-base-200 outline-none"
      style={{
        touchAction: "none",
        backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--color-base-content) 18%, transparent) 1px, transparent 1px)",
        backgroundSize: `${GRID * scale}px ${GRID * scale}px`,
        backgroundPosition: `${tx}px ${ty}px`,
      }}
      onKeyDown={(e) => onKeyDown(e, fitAll)}
      {...handlers}
    >
      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "0 0", willChange: "transform" }}
      >
        {mode === "labeling" &&
          groups
            .filter((c) => !c.group?.label)
            .map((c) => (
              <div
                key={`outline-${c.groupId}`}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 rounded-xl border-2 border-dashed border-warning bg-warning/5"
                style={{
                  width: c.bounds.maxX - c.bounds.minX + 2 * OUTLINE_PAD,
                  height: c.bounds.maxY - c.bounds.minY + 2 * OUTLINE_PAD,
                  transform: `translate(${c.bounds.minX - OUTLINE_PAD}px, ${c.bounds.minY - OUTLINE_PAD}px)`,
                }}
              />
            ))}
        {ideas.map((idea) => (
          <StickyCard
            key={idea.id}
            idea={idea}
            color={layout.colorByIdea.get(idea.id) ?? null}
            scale={scale}
            disabled={aiBusy}
            remoteDrags={remoteDrags}
            users={users}
          />
        ))}
        {groups.map((c) => (
          <GroupLabel
            key={c.groupId}
            group={c.group!}
            bounds={c.bounds}
            size={c.ideaIds.length}
            scale={scale}
            disabled={aiBusy}
            highlight={mode === "labeling"}
          />
        ))}
      </div>

      {mode === "labeling" && (
        <div className="pointer-events-none absolute left-3 top-3 z-30" role="status">
          <span className={`badge ${unlabeled > 0 ? "badge-warning" : "badge-success"} shadow`}>
            {unlabeled > 0 ? `${unlabeled} group${unlabeled === 1 ? "" : "s"} unlabeled` : "All groups labeled"}
          </span>
        </div>
      )}

      {ideas.length === 0 && unplaced.length === 0 && (
        <p className="absolute inset-0 grid place-items-center text-base-content/50">No ideas to group.</p>
      )}

      {unplaced.length > 0 && (
        <details
          className="absolute bottom-3 left-3 z-30 max-w-xs rounded-box bg-base-100 p-2 text-sm shadow-md"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <summary className="cursor-pointer">
            {unplaced.length} unplaced idea{unplaced.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5">
            {unplaced.map((i) => (
              <li key={i.id}>{i.body}</li>
            ))}
          </ul>
        </details>
      )}

      <ZoomControls
        scale={scale}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onReset={() => zoomTo(1)}
        onFit={fitAll}
      />
    </div>
  )
}
