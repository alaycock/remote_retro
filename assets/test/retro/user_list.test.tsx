import { act, screen, within } from "@testing-library/react"
import { UserList } from "../../js/retro/components/UserList"
import { presenceSynced } from "../../js/retro/store/slices"
import type { Vote } from "../../js/retro/types"
import { ada, bob, idea, renderWithStore, retro, setup, snapshot, vote } from "./helpers"

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

describe("UserList contributors", () => {
  const carol = { id: 3, name: "Carol Danvers", given_name: "Carol", family_name: "Danvers", picture: null }
  const dan = { id: 4, name: "Dan Lurker", given_name: "Dan", family_name: "Lurker", picture: null }

  it("lists offline people who contributed, but not people who only looked in", () => {
    const store = setup(
      snapshot({
        users: [ada, bob, carol, dan],
        ideas: [idea({ id: 1, user_id: 3 })],
      }),
      { online: [1, 2] },
    )
    renderWithStore(<UserList />, store)

    const absent = screen.getByRole("list", { name: /also contributed/i })
    expect(within(absent).getByText("Carol Danvers")).toBeInTheDocument()
    expect(screen.queryByText("Dan Lurker")).not.toBeInTheDocument()
    expect(within(absent).queryByRole("button", { name: /make .* the facilitator/i })).not.toBeInTheDocument()
  })

  it("counts votes and action-item ownership as contributing", () => {
    const store = setup(
      snapshot({
        users: [ada, bob, carol, dan],
        ideas: [idea({ id: 1, user_id: 1, category: "action-item", assignee_id: 4 })],
        votes: [vote(1, 3, 10)],
      }),
      { online: [1] },
    )
    renderWithStore(<UserList />, store)

    const absent = screen.getByRole("list", { name: /also contributed/i })
    expect(within(absent).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Carol Danvers"),
      expect.stringContaining("Dan Lurker"),
    ])
    expect(within(absent).queryByText("Bob Builder")).not.toBeInTheDocument()
  })

  it("hides the section when everyone who contributed is here", () => {
    renderWithStore(<UserList />, setup(snapshot({ ideas: [idea({ id: 1, user_id: 2 })] })))
    expect(screen.queryByText(/also contributed/i)).not.toBeInTheDocument()
  })
})
