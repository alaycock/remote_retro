import { act, screen } from "@testing-library/react"
import { retroUpdated } from "../../js/retro/store/slices"
import userEvent from "@testing-library/user-event"
import { StageControls } from "../../js/retro/components/StageControls"
import { mockChannel, renderWithStore, retro, setup, snapshot } from "./helpers"

describe("StageControls", () => {
  it("renders nothing for participants", () => {
    const store = setup(snapshot(), { userId: 2 })
    const { container } = renderWithStore(<StageControls />, store)
    expect(container).toBeEmptyDOMElement()
  })

  it("advances immediately, without a confirmation dialog", async () => {
    const { channel, push } = mockChannel()
    const store = setup(snapshot({ retro: retro({ stage: "idea-generation" }) }), { channel })
    renderWithStore(<StageControls />, store)
    await userEvent.click(screen.getByRole("button", { name: /grouping/i }))
    expect(push).toHaveBeenCalledWith("retro:stage", { stage: "grouping" })
    expect(document.querySelector("dialog[open]")).toBeNull()
  })

  it("goes back immediately when nothing can be lost", async () => {
    const { channel, push } = mockChannel()
    const store = setup(snapshot({ retro: retro({ stage: "action-items" }) }), { channel })
    renderWithStore(<StageControls />, store)
    await userEvent.click(screen.getByRole("button", { name: /^back/i }))
    expect(push).toHaveBeenCalledWith("retro:stage", { stage: "voting" })
  })

  it("drops a pending warning when the stage changes underneath it", async () => {
    const store = setup(snapshot({ retro: retro({ stage: "voting" }) }))
    renderWithStore(<StageControls />, store)
    await userEvent.click(screen.getByRole("button", { name: /^back/i }))
    expect(document.querySelector("dialog[open]")).not.toBeNull()
    act(() => {
      store.dispatch(retroUpdated(retro({ stage: "action-items" })))
    })
    expect(screen.queryByText(/votes on any group that gets split/i)).not.toBeInTheDocument()
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
    expect(push).toHaveBeenCalledWith("retro:stage", { stage: "grouping" })
  })

  it("offers re-open (and no next) when closed", async () => {
    const { channel, push } = mockChannel()
    const store = setup(snapshot({ retro: retro({ stage: "closed" }) }), { channel })
    renderWithStore(<StageControls />, store)
    expect(screen.getAllByRole("button")).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: /re-open retro/i }))
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
