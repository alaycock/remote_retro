defmodule RemoteRetro.AI.Runner do
  @moduledoc """
  Boundary the stage machine calls when entering `grouping` or `labeling`.
  The implementation is swappable so channel/stage tests can use a Mox mock.
  """

  @type kind :: :grouping | :labeling

  @doc "Kicks off an async AI pass. Returns `:skipped` when AI is disabled or there is nothing to do."
  @callback start(kind, retro_id :: Ecto.UUID.t()) :: :ok | :skipped

  def start(kind, retro_id), do: impl().start(kind, retro_id)

  defp impl, do: Application.get_env(:remote_retro, :ai_runner, RemoteRetro.AI.TaskRunner)
end
