defmodule RemoteRetro.Formats do
  @moduledoc "Retro formats and the idea categories each one uses."

  @formats %{
    "happy_sad_confused" => ~w(happy sad confused),
    "start_stop_continue" => ~w(start stop continue)
  }

  @action_item "action-item"

  def all, do: Map.keys(@formats) |> Enum.sort()

  def valid?(format), do: Map.has_key?(@formats, format)

  @doc "Categories used during idea generation (excludes action items)."
  def categories(format), do: Map.fetch!(@formats, format)

  def action_item, do: @action_item

  def all_categories, do: (@formats |> Map.values() |> List.flatten()) ++ [@action_item]
end
