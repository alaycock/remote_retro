defmodule RemoteRetro.AI.TaskRunner do
  @moduledoc "Default AI runner (stub until plan 3 lands)."
  @behaviour RemoteRetro.AI.Runner

  @impl true
  def start(_kind, _retro_id), do: :skipped
end
