// Must match RemoteRetro.Grouping (lib/remote_retro/grouping.ex).
export const CARD_W = 200
export const CARD_H = 120
export const OVERLAP_BUFFER = 8

// Must match RemoteRetro.Votes.limit/0.
export const VOTE_LIMIT = 3

// Must match RemoteRetro.Ideas.Idea.max_body/0.
export const MAX_IDEA_LENGTH = 500

export const MAX_LABEL_LENGTH = 60

export const CATEGORIES_BY_FORMAT = {
  happy_sad_confused: ["happy", "sad", "confused"],
  start_stop_continue: ["start", "stop", "continue"],
} as const
