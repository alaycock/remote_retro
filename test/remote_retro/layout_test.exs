defmodule RemoteRetro.LayoutTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  alias RemoteRetro.{Grouping, Ideas, Layout}

  test "places unpositioned ideas in a non-overlapping grid by category, below existing cards" do
    user = user_fixture()
    retro = retro_fixture(user, %{stage: "grouping"})
    existing = idea_fixture(retro, user, %{x: 0.0, y: 0.0})
    for _ <- 1..8, do: idea_fixture(retro, user, %{category: "happy"})
    for _ <- 1..3, do: idea_fixture(retro, user, %{category: "sad"})
    idea_fixture(retro, user, %{category: "confused"})
    action = idea_fixture(retro, user, %{category: "action-item", assignee_id: user.id})

    assert {:ok, placed} = Layout.place_unpositioned(retro.id)
    assert length(placed) == 12

    ideas = Ideas.list_ideas(retro.id)
    board = Enum.reject(ideas, &(&1.id == action.id))
    assert Enum.all?(board, &(is_float(&1.x) and is_float(&1.y)))
    assert is_nil(Enum.find(ideas, &(&1.id == action.id)).x)

    for a <- board, b <- board, a.id < b.id, do: refute(Grouping.overlap?(a, b))
    assert Enum.all?(placed, &(&1.y >= existing.y + Grouping.card_h()))

    # Categories occupy separate column blocks in format order.
    max_x = fn cat ->
      board
      |> Enum.filter(&(&1.category == cat and &1.id != existing.id))
      |> Enum.map(& &1.x)
      |> Enum.max()
    end

    min_x = fn cat ->
      board
      |> Enum.filter(&(&1.category == cat and &1.id != existing.id))
      |> Enum.map(& &1.x)
      |> Enum.min()
    end

    assert max_x.("happy") < min_x.("sad")
    assert max_x.("sad") < min_x.("confused")

    assert {:ok, []} = Layout.place_unpositioned(retro.id)
  end

  test "stacks mixed-height cards by their real heights so none overlap or touch" do
    user = user_fixture()
    retro = retro_fixture(user, %{stage: "grouping"})
    tall = idea_fixture(retro, user, %{x: 0.0, y: 0.0, body: String.duplicate("x", 400)})

    for i <- 1..14 do
      body = String.duplicate("word ", rem(i * 7, 60))
      idea_fixture(retro, user, %{category: Enum.at(~w(happy sad), rem(i, 2)), body: body})
    end

    assert {:ok, placed} = Layout.place_unpositioned(retro.id)
    assert length(placed) == 14

    board = Ideas.list_ideas(retro.id)
    assert Enum.any?(board, &(Grouping.card_height(&1.body) > 200))

    for a <- board, b <- board, a.id < b.id do
      refute Grouping.overlap?(a, b)
      # Not even touching: boxes are separated on at least one axis.
      ha = Grouping.card_height(a.body)
      hb = Grouping.card_height(b.body)
      ox = min(a.x, b.x) + Grouping.card_w() <= max(a.x, b.x)
      oy = if a.y <= b.y, do: a.y + ha < b.y, else: b.y + hb < a.y
      assert ox or oy, "#{a.id} and #{b.id} touch"
    end

    # Everything starts below the tall existing card's real bottom.
    assert Enum.all?(placed, &(&1.y >= tall.y + Grouping.card_height(tall.body)))

    # Assert `Grouping.clusters/1` sees only singletons.
    assert board |> Grouping.clusters() |> Enum.all?(&(length(&1) == 1))
  end
end
