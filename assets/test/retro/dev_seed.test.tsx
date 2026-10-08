import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IdeaGeneration } from "../../js/retro/stages/IdeaGeneration"
import { devToolsEnabled } from "../../js/retro/store/slices"
import { mockChannel, renderWithStore, retro, setup, snapshot } from "./helpers"

describe("dev sample ideas button", () => {
  it("is hidden unless the server enabled dev tools", () => {
    renderWithStore(<IdeaGeneration />, setup(snapshot({ retro: retro({ stage: "idea-generation" }) })))
    expect(screen.queryByRole("button", { name: /sample ideas/i })).not.toBeInTheDocument()
  })

  it("asks the server to seed ideas when enabled", async () => {
    const { channel, push } = mockChannel(() => Promise.resolve({ count: 12 }))
    const store = setup(snapshot({ retro: retro({ stage: "idea-generation" }) }), { channel })
    store.dispatch(devToolsEnabled())
    renderWithStore(<IdeaGeneration />, store)
    await userEvent.click(screen.getByRole("button", { name: /fill with sample ideas/i }))
    expect(push).toHaveBeenCalledWith("dev:seed_ideas", {})
    expect(store.getState().ui.toasts.at(-1)?.message).toBe("Added 12 sample ideas.")
  })
})
