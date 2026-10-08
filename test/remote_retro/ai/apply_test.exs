defmodule RemoteRetro.AI.ApplyTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  alias RemoteRetro.AI.Apply
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Ideas.Idea

  alias RemoteRetro.Grouping

  @order ~w(happy sad confused)

  defp body(n), do: String.duplicate("x", n)
  defp h(idea), do: Grouping.card_height(idea.body)

  defp box(ideas_by_id, {id, x, y}) do
    idea = ideas_by_id[id]
    %{id: id, x: x, y: y, body: idea.body, min_y: y, max_y: y + h(idea), max_x: x + 200}
  end

  # Boxes strictly apart (not even touching) on at least one axis.
  defp apart?(a, b),
    do: a.max_x < b.x or b.max_x < a.x or a.max_y < b.min_y or b.max_y < a.min_y

  describe "layout/4" do
    setup do
      # 12 singles over three categories (7 happy -> two columns), and 8
      # groups of three with mixed heights (more than fit in one row).
      singles =
        for i <- 1..12 do
          category =
            cond do
              i <= 7 -> "happy"
              i <= 10 -> "sad"
              true -> "confused"
            end

          %{id: i, category: category, body: body(rem(i * 37, 160))}
        end

      grouped =
        for i <- 101..124, do: %{id: i, category: "sad", body: body(rem(i * 53, 300))}

      suggestions =
        grouped
        |> Enum.map(& &1.id)
        |> Enum.chunk_every(3)
        |> Enum.map(&%{idea_ids: &1})

      ideas = singles ++ grouped
      positions = Apply.layout(ideas, suggestions, @order)
      by_id = Map.new(ideas, &{&1.id, &1})
      boxes = Map.new(positions, fn {id, _, _} = p -> {id, box(by_id, p)} end)

      %{ideas: ideas, suggestions: suggestions, positions: positions, boxes: boxes}
    end

    test "positions every idea exactly once", %{ideas: ideas, positions: positions} do
      assert positions |> Enum.map(&elem(&1, 0)) |> Enum.sort() == Enum.map(ideas, & &1.id)
    end

    test "packs ungrouped ideas at the top: category columns, real heights, 24 gap, short columns",
         %{boxes: boxes} do
      singles = for i <- 1..12, do: boxes[i]
      columns = Enum.group_by(singles, & &1.x)

      for {_x, cards} <- columns do
        cards = Enum.sort_by(cards, & &1.y)
        assert length(cards) <= RemoteRetro.Layout.rows_per_column()
        assert hd(cards).y == 0.0

        for [a, b] <- Enum.chunk_every(cards, 2, 1, :discard),
            do: assert(b.y == a.max_y + 24)
      end

      # happy (7 -> 2 columns), sad, confused: columns 240 apart plus 40 per category block.
      assert columns |> Map.keys() |> Enum.sort() == [0.0, 240.0, 520.0, 800.0]

      # Singletons don't cluster with anything.
      for a <- singles, b <- Map.values(boxes), a.id != b.id, do: assert(apart?(a, b))
    end

    test "groups go below the ungrouped block as overlapping vertical cascades",
         %{boxes: boxes, suggestions: suggestions} do
      top_bottom = 1..12 |> Enum.map(&boxes[&1].max_y) |> Enum.max()

      stacks = for %{idea_ids: ids} <- suggestions, do: Enum.map(ids, &boxes[&1])

      assert stacks |> Enum.map(&hd(&1).y) |> Enum.min() == top_bottom + Apply.section_gap()

      for stack <- stacks, [a, b] <- Enum.chunk_every(stack, 2, 1, :discard) do
        assert b.x == a.x
        assert a.max_y - b.y == Apply.stack_overlap()
        assert Apply.stack_overlap() > Grouping.overlap_buffer()
        assert Grouping.overlap?(a, b)
      end

      # Distinct stacks never touch each other.
      for {sa, i} <- Enum.with_index(stacks),
          {sb, j} <- Enum.with_index(stacks),
          i < j,
          a <- sa,
          b <- sb,
          do: assert(apart?(a, b))
    end

    test "lays stacks out in rows of >= min_stacks_per_row, each row 120 below the tallest",
         %{boxes: boxes, suggestions: suggestions} do
      stacks =
        for %{idea_ids: ids} <- suggestions do
          cards = Enum.map(ids, &boxes[&1])
          %{x: hd(cards).x, top: hd(cards).y, bottom: cards |> Enum.map(& &1.max_y) |> Enum.max()}
        end

      rows = stacks |> Enum.group_by(& &1.top) |> Enum.sort_by(&elem(&1, 0))
      assert [{_, first}, {_, second}] = rows
      stride = 200 + Apply.stack_gap()
      per_row = Apply.min_stacks_per_row()
      assert Enum.map(first, & &1.x) == for(k <- 0..(per_row - 1), do: k * stride * 1.0)
      assert Enum.map(second, & &1.x) == for(k <- 0..(8 - per_row - 1), do: k * stride * 1.0)

      # The next row's labels (36 above the stack, ~32 tall) clear the previous row.
      {second_top, _} = Enum.at(rows, 1)
      assert second_top == (first |> Enum.map(& &1.bottom) |> Enum.max()) + Apply.section_gap()
      assert second_top - 36 - 32 > first |> Enum.map(& &1.bottom) |> Enum.max()
    end

    test "Grouping clusters exactly the suggested groups", %{
      ideas: ideas,
      positions: positions,
      suggestions: suggestions
    } do
      by_id = Map.new(ideas, &{&1.id, &1})

      placed =
        for {id, x, y} <- positions,
            do: %{id: id, x: x, y: y, body: by_id[id].body, category: "x"}

      multi = placed |> Grouping.clusters() |> Enum.filter(&(length(&1) > 1))
      assert Enum.sort(multi) == suggestions |> Enum.map(&Enum.sort(&1.idea_ids)) |> Enum.sort()
    end

    test "rows are at least as wide as the ungrouped block" do
      singles = for i <- 1..60, do: %{id: i, category: "happy", body: "s"}
      grouped = for i <- 101..120, do: %{id: i, category: "happy", body: "g"}

      suggestions =
        grouped |> Enum.map(& &1.id) |> Enum.chunk_every(2) |> Enum.map(&%{idea_ids: &1})

      positions = Apply.layout(singles ++ grouped, suggestions, @order)
      xs = Map.new(positions, fn {id, x, _} -> {id, x} end)
      # 60 singles -> 15 columns of 4, wide enough that all 10 stacks share one row.
      assert suggestions |> Enum.map(&xs[hd(&1.idea_ids)]) |> Enum.uniq() |> length() == 10
    end

    test "starts at the origin on an empty board and only stacks when nothing is ungrouped" do
      ideas = [%{id: 1, category: "happy", body: "a"}, %{id: 2, category: "happy", body: "b"}]

      next = (Grouping.card_h() - Apply.stack_overlap()) * 1.0
      shifted = 520 + next

      assert [{1, +0.0, +0.0}, {2, +0.0, ^next}] =
               Apply.layout(ideas, [%{idea_ids: [1, 2]}], @order)

      assert [{1, 10.0, 520.0}, {2, 10.0, ^shifted}] =
               Apply.layout(ideas, [%{idea_ids: [1, 2]}], @order, {10, 520})
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
  end

  describe "apply_grouping/2" do
    setup do
      user = user_fixture()
      retro = retro_fixture(user, %{stage: "grouping"})

      ideas =
        for {body, i} <- Enum.with_index(~w(a b c d)) do
          idea_fixture(retro, user, %{body: body, x: i * 240.0, y: 0.0})
        end

      %{retro: retro, ideas: ideas, user: user}
    end

    test "packs ungrouped ideas on top and cascades suggested ones below", %{
      retro: retro,
      ideas: [a, b, c, d]
    } do
      assert {:ok, %{groups: 1}} =
               Apply.apply_grouping(retro.id, [%{idea_ids: [a.id, c.id, 999], label: nil}])

      [na, nb, nc, nd] = for i <- [a, b, c, d], do: Repo.get!(Idea, i.id)
      # b and d (both happy, one-line) stacked in one column at the top, 24 apart.
      h = Grouping.card_h()
      assert {nb.x, nb.y} == {+0.0, +0.0}
      assert {nd.x, nd.y} == {+0.0, h + 24.0}
      # a and c cascade section_gap below that block, overlapping by stack_overlap.
      top = 2.0 * h + 24 + Apply.section_gap()
      assert {na.x, na.y} == {+0.0, top}
      assert {nc.x, nc.y} == {+0.0, top + h - Apply.stack_overlap()}
      assert na.group_id != nil and na.group_id == nc.group_id
      assert nb.group_id != nd.group_id
    end

    test "starts below ideas that are already in multi-idea groups", %{retro: retro, user: user} do
      group = group_fixture(retro)
      kept = idea_fixture(retro, user, %{body: body(200), x: 50.0, y: 1000.0, group_id: group.id})
      idea_fixture(retro, user, %{body: "k", x: 60.0, y: 1010.0, group_id: group.id})
      [e, f] = for b <- ~w(e f), do: idea_fixture(retro, user, %{body: b, x: 0.0, y: 0.0})

      assert {:ok, %{groups: 1}} =
               Apply.apply_grouping(retro.id, [%{idea_ids: [e.id, f.id], label: nil}])

      top = kept.y + Grouping.card_height(kept.body) + 120

      assert Repo.get!(Idea, e.id).y >= top
      assert Repo.get!(Idea, e.id).x == 50.0
      assert Repo.get!(Idea, kept.id).y == 1000.0
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
