defmodule RemoteRetro.AI.ApplyTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  alias RemoteRetro.AI.Apply
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Ideas.Idea

  @card_w 200
  @card_h 120
  @buffer 8

  defp overlaps?({ax, ay}, {bx, by}),
    do: @card_w - abs(ax - bx) > @buffer and @card_h - abs(ay - by) > @buffer

  defp touches?({ax, ay}, {bx, by}), do: abs(ax - bx) < @card_w and abs(ay - by) < @card_h

  describe "layout/2" do
    test "stacks each group so every consecutive pair overlaps beyond the buffer" do
      positions =
        Apply.layout({0.0, 0.0, 400.0, 300.0}, [%{idea_ids: [1, 2, 3]}, %{idea_ids: [4, 5]}])

      by_id = Map.new(positions, fn {id, x, y} -> {id, {x, y}} end)

      assert overlaps?(by_id[1], by_id[2])
      assert overlaps?(by_id[2], by_id[3])
      assert overlaps?(by_id[4], by_id[5])
      assert by_id[2] == {elem(by_id[1], 0) + 24, elem(by_id[1], 1) + 24}
    end

    test "places stacks right of existing content with an 80px gap, never touching each other" do
      bbox = {-100.0, 50.0, 400.0, 300.0}
      suggestions = for g <- 0..4, do: %{idea_ids: [g * 10 + 1, g * 10 + 2, g * 10 + 3]}
      positions = Apply.layout(bbox, suggestions)

      for {_id, x, _y} <- positions, do: assert(x >= 400 + @card_w + 80)
      assert positions |> Enum.map(fn {_, _, y} -> y end) |> Enum.min() == 50.0

      stacks =
        Enum.group_by(positions, fn {id, _, _} -> div(id, 10) end, fn {_, x, y} -> {x, y} end)

      for {a, cards_a} <- stacks, {b, cards_b} <- stacks, a < b, ca <- cards_a, cb <- cards_b do
        refute touches?(ca, cb)
      end
    end

    test "starts at the origin on an empty board" do
      assert [{1, +0.0, +0.0}, {2, 24.0, 24.0}] = Apply.layout(nil, [%{idea_ids: [1, 2]}])
    end
  end

  describe "candidates" do
    setup do
      user = user_fixture()
      retro = retro_fixture(user, %{stage: "grouping"})
      %{user: user, retro: retro}
    end

    test "grouping candidates exclude action items and ideas already in a multi-idea group", %{
      user: user,
      retro: retro
    } do
      group = group_fixture(retro)
      solo_group = group_fixture(retro)
      a = idea_fixture(retro, user, %{body: "a"})
      _grouped1 = idea_fixture(retro, user, %{body: "b", group_id: group.id})
      _grouped2 = idea_fixture(retro, user, %{body: "c", group_id: group.id})
      solo = idea_fixture(retro, user, %{body: "d", group_id: solo_group.id})

      _action =
        idea_fixture(retro, user, %{body: "e", category: "action-item", assignee_id: user.id})

      assert retro.id |> Apply.grouping_candidates() |> Enum.map(& &1.id) == [a.id, solo.id]
    end

    test "labeling candidates are unlabeled groups with 2+ ideas", %{user: user, retro: retro} do
      unlabeled = group_fixture(retro)
      labeled = group_fixture(retro, %{label: "Mine", label_source: "user"})
      single = group_fixture(retro)

      for g <- [unlabeled, labeled, unlabeled, labeled, single],
          do: idea_fixture(retro, user, %{body: "x#{g.id}", group_id: g.id})

      assert Apply.labeling_candidates(retro.id) == [
               %{id: unlabeled.id, ideas: ["x#{unlabeled.id}", "x#{unlabeled.id}"]}
             ]
    end
  end

  describe "apply_labels/2" do
    test "only fills groups that are still unlabeled" do
      user = user_fixture()
      retro = retro_fixture(user, %{stage: "labeling"})
      open = group_fixture(retro)
      taken = group_fixture(retro, %{label: "User label", label_source: "user"})
      other_retro_group = group_fixture(retro_fixture(user))

      assert Apply.apply_labels(retro.id, %{
               open.id => "Deploys",
               taken.id => "AI",
               other_retro_group.id => "AI"
             }) == 1

      assert %{label: "Deploys", label_source: "ai"} = Repo.get!(Group, open.id)
      assert %{label: "User label", label_source: "user"} = Repo.get!(Group, taken.id)
      assert %{label: nil} = Repo.get!(Group, other_retro_group.id)
    end
  end

  describe "apply_grouping/2" do
    setup do
      user = user_fixture()
      retro = retro_fixture(user, %{stage: "grouping"})

      ideas =
        for {body, i} <- Enum.with_index(~w(a b c d)) do
          idea_fixture(retro, user, %{body: body, x: i * 240.0, y: 0.0})
        end

      %{retro: retro, ideas: ideas}
    end

    test "stacks suggested ideas in free space and leaves the rest alone", %{
      retro: retro,
      ideas: [a, b, c, d]
    } do
      assert {:ok, %{groups: 1}} =
               Apply.apply_grouping(retro.id, [%{idea_ids: [a.id, c.id, 999], label: nil}])

      new_a = Repo.get!(Idea, a.id)
      new_c = Repo.get!(Idea, c.id)
      assert new_a.x >= 3 * 240 + 200 + 80
      assert {new_c.x - new_a.x, new_c.y - new_a.y} == {24.0, 24.0}
      assert %{x: 240.0, y: +0.0} = Repo.get!(Idea, b.id)
      assert %{x: 720.0, y: +0.0} = Repo.get!(Idea, d.id)
    end

    test "does nothing when no suggestion survives re-validation", %{retro: retro, ideas: [a | _]} do
      assert {:ok, %{groups: 0, labeled: 0}} =
               Apply.apply_grouping(retro.id, [%{idea_ids: [a.id, 999], label: "x"}])
    end

    @tag :needs_groups_sync
    test "groups the stacked ideas and labels the new group", %{retro: retro, ideas: [a, b, c, d]} do
      assert {:ok, %{groups: 2, labeled: 1}} =
               Apply.apply_grouping(retro.id, [
                 %{idea_ids: [a.id, c.id], label: "Deploys"},
                 %{idea_ids: [b.id, d.id], label: nil}
               ])

      [na, nb, nc, nd] = for i <- [a, b, c, d], do: Repo.get!(Idea, i.id)
      assert na.group_id != nil and na.group_id == nc.group_id
      assert nb.group_id != nil and nb.group_id == nd.group_id
      assert na.group_id != nb.group_id
      assert %{label: "Deploys", label_source: "ai"} = Repo.get!(Group, na.group_id)
      assert %{label: nil} = Repo.get!(Group, nb.group_id)
    end
  end
end
