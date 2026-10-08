// Stub; replaced by the pan/zoom grouping board (plan 5).
export interface BoardProps {
  mode: "grouping" | "labeling"
}

export function Board({ mode }: BoardProps) {
  return <div data-testid="board">Board ({mode})</div>
}
