defmodule RemoteRetro.Grouping do
  @moduledoc """
  Pure overlap clustering for sticky notes on the board.

  Every card is a `card_w/0 × card_height(body)` box anchored at its top-left
  `{x, y}` (taller cards extend further down). Two cards are linked when their
  boxes overlap by more than `overlap_buffer/0` on both axes; clusters are the
  connected components of that relation. The client mirrors this exactly for
  its drop preview (assets/js/retro/board/geometry.ts).
  """

  alias RemoteRetro.Formats

  @card_w 200
  @card_h 64
  @overlap_buffer 8

  # Card height grows with its text so nothing is ever cropped. Must match
  # `cardHeight` in assets/js/retro/constants.ts exactly (server clusters with it).
  @card_chrome 44
  @line_height 20
  @chars_per_line 24

  def card_w, do: @card_w
  @doc "Minimum (and default) card height."
  def card_h, do: @card_h
  def overlap_buffer, do: @overlap_buffer

  @doc """
  Height of the card for `body`: 44px of chrome plus 20px per wrapped line, at a
  conservative 24 characters per line per paragraph, never below `card_h/0`.
  Counts Unicode code points (as JS `[...str]` does) so client and server agree.
  """
  def card_height(nil), do: @card_h

  def card_height(body) when is_binary(body) do
    lines =
      body
      |> String.split("\n")
      |> Enum.map(fn line -> max(1, ceil(length(String.codepoints(line)) / @chars_per_line)) end)
      |> Enum.sum()

    max(@card_h, @card_chrome + @line_height * lines)
  end

  @doc """
  Returns the clusters of groupable ideas as lists of idea ids.

  Ideas without a position, and action items, are ignored. Each cluster is
  sorted ascending and clusters are ordered by their smallest id, so the
  output is deterministic. Ideas may carry a `:body` that sets the card's
  height (missing or `nil` means a minimum-height card).
  """
  @spec clusters([%{id: integer, x: number | nil, y: number | nil}]) :: [[integer]]
  def clusters(ideas) do
    cards =
      ideas
      |> Enum.filter(&groupable?/1)
      |> Enum.map(&%{id: &1.id, x: &1.x, y: &1.y, h: height_of(&1)})
      |> Enum.sort_by(& &1.id)

    initial = Map.new(cards, &{&1.id, &1.id})

    parents =
      for {a, i} <- Enum.with_index(cards),
          b <- Enum.drop(cards, i + 1),
          boxes_overlap?(a, b),
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

  @doc """
  True when two positioned cards overlap by more than the buffer on both axes,
  using each card's `card_height/1` (from `:body`, if present).
  """
  def overlap?(a, b) do
    boxes_overlap?(%{x: a.x, y: a.y, h: height_of(a)}, %{x: b.x, y: b.y, h: height_of(b)})
  end

  defp height_of(idea), do: card_height(Map.get(idea, :body))

  defp boxes_overlap?(a, b) do
    ox = min(a.x + @card_w, b.x + @card_w) - max(a.x, b.x)
    oy = min(a.y + a.h, b.y + b.h) - max(a.y, b.y)
    ox > @overlap_buffer and oy > @overlap_buffer
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
