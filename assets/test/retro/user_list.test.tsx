import { act, screen, within } from "@testing-library/react"
import { UserList } from "../../js/retro/components/UserList"
import { presenceSynced } from "../../js/retro/store/slices"
import type { Vote } from "../../js/retro/types"
import { ada, bob, idea, renderWithStore, retro, setup, snapshot, vote } from "./helpers"

const votes = (userId: number, n: number, start = 0): Vote[] =>
  Array.from({ length: n }, (_, i) => ({
    id: start + i + 1,
    user_id: userId,
    group_id: 10,
  }))

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
  const carol = {
    id: 3,
    name: "Carol Danvers",
    given_name: "Carol",
    family_name: "Danvers",
    picture: null,
  }
  const dan = {
    id: 4,
    name: "Dan Lurker",
    given_name: "Dan",
    family_name: "Lurker",
    picture: null,
  }
  const aaron = {
    id: 5,
    name: "Aaron Absent",
    given_name: "Aaron",
    family_name: "Absent",
    picture: null,
  }
  const names = () =>
    within(screen.getByRole("list", { name: /contributors/i }))
      .getAllByRole("listitem")
      .map((li) => li.querySelector("p")?.firstChild?.textContent)

  it("lists online people first, then people who contributed and left, with a total count", () => {
    const store = setup(
      snapshot({
        users: [ada, bob, carol, dan, aaron],
        ideas: [idea({ id: 1, user_id: 3 }), idea({ id: 2, user_id: 1, category: "action-item", assignee_id: 5 })],
      }),
      { online: [2, 1] },
    )
    renderWithStore(<UserList />, store)

    expect(names()).toEqual(["Ada Lovelace", "Bob Builder", "Aaron Absent", "Carol Danvers"])
    expect(screen.getByRole("heading", { name: /contributors/i })).toHaveTextContent("Contributors 4")
  })

  it("counts votes as contributing, and leaves out people who only looked in", () => {
    const store = setup(snapshot({ users: [ada, bob, carol, dan], votes: [vote(1, 3, 10)] }), { online: [1] })
    renderWithStore(<UserList />, store)

    expect(names()).toEqual(["Ada Lovelace", "Carol Danvers"])
  })

  it("only offers facilitator hand-off to people who are online", () => {
    const store = setup(
      snapshot({
        users: [ada, bob, carol],
        ideas: [idea({ id: 1, user_id: 3 })],
      }),
      {
        online: [1, 2],
      },
    )
    renderWithStore(<UserList />, store)

    expect(screen.getByRole("button", { name: "Make Bob Builder the facilitator" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: "Make Carol Danvers the facilitator",
      }),
    ).not.toBeInTheDocument()
  })
})
