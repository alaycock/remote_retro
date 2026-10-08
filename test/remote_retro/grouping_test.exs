defmodule RemoteRetro.GroupingTest do
  use ExUnit.Case, async: true
  alias RemoteRetro.Grouping

  defp card(id, x, y, category \\ "happy"), do: %{id: id, x: x, y: y, category: category}

  test "exposes the shared board constants" do
    assert {Grouping.card_w(), Grouping.card_h(), Grouping.overlap_buffer()} == {200, 120, 8}
  end

  test "far apart cards are separate singletons" do
    assert Grouping.clusters([card(2, 0, 0), card(1, 500, 500)]) == [[1], [2]]
  end

  test "overlapping cards cluster" do
    assert Grouping.clusters([card(1, 0, 0), card(2, 50, 30)]) == [[1, 2]]
  end

  test "chains form one connected component even when the ends do not overlap" do
    ideas = [card(1, 0, 0), card(2, 150, 0), card(3, 300, 0), card(4, 450, 0), card(5, 2000, 0)]
    assert Grouping.clusters(ideas) == [[1, 2, 3, 4], [5]]
  end

  test "touching or barely overlapping (<= buffer) cards do not cluster" do
    assert Grouping.clusters([card(1, 0, 0), card(2, 200, 0)]) == [[1], [2]]
    assert Grouping.clusters([card(1, 0, 0), card(2, 192, 0)]) == [[1], [2]]
    assert Grouping.clusters([card(1, 0, 0), card(2, 191, 0)]) == [[1, 2]]
    assert Grouping.clusters([card(1, 0, 0), card(2, 0, 112)]) == [[1], [2]]
    assert Grouping.clusters([card(1, 0, 0), card(2, 0, 111.5)]) == [[1, 2]]
  end

  test "overlap must hold on both axes" do
    assert Grouping.clusters([card(1, 0, 0), card(2, 10, 200)]) == [[1], [2]]
  end

  test "unpositioned ideas and action items are excluded" do
    ideas = [card(1, 0, 0), card(2, nil, nil), card(3, 10, 10, "action-item"), card(4, 10, nil)]
    assert Grouping.clusters(ideas) == [[1]]
  end

  test "output is deterministic regardless of input order" do
    ideas = [card(1, 0, 0), card(2, 100, 0), card(3, 1000, 0), card(4, 1100, 0)]
    for _ <- 1..10, do: assert(Grouping.clusters(Enum.shuffle(ideas)) == [[1, 2], [3, 4]])
  end
end
