// Remote `idea:dragged` positions live outside Redux so other users' drags
// (up to 20 events/s each) only re-render the affected card.

export const REMOTE_DRAG_TTL_MS = 3000

export interface RemoteDrag {
  x: number
  y: number
  userId: number
}

type Listener = () => void

export class RemoteDragStore {
  private drags = new Map<number, RemoteDrag>()
  private timers = new Map<number, ReturnType<typeof setTimeout>>()
  private listeners = new Set<Listener>()

  constructor(private ttl = REMOTE_DRAG_TTL_MS) {}

  get = (ideaId: number): RemoteDrag | undefined => this.drags.get(ideaId)

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  set(ideaId: number, drag: RemoteDrag): void {
    this.drags.set(ideaId, drag)
    clearTimeout(this.timers.get(ideaId))
    this.timers.set(
      ideaId,
      setTimeout(() => this.clear(ideaId), this.ttl),
    )
    this.emit()
  }

  clear(ideaId: number): void {
    clearTimeout(this.timers.get(ideaId))
    this.timers.delete(ideaId)
    if (this.drags.delete(ideaId)) this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }
}
