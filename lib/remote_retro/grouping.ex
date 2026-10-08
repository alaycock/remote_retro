defmodule RemoteRetro.Grouping do
  @moduledoc """
  Pure overlap clustering for sticky notes on the board.

  Every card is a fixed `card_w/0 × card_h/0` box anchored at its top-left
  `{x, y}`. Two cards are linked when their boxes overlap by more than
  `overlap_buffer/0` on both axes; clusters are the connected components of
  that relation. The client mirrors these constants for its drop preview.
  """

  alias RemoteRetro.Formats

  @card_w 200
  @card_h 120
  @overlap_buffer 8

  def card_w, do: @card_w
  def card_h, do: @card_h
  def overlap_buffer, do: @overlap_buffer

  @doc """
  Returns the clusters of groupable ideas as lists of idea ids.

  Ideas without a position, and action items, are ignored. Each cluster is
  sorted ascending and clusters are ordered by their smallest id, so the
  output is deterministic.
  """
  @spec clusters([%{id: integer, x: number | nil, y: number | nil}]) :: [[integer]]
  def clusters(ideas) do
    cards = ideas |> Enum.filter(&groupable?/1) |> Enum.sort_by(& &1.id)
    initial = Map.new(cards, &{&1.id, &1.id})

    parents =
      for {a, i} <- Enum.with_index(cards),
          b <- Enum.drop(cards, i + 1),
          overlap?(a, b),
          reduce: initial do
        acc -> union(acc, a.id, b.id)
      end

    cards
    |> Enum.group_by(&find(parents, &1.id), & &1.id)
    |> Map.values()
    |> Enum.sort_by(&hd/1)
  end

  @doc "True when the idea takes part in board grouping."
  def groupable?(idea) do
    is_number(idea.x) and is_number(idea.y) and Map.get(idea, :category) != Formats.action_item()
  end

  @doc "True when two positioned cards overlap by more than the buffer on both axes."
  def overlap?(a, b) do
    abs(a.x - b.x) < @card_w - @overlap_buffer and abs(a.y - b.y) < @card_h - @overlap_buffer
  end

  defp find(parents, id) do
    case Map.fetch!(parents, id) do
      ^id -> id
      parent -> find(parents, parent)
    end
  end

  # Roots always point at the smallest id, which keeps chains short enough
  # for the board sizes we deal with (tens of cards).
  defp union(parents, a, b) do
    ra = find(parents, a)
    rb = find(parents, b)

    if ra == rb, do: parents, else: Map.put(parents, max(ra, rb), min(ra, rb))
  end
end
