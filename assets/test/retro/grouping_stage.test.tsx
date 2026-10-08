import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Grouping } from "../../js/retro/stages/Grouping"
import { renderWithStore, retro, setup, snapshot } from "./helpers"

describe("Group & label stage", () => {
  beforeEach(() => localStorage.clear())

  it("opens on the board and toggles to the list, remembering the choice", async () => {
    const store = setup(snapshot({ retro: retro({ stage: "grouping" }) }))
    const { unmount } = renderWithStore(<Grouping />, store)
    expect(screen.getByRole("tab", { name: /board/i })).toHaveAttribute("aria-selected", "true")

    await userEvent.click(screen.getByRole("tab", { name: /list/i }))
    expect(screen.getByRole("heading", { name: "Name each group" })).toBeInTheDocument()
    unmount()

    renderWithStore(<Grouping />, store)
    expect(screen.getByRole("tab", { name: /list/i })).toHaveAttribute("aria-selected", "true")
  })
})
