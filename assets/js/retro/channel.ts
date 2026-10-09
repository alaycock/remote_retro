import { Socket, Channel } from "phoenix"
import type { BroadcastEvents, PushEvents, Snapshot } from "./types"

export class PushError extends Error {
  /** `details`: anything else the server put in the error reply (e.g. the current timer). */
  constructor(
    public reason: string,
    public details: Record<string, unknown> = {},
  ) {
    super(reason)
  }
}

/** Thin promise-based wrapper over the Phoenix channel for one retro. */
export class RetroChannel {
  private socket: Socket
  private channel: Channel
  private joined = false
  private rejoinHandler: ((snapshot: Snapshot) => void) | null = null

  constructor(retroId: string, userToken: string) {
    this.socket = new Socket("/socket", { params: { token: userToken } })
    this.channel = this.socket.channel(`retro:${retroId}`)
  }

  join(): Promise<Snapshot> {
    this.socket.connect()
    return new Promise((resolve, reject) => {
      this.channel
        .join()
        .receive("ok", (snapshot: Snapshot) => {
          // Phoenix re-fires join hooks on every automatic rejoin after a disconnect.
          if (this.joined) {
            this.rejoinHandler?.(snapshot)
          } else {
            this.joined = true
            resolve(snapshot)
          }
        })
        .receive("error", ({ reason }: { reason: string }) => reject(new PushError(reason)))
        .receive("timeout", () => reject(new PushError("timeout")))
    })
  }

  /** Called with a fresh snapshot each time the channel rejoins after a disconnect. */
  onRejoin(callback: (snapshot: Snapshot) => void): void {
    this.rejoinHandler = callback
  }

  /**
   * Socket-level connectivity (open vs. error/closed). Closes caused by leaving the
   * page (browsers drop the socket as soon as navigation starts) aren't reported, so
   * following a link never flashes a "connection lost" state.
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    let leaving = false
    const leave = () => {
      leaving = true
    }
    window.addEventListener("beforeunload", leave)
    window.addEventListener("pagehide", leave)
    // Restored from the back/forward cache: we're live again.
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) leaving = false
    })
    // A cancelled navigation (e.g. a download link) keeps us on the page.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") leaving = false
    })

    this.socket.onOpen(() => callback(true))
    const lost = () => {
      if (!leaving) callback(false)
    }
    this.socket.onError(lost)
    this.socket.onClose(lost)
  }

  push<E extends keyof PushEvents, R = unknown>(event: E, payload: PushEvents[E]): Promise<R> {
    return new Promise((resolve, reject) => {
      this.channel
        .push(event, payload)
        .receive("ok", (reply: R) => resolve(reply))
        .receive("error", ({ reason, ...details }: { reason: string }) => reject(new PushError(reason, details)))
        .receive("timeout", () => reject(new PushError("timeout")))
    })
  }

  on<E extends keyof BroadcastEvents>(event: E, callback: (payload: BroadcastEvents[E]) => void): void {
    this.channel.on(event, callback)
  }

  /** Raw access for Presence, which needs the underlying channel. */
  get raw(): Channel {
    return this.channel
  }

  leave(): void {
    this.channel.leave()
    this.socket.disconnect()
  }
}
