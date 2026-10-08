defmodule RemoteRetro.GroupingTest do
  use ExUnit.Case, async: true
  alias RemoteRetro.Grouping

  defp card(id, x, y, category \\ "happy"), do: %{id: id, x: x, y: y, category: category}

  test "exposes the shared board constants" do
    assert {Grouping.card_w(), Grouping.card_h(), Grouping.overlap_buffer()} == {200, 64, 8}
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
    assert Grouping.clusters([card(1, 0, 0), card(2, 0, 56)]) == [[1], [2]]
    assert Grouping.clusters([card(1, 0, 0), card(2, 0, 55.5)]) == [[1, 2]]
  end

  test "card_height/1 grows with wrapped lines and paragraphs, never below card_h" do
    assert Grouping.card_height(nil) == 64
    assert Grouping.card_height("") == 64
    assert Grouping.card_height(String.duplicate("x", 24)) == 64
    assert Grouping.card_height(String.duplicate("x", 25)) == 44 + 20 * 2
    assert Grouping.card_height(String.duplicate("x", 73)) == 44 + 20 * 4
    assert Grouping.card_height("a\nb\nc\nd\ne") == 144
    # Code points, not bytes or graphemes.
    assert Grouping.card_height(String.duplicate("é", 100)) == 44 + 20 * 5
  end

  test "tall cards cluster with what their extra height reaches, from their top-left" do
    tall = String.duplicate("x", 200)
    assert Grouping.clusters([card(1, 0, 0) |> Map.put(:body, tall), card(2, 0, 200)]) == [[1, 2]]
    assert Grouping.clusters([card(1, 0, 0), card(2, 0, 200)]) == [[1], [2]]

    assert Grouping.clusters([card(1, 0, 0), card(2, 0, 59) |> Map.put(:body, tall)]) == [
             [1],
             [2]
           ]

    assert Grouping.overlap?(%{x: 0, y: 0, body: tall}, %{x: 0, y: 215})
    refute Grouping.overlap?(%{x: 0, y: 0, body: tall}, %{x: 0, y: 216})
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
