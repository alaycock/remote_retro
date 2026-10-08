import { memo, useEffect, useRef, useState } from "react"
import { MAX_LABEL_LENGTH } from "../constants"
import { useAppDispatch } from "../store/hooks"
import type { Group } from "../types"
import type { Bounds } from "./geometry"
import { updateGroupLabel } from "./thunks"

export const LABEL_DEBOUNCE_MS = 400
/** Natural (and focused) label width, in label units (world units before counter-scaling). */
export const LABEL_WIDTH = 220
const LABEL_OFFSET = 36
/** Below this zoom the label counter-scales so it stays readable. */
const MIN_READABLE_SCALE = 0.6
/** A label is never squeezed below this many screen pixels... */
export const LABEL_MIN_PX = 80
/**
 * ...unless that would spill more than this many world units past its group in
 * total. The AI layout leaves 80 between stacks, so neighbouring labels never meet.
 */
export const LABEL_SPILL = 64
/** Below this width the AI badge is dropped to leave room for the text. */
const AI_BADGE_MIN_WIDTH = 160

export const counterScale = (scale: number) => (scale < MIN_READABLE_SCALE ? MIN_READABLE_SCALE / scale : 1)

/**
 * Label width in label units for a group `groupWidth` world units wide: the
 * natural LABEL_WIDTH, capped so that on screen it is no wider than its group
 * (but at least LABEL_MIN_PX, within LABEL_SPILL of the group's width).
 */
export function labelWidth(groupWidth: number, scale: number): number {
  const screenPerUnit = scale * counterScale(scale)
  const capPx = Math.max(groupWidth * scale, Math.min(LABEL_MIN_PX, (groupWidth + LABEL_SPILL) * scale))
  return Math.min(LABEL_WIDTH, capPx / screenPerUnit)
}

export interface GroupLabelProps {
  group: Group
  bounds: Bounds
  size: number
  scale: number
  disabled: boolean
  highlight: boolean
}

export const GroupLabel = memo(function GroupLabel({ group, bounds, size, scale, disabled, highlight }: GroupLabelProps) {
  const dispatch = useAppDispatch()
  const serverValue = group.label ?? ""
  const [value, setValue] = useState(serverValue)
  const [edited, setEdited] = useState(false)
  const focused = useRef(false)
  const [isFocused, setIsFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  // Server echoes/edits from others replace the value only when not focused.
  useEffect(() => {
    if (!focused.current) {
      setValue(serverValue)
      setEdited(false)
    }
  }, [serverValue])

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (pending.current !== null) {
      const label = pending.current
      pending.current = null
      dispatch(updateGroupLabel({ id: group.id, label }))
    }
  }

  useEffect(
    () => () => {
      // Unmount (e.g. group dissolved): don't lose a pending edit.
      if (timer.current) clearTimeout(timer.current)
      if (pending.current !== null) dispatch(updateGroupLabel({ id: group.id, label: pending.current }))
    },
    [dispatch, group.id],
  )

  const onChange = (next: string) => {
    setValue(next)
    setEdited(true)
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, LABEL_DEBOUNCE_MS)
  }

  const cx = (bounds.minX + bounds.maxX) / 2
  const counter = counterScale(scale)
  // While editing, the label may grow back to its natural width (over neighbours).
  const width = isFocused ? LABEL_WIDTH : labelWidth(bounds.maxX - bounds.minX, scale)
  const showAi =
    group.label_source === "ai" && !edited && value === serverValue && serverValue !== "" && width >= AI_BADGE_MIN_WIDTH
  const unlabeled = serverValue === "" && value.trim() === ""

  return (
    <div
      className={`absolute left-0 top-0 ${isFocused ? "z-30" : "z-10"}`}
      style={{
        width,
        transform: `translate(${cx - width / 2}px, ${bounds.minY - LABEL_OFFSET}px) scale(${counter})`,
        transformOrigin: "50% 100%",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="relative block">
        <input
          type="text"
          value={value}
          maxLength={MAX_LABEL_LENGTH}
          disabled={disabled}
          placeholder="Add label (optional)"
          aria-label={`Label for group of ${size} ideas${value.trim() ? `: ${value}` : ""}`}
          title={isFocused || !value ? undefined : value}
          data-group-id={group.id}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            focused.current = true
            setIsFocused(true)
          }}
          onBlur={() => {
            focused.current = false
            setIsFocused(false)
            if (pending.current !== null) flush()
            else {
              setValue(serverValue)
              setEdited(false)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") {
              pending.current = null
              if (timer.current) clearTimeout(timer.current)
              setValue(serverValue)
              setEdited(false)
              e.currentTarget.blur()
            }
          }}
          className={[
            "input input-sm w-full truncate text-center font-semibold shadow-sm",
            showAi ? "pr-8" : "",
            highlight && unlabeled ? "input-warning border-dashed border-2" : "",
          ].join(" ")}
        />
        {showAi && (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 text-accent"
            title="Suggested by AI"
            aria-label="Suggested by AI"
          >
            <span className="hero-sparkles size-4" aria-hidden="true" />
          </span>
        )}
      </label>
    </div>
  )
})
