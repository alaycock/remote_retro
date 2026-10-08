import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ActionItemList } from "../../js/retro/components/ActionItemList"
import { idea, mockChannel, renderWithStore, retro, setup, snapshot } from "./helpers"

describe("Action item deletion", () => {
  it("asks for confirmation before deleting", async () => {
    const { channel, push } = mockChannel(() => Promise.resolve({ id: 7 }))
    const item = idea({ id: 7, category: "action-item", body: "Fix flaky CI", assignee_id: 1, user_id: 1 })
    renderWithStore(
      <ActionItemList editable />,
      setup(snapshot({ retro: retro({ stage: "action-items" }), ideas: [item] }), { channel }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(push).not.toHaveBeenCalledWith("idea:delete", expect.anything())
    expect(screen.getByText("Delete this action item?")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(push).not.toHaveBeenCalledWith("idea:delete", expect.anything())

    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    const dialog = document.querySelector("dialog[open]") as HTMLElement
    await userEvent.click(dialog.querySelector("button.btn-error") as HTMLElement)
    expect(push).toHaveBeenCalledWith("idea:delete", { id: 7 })
  })
})
