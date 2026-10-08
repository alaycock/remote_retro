import type { Category } from "./types"

export interface CategoryMeta {
  label: string
  /** Plain-text glyph for places that can't render icons (native <option>s, copied text). */
  emoji: string
  /** Short prompt shown as the textarea placeholder. */
  prompt: string
}

/** Display metadata for idea categories. Shared by stage UIs and the board. */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  happy: { label: "Happy", emoji: "👍", prompt: "What made you happy?" },
  sad: { label: "Sad", emoji: "👎", prompt: "What made you sad?" },
  confused: { label: "Confused", emoji: "❓", prompt: "What left you confused?" },
  start: { label: "Start", emoji: "▶️", prompt: "What should the team start doing?" },
  stop: { label: "Stop", emoji: "🛑", prompt: "What should the team stop doing?" },
  continue: { label: "Continue", emoji: "🔄", prompt: "What should the team keep doing?" },
  "action-item": { label: "Action item", emoji: "✅", prompt: "What will the team do next?" },
}
