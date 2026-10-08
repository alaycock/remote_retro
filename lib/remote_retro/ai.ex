defmodule RemoteRetro.AI do
  @moduledoc "Gemini-assisted grouping and labelling. Disabled unless `GCP_PROJECT` is set."

  def enabled?, do: config()[:enabled] == true

  @doc "AI settings from `config :remote_retro, :ai` (see `config/runtime.exs`)."
  def config, do: Application.get_env(:remote_retro, :ai, [])

  @doc "Supervision children needed by the AI features; empty when AI is disabled."
  def children do
    if enabled?(), do: [RemoteRetro.AI.Credentials.goth_child_spec()], else: []
  end
end
