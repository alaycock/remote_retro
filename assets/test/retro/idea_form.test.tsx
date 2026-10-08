import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PushError } from "../../js/retro/channel"
import { MAX_IDEA_LENGTH } from "../../js/retro/constants"
import { IdeaGeneration } from "../../js/retro/stages/IdeaGeneration"
import { idea, mockChannel, renderWithStore, setup, snapshot } from "./helpers"

describe("IdeaForm (idea generation)", () => {
  it("rejects empty submissions", async () => {
    const { channel, push } = mockChannel()
    renderWithStore(<IdeaGeneration />, setup(snapshot(), { channel }))
    await userEvent.click(screen.getByRole("button", { name: /add idea/i }))
    expect(screen.getByText("Write something before submitting.")).toBeInTheDocument()
    expect(screen.getByLabelText("Idea")).toHaveAttribute("aria-invalid", "true")
    expect(push).not.toHaveBeenCalledWith("idea:create", expect.anything())
  })

  it("rejects ideas over the length limit", async () => {
    const { channel, push } = mockChannel()
    renderWithStore(<IdeaGeneration />, setup(snapshot(), { channel }))
    const textarea = screen.getByLabelText("Idea")
    await userEvent.click(textarea)
    await userEvent.paste("x".repeat(MAX_IDEA_LENGTH + 1))
    expect(screen.getByText(`${MAX_IDEA_LENGTH + 1}/${MAX_IDEA_LENGTH}`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /add idea/i }))
    expect(screen.getByText(/keep it under/i)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalledWith("idea:create", expect.anything())
  })

  it("submits the trimmed body in the chosen category and clears the field", async () => {
    const { channel, push } = mockChannel((event, payload) =>
      Promise.resolve(event === "idea:create" ? { idea: idea({ id: 7, ...(payload as object) }) } : {}),
    )
    renderWithStore(<IdeaGeneration />, setup(snapshot(), { channel }))
    await userEvent.click(screen.getByRole("radio", { name: /sad/i }))
    await userEvent.type(screen.getByLabelText("Idea"), "  Too many meetings  {Enter}")
    expect(push).toHaveBeenCalledWith("idea:create", { category: "sad", body: "Too many meetings" })
    expect(screen.getByLabelText("Idea")).toHaveValue("")
    expect(await screen.findByText("Too many meetings")).toBeInTheDocument()
  })

  it("restores the text when the server rejects it", async () => {
    const { channel } = mockChannel((event) =>
      event === "idea:create" ? Promise.reject(new PushError("invalid")) : Promise.resolve({}),
    )
    renderWithStore(<IdeaGeneration />, setup(snapshot(), { channel }))
    await userEvent.type(screen.getByLabelText("Idea"), "Hello{Enter}")
    expect(await screen.findByDisplayValue("Hello")).toBeInTheDocument()
  })

  it("only offers edit controls on ideas the user may change", () => {
    const store = setup(snapshot({ ideas: [idea({ id: 1, user_id: 1 }), idea({ id: 2, user_id: 1, body: "x" })] }), {
      userId: 2,
    })
    renderWithStore(<IdeaGeneration />, store)
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
  })
})
