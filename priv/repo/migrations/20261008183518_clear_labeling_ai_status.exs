defmodule RemoteRetro.Repo.Migrations.ClearLabelingAiStatus do
  use Ecto.Migration

  # The Gemini labeling pass was removed; free any retro stuck mid-pass.
  def up, do: execute("UPDATE retros SET ai_status = NULL WHERE ai_status = 'labeling'")

  def down, do: :ok
end
