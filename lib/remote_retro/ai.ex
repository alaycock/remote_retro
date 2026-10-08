defmodule RemoteRetro.AI do
  @moduledoc "Gemini-assisted grouping and labelling. Disabled unless `GCP_PROJECT` is set."

  def enabled?, do: Application.get_env(:remote_retro, :ai, [])[:enabled] == true
end
