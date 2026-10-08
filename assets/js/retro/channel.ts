import { Socket, Channel } from "phoenix"
import type { BroadcastEvents, PushEvents, Snapshot } from "./types"

export class PushError extends Error {
  constructor(public reason: string) {
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

  /** Socket-level connectivity (open vs. error/closed). */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.socket.onOpen(() => callback(true))
    this.socket.onError(() => callback(false))
    this.socket.onClose(() => callback(false))
  }

  push<E extends keyof PushEvents, R = unknown>(event: E, payload: PushEvents[E]): Promise<R> {
    return new Promise((resolve, reject) => {
      this.channel
        .push(event, payload)
        .receive("ok", (reply: R) => resolve(reply))
        .receive("error", ({ reason }: { reason: string }) => reject(new PushError(reason)))
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
