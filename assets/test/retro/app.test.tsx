import { act, fireEvent, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { App } from "../../js/retro/App"
import { retroUpdated } from "../../js/retro/store/slices"
import type { Stage } from "../../js/retro/types"
import { renderWithStore, retro, setup, snapshot } from "./helpers"

describe("App", () => {
  it("shows a recoverable message instead of crashing on an unknown stage", () => {
    const store = setup(snapshot({ retro: retro({ stage: "labeling" as Stage }) }))
    renderWithStore(<App />, store)
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't recognise \("labeling"\)/)
    expect(screen.getByRole("link", { name: /back to your retros/i })).toHaveAttribute("href", "/retros")
  })
})

describe("App stage help while Gemini groups", () => {
  it("opens the help at once, locked with a progress button until grouping finishes", async () => {
    const store = setup(snapshot({ retro: retro({ stage: "idea-generation" }) }))
    renderWithStore(<App />, store)
    act(() => {
      store.dispatch(retroUpdated(retro({ stage: "grouping", ai_status: "grouping" })))
    })

    const dialog = screen.getByRole("dialog", { name: "Group & label" })
    const button = within(dialog).getByRole("button", { name: /grouping ideas…/i })
    expect(button).toBeDisabled()
    expect(button.querySelector(".hero-sparkles")).not.toBeNull()
    // The dialog is the progress state; the room overlay doesn't stack on top.
    expect(screen.queryByText(/the board unlocks/i)).not.toBeInTheDocument()

    // Escape (the dialog's cancel event) and backdrop clicks don't dismiss it.
    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    fireEvent.click(dialog.querySelector(".modal-backdrop")!)
    expect(dialog).toHaveAttribute("open")

    act(() => {
      store.dispatch(retroUpdated(retro({ stage: "grouping", ai_status: null })))
    })
    const gotIt = within(dialog).getByRole("button", { name: "Got it" })
    expect(gotIt).toBeEnabled()
    expect(gotIt).toHaveFocus()
    await userEvent.click(gotIt)
    expect(dialog).not.toHaveAttribute("open")
  })

  it("shows the room overlay while busy once the help is dismissed", () => {
    const store = setup(snapshot({ retro: retro({ stage: "grouping", ai_status: "grouping" }) }))
    renderWithStore(<App />, store)
    expect(screen.queryByRole("dialog", { name: "Group & label" })).not.toBeInTheDocument()
    expect(screen.getByText(/the board unlocks/i)).toBeInTheDocument()
  })
})
