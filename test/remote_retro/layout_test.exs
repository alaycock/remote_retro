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
end
