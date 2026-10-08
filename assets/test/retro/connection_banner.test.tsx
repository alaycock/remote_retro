import { act, screen } from "@testing-library/react"
import { BANNER_DELAY_MS, ConnectionBanner } from "../../js/retro/components/ConnectionBanner"
import { connectedChanged } from "../../js/retro/store/slices"
import { renderWithStore, setup } from "./helpers"

describe("ConnectionBanner", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("ignores blips shorter than the grace period", () => {
    const store = setup()
    renderWithStore(<ConnectionBanner />, store)
    act(() => {
      store.dispatch(connectedChanged(false))
      vi.advanceTimersByTime(BANNER_DELAY_MS - 100)
      store.dispatch(connectedChanged(true))
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText(/connection lost/i)).not.toBeInTheDocument()
  })

  it("shows after a sustained outage and hides on reconnect", () => {
    const store = setup()
    renderWithStore(<ConnectionBanner />, store)
    act(() => {
      store.dispatch(connectedChanged(false))
      vi.advanceTimersByTime(BANNER_DELAY_MS)
    })
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument()
    act(() => {
      store.dispatch(connectedChanged(true))
    })
    expect(screen.queryByText(/connection lost/i)).not.toBeInTheDocument()
  })
})
