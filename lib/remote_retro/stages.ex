defmodule RemoteRetro.Stages do
  @moduledoc """
  The single, ordered stage progression shared by every retro format.

  Facilitators may move one stage forward or back; moving back from
  `closed` re-opens the retro.
  """

  @stages ~w(lobby prime-directive idea-generation grouping voting action-items closed)

  def all, do: @stages

  def valid?(stage), do: stage in @stages

  def next(stage), do: at(index(stage) + 1)

  def prev(stage) do
    case index(stage) do
      0 -> nil
      i -> at(i - 1)
    end
  end

  @doc "True when `to` is exactly one step before or after `from`."
  def adjacent?(from, to), do: to != nil and (next(from) == to or prev(from) == to)

  defp index(stage),
    do:
      Enum.find_index(@stages, &(&1 == stage)) ||
        raise(ArgumentError, "unknown stage #{inspect(stage)}")

  defp at(i), do: Enum.at(@stages, i)
end
