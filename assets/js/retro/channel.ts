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

  constructor(retroId: string, userToken: string) {
    this.socket = new Socket("/socket", { params: { token: userToken } })
    this.channel = this.socket.channel(`retro:${retroId}`)
  }

  join(): Promise<Snapshot> {
    this.socket.connect()
    return new Promise((resolve, reject) => {
      this.channel
        .join()
        .receive("ok", (snapshot: Snapshot) => resolve(snapshot))
        .receive("error", ({ reason }: { reason: string }) => reject(new PushError(reason)))
        .receive("timeout", () => reject(new PushError("timeout")))
    })
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
