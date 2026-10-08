import { MAX_IDEA_LENGTH } from "../constants"

export function CharCount({ value, max = MAX_IDEA_LENGTH }: { value: string; max?: number }) {
  const length = value.trim().length
  const near = length > max * 0.9
  return (
    <span
      className={`text-xs tabular-nums ${length > max ? "font-semibold text-error" : near ? "text-warning" : "text-base-content/50"}`}
      aria-live={near ? "polite" : "off"}
    >
      {length}/{max}
    </span>
  )
}
