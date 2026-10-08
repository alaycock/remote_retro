import type { KeyboardEvent } from "react"

/**
 * Enter submits, Shift+Enter inserts a line break — the chat-app convention on every
 * platform. Ignored mid-IME-composition so CJK input isn't submitted early.
 */
export function submitOnEnter(e: KeyboardEvent<HTMLTextAreaElement>, submit: () => void) {
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault()
    submit()
  }
}

export const ENTER_HINT = "Enter to submit · Shift+Enter for a new line"
