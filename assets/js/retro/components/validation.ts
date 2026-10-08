import { MAX_IDEA_LENGTH } from "../constants"

/** Returns a user-facing error for an idea / action item body, or null when valid. */
export function validateIdeaBody(body: string): string | null {
  if (body.trim().length === 0) return "Write something before submitting."
  if (body.trim().length > MAX_IDEA_LENGTH) return `Keep it under ${MAX_IDEA_LENGTH} characters.`
  return null
}
