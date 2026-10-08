defmodule RemoteRetro.GroupingParityTest do
  @moduledoc """
  Mirrors assets/js/retro/board/cluster_fixtures.ts so the server clustering and
  the board's live preview stay in lockstep. Update both together.
  """
  use ExUnit.Case, async: true
  alias RemoteRetro.Grouping

  # {id, x, y}, {id, x, y, category} or {id, x, y, category, body}; category
  # defaults to "happy", body to a short one-liner (a minimum-height card).
  defp to_idea({id, x, y}), do: to_idea({id, x, y, "happy"})
  defp to_idea({id, x, y, category}), do: to_idea({id, x, y, category, "idea #{id}"})

  defp to_idea({id, x, y, category, body}),
    do: %{id: id, x: x, y: y, category: category, body: body}

  # Same bodies as `tall()` / `lines()` in cluster_fixtures.ts.
  @tall_200 String.duplicate("x", 200)
  @five_lines "a\nb\nc\nd\ne"

  test "fixture bodies have the heights the cases rely on" do
    assert Grouping.card_height("idea 1") == 64
    assert Grouping.card_height(@tall_200) == 224
    assert Grouping.card_height(@five_lines) == 144
  end

  @cases [
    {"separate cards stay apart", [{1, 0, 0}, {2, 400, 0}, {3, 0, 400}], [[1], [2], [3]]},
    {"two overlapping cards merge", [{1, 0, 0}, {2, 100, 50}], [[1, 2]]},
    {"chain merges transitively", [{1, 0, 0}, {2, 150, 0}, {3, 300, 0}, {4, 1000, 1000}],
     [[1, 2, 3], [4]]},
    {"chain out of id order", [{5, 300, 0}, {3, 0, 0}, {9, 150, 30}], [[3, 5, 9]]},
    {"overlap of exactly 8 on x stays apart", [{1, 0, 0}, {2, 192, 0}], [[1], [2]]},
    {"overlap of 9 on x groups", [{1, 0, 0}, {2, 191, 0}], [[1, 2]]},
    {"overlap of exactly 8 on y stays apart", [{1, 0, 0}, {2, 0, 56}], [[1], [2]]},
    {"overlap of 9 on y groups", [{1, 0, 0}, {2, 0, 55}], [[1, 2]]},
    {"edge-touching stays apart", [{1, 0, 0}, {2, 200, 0}, {3, 0, 64}], [[1], [2], [3]]},
    {"overlap on one axis only stays apart", [{1, 0, 0}, {2, 50, 300}], [[1], [2]]},
    {"negative coordinates", [{1, -500, -300}, {2, -400, -250}, {3, 0, 0}], [[1, 2], [3]]},
    {"action items and unpositioned ideas excluded",
     [{1, 0, 0}, {2, 10, 10, "action-item"}, {3, nil, nil}, {4, 20, 20}], [[1, 4]]},
    {"two separate groups", [{1, 0, 0}, {2, 50, 50}, {3, 600, 0}, {4, 650, 40}, {5, 1200, 0}],
     [[1, 2], [3, 4], [5]]},
    # Tall cards (heights 224 and 144) extend downwards from their top-left anchor.
    {"tall card reaches a card below only because of its height",
     [{1, 0, 0, "happy", @tall_200}, {2, 0, 200}], [[1, 2]]},
    {"tall card overlapping by exactly 8 below stays apart",
     [{1, 0, 0, "happy", @tall_200}, {2, 0, 216}], [[1], [2]]},
    {"tall card overlapping by 9 below groups", [{1, 0, 0, "happy", @tall_200}, {2, 0, 215}],
     [[1, 2]]},
    {"multi-line body grows the card", [{1, 0, 0, "happy", @five_lines}, {2, 50, 130}], [[1, 2]]},
    {"tall card too far above does not reach", [{1, 0, 0, "happy", @tall_200}, {2, 0, 230}],
     [[1], [2]]},
    {"a tall card's height does not extend upwards", [{1, 0, 0}, {2, 0, 59, "happy", @tall_200}],
     [[1], [2]]},
    {"chain through a tall card", [{1, 0, 0}, {2, 150, 50, "happy", @tall_200}, {3, 300, 250}],
     [[1, 2, 3]]}
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
