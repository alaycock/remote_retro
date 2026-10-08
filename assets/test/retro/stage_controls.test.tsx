import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StageControls } from "../../js/retro/components/StageControls"
import { mockChannel, renderWithStore, retro, setup, snapshot } from "./helpers"

describe("StageControls", () => {
  it("renders nothing for participants", () => {
    const store = setup(snapshot(), { userId: 2 })
    const { container } = renderWithStore(<StageControls />, store)
    expect(container).toBeEmptyDOMElement()
  })

  it("lets the facilitator advance after confirming", async () => {
    const { channel, push } = mockChannel()
    const store = setup(snapshot({ retro: retro({ stage: "idea-generation" }) }), { channel })
    renderWithStore(<StageControls />, store)
    await userEvent.click(screen.getByRole("button", { name: /grouping/i }))
    expect(push).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(push).toHaveBeenCalledWith("retro:stage", { stage: "grouping" })
  })

  it("goes back one stage, and cancelling does nothing", async () => {
    const { channel, push } = mockChannel()
    const store = setup(snapshot({ retro: retro({ stage: "voting" }) }), { channel })
    renderWithStore(<StageControls />, store)
    await userEvent.click(screen.getByRole("button", { name: /^back/i }))
    expect(screen.getByText(/votes on any group that gets split/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(push).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: /^back/i }))
    await userEvent.click(screen.getByRole("button", { name: "Go back" }))
    expect(push).toHaveBeenCalledWith("retro:stage", { stage: "labeling" })
  })

  it("offers re-open (and no next) when closed", async () => {
    const { channel, push } = mockChannel()
    const store = setup(snapshot({ retro: retro({ stage: "closed" }) }), { channel })
    renderWithStore(<StageControls />, store)
    expect(screen.getAllByRole("button")).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: /re-open retro/i }))
    await userEvent.click(screen.getByRole("button", { name: "Re-open" }))
    expect(push).toHaveBeenCalledWith("retro:stage", { stage: "action-items" })
  })

  it("has no back button in the lobby", () => {
    const store = setup(snapshot({ retro: retro({ stage: "lobby" }) }))
    renderWithStore(<StageControls />, store)
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /begin retro/i })).toBeEnabled()
  })

  it("is disabled while the AI is busy", () => {
    const store = setup(snapshot({ retro: retro({ stage: "grouping", ai_status: "grouping" }) }))
    renderWithStore(<StageControls />, store)
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled()
  })
})
