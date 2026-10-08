import { act, screen } from "@testing-library/react"
import { UserList } from "../../js/retro/components/UserList"
import { presenceSynced } from "../../js/retro/store/slices"
import type { Vote } from "../../js/retro/types"
import { renderWithStore, retro, setup, snapshot } from "./helpers"

const votes = (userId: number, n: number, start = 0): Vote[] =>
  Array.from({ length: n }, (_, i) => ({ id: start + i + 1, user_id: userId, group_id: 10 }))

describe("UserList voting status", () => {
  it("counts down people still voting, then shows all voted", () => {
    const store = setup(snapshot({ retro: retro({ stage: "voting" }), votes: votes(1, 3) }))
    act(() => {
      store.dispatch(
        presenceSynced({
          "1": { metas: [{ user_id: 1, online_at: 0, phx_ref: "a" }] },
          "2": { metas: [{ user_id: 2, online_at: 0, phx_ref: "b" }] },
        }),
      )
    })
    renderWithStore(<UserList />, store)
    expect(screen.getByRole("status")).toHaveTextContent("1 still voting")
  })

  it("shows nothing outside voting", () => {
    renderWithStore(<UserList />, setup(snapshot({ retro: retro({ stage: "grouping" }) })))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
