defmodule RemoteRetro.GroupingParityTest do
  @moduledoc """
  Mirrors assets/js/retro/board/cluster_fixtures.ts so the server clustering and
  the board's live preview stay in lockstep. Update both together.
  """
  use ExUnit.Case, async: true
  alias RemoteRetro.Grouping

  # {id, x, y} or {id, x, y, category}; category defaults to "happy".
  defp to_idea({id, x, y}), do: to_idea({id, x, y, "happy"})
  defp to_idea({id, x, y, category}), do: %{id: id, x: x, y: y, category: category}

  @cases [
    {"separate cards stay apart", [{1, 0, 0}, {2, 400, 0}, {3, 0, 400}], [[1], [2], [3]]},
    {"two overlapping cards merge", [{1, 0, 0}, {2, 100, 50}], [[1, 2]]},
    {"chain merges transitively", [{1, 0, 0}, {2, 150, 0}, {3, 300, 0}, {4, 1000, 1000}],
     [[1, 2, 3], [4]]},
    {"chain out of id order", [{5, 300, 0}, {3, 0, 0}, {9, 150, 60}], [[3, 5, 9]]},
    {"overlap of exactly 8 on x stays apart", [{1, 0, 0}, {2, 192, 0}], [[1], [2]]},
    {"overlap of 9 on x groups", [{1, 0, 0}, {2, 191, 0}], [[1, 2]]},
    {"overlap of exactly 8 on y stays apart", [{1, 0, 0}, {2, 0, 112}], [[1], [2]]},
    {"overlap of 9 on y groups", [{1, 0, 0}, {2, 0, 111}], [[1, 2]]},
    {"edge-touching stays apart", [{1, 0, 0}, {2, 200, 0}, {3, 0, 120}], [[1], [2], [3]]},
    {"overlap on one axis only stays apart", [{1, 0, 0}, {2, 50, 300}], [[1], [2]]},
    {"negative coordinates", [{1, -500, -300}, {2, -400, -250}, {3, 0, 0}], [[1, 2], [3]]},
    {"action items and unpositioned ideas excluded",
     [{1, 0, 0}, {2, 10, 10, "action-item"}, {3, nil, nil}, {4, 20, 20}], [[1, 4]]},
    {"two separate groups", [{1, 0, 0}, {2, 50, 50}, {3, 600, 0}, {4, 650, 40}, {5, 1200, 0}],
     [[1, 2], [3, 4], [5]]}
  ]

  for {name, ideas, expected} <- @cases do
    @ideas ideas
    @expected expected
    test name do
      ideas = Enum.map(@ideas, &to_idea/1)

      for ideas <- [ideas, Enum.reverse(ideas)] do
        got = ideas |> Grouping.clusters() |> Enum.map(&Enum.sort/1) |> Enum.sort()
        assert got == Enum.sort(@expected)
      end
    end
  end
end
