import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Voting } from "../../js/retro/stages/Voting"
import { group, idea, mockChannel, renderWithStore, retro, setup, snapshot, vote } from "./helpers"

const snap = (votes = [] as ReturnType<typeof vote>[]) =>
  snapshot({
    retro: retro({ stage: "voting" }),
    ideas: [
      idea({ id: 1, group_id: 10, body: "Flaky CI" }),
      idea({ id: 2, group_id: 11, body: "a" }),
      idea({ id: 3, group_id: 11, body: "b" }),
    ],
    groups: [group(10), group(11, "Process")],
    votes,
  })

describe("Voting", () => {
  it("shows singleton bodies and labels, and votes", async () => {
    const { channel, push } = mockChannel(() => Promise.resolve({ vote: vote(9, 1, 10) }))
    renderWithStore(<Voting />, setup(snap(), { channel }))
    expect(screen.getByRole("heading", { name: "Flaky CI" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Process" })).toBeInTheDocument()
    expect(screen.getByText("3 votes left")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Vote for Flaky CI" }))
    expect(push).toHaveBeenCalledWith("vote:create", { group_id: 10 })
    expect(await screen.findByText("2 votes left")).toBeInTheDocument()
    expect(screen.getByText("1 vote from you")).toBeInTheDocument()
  })

  it("disables voting once the limit is reached but allows retracting", async () => {
    const { channel, push } = mockChannel()
    renderWithStore(<Voting />, setup(snap([vote(1, 1, 10), vote(2, 1, 10), vote(3, 1, 11)]), { channel }))
    expect(screen.getByText("All votes used")).toBeInTheDocument()
    for (const button of screen.getAllByRole("button", { name: /^vote for/i })) expect(button).toBeDisabled()

    await userEvent.click(screen.getByRole("button", { name: "Remove a vote from Process" }))
    expect(push).toHaveBeenCalledWith("vote:delete", { id: 3 })
    expect(screen.getByText("1 vote left")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Vote for Process" })).toBeEnabled()
  })

  it("hides other users' vote totals", () => {
    renderWithStore(<Voting />, setup(snap([vote(1, 2, 10), vote(2, 2, 10)])))
    expect(screen.queryByText(/2 votes/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove a vote from Flaky CI" })).toBeDisabled()
  })
})
