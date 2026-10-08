import { screen } from "@testing-library/react"
import { App } from "../../js/retro/App"
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
