defmodule RemoteRetro.AI.Apply do
  @moduledoc """
  Applies validated AI suggestions to a retro.

  Runs when the board is fresh, so every grouping candidate is re-laid out:

    * Ideas the AI left ungrouped are packed compactly at the top with
      `Layout.pack/4` (one column block per category, real card heights, a
      24px gap, at most `Layout.rows_per_column/0` cards per column).
    * Each suggested group becomes a vertical cascade below that block: every
      card starts 12px above the previous card's bottom (same x), so
      neighbours overlap by 12 (> the 8px buffer, so `Groups.sync/1` clusters
      them) and only their bottom padding is covered: all text stays visible.
    * Stacks are laid left to right, 80px apart, in rows at least as wide as
      the ungrouped block and about half the groups (so roughly two rows); each row starts 120px
      below the previous row's tallest stack, leaving room for the floating
      group label 36px above a group.

  Ideas already in multi-idea groups are not candidates; when any are on the
  board the new layout starts 120px below them.

  A label the model suggested is only written to a group that is still
  unlabelled at apply time (`label_source: "ai"`), so user edits always win.
  Does not broadcast.
  """
  import Ecto.Query
  alias RemoteRetro.{Formats, Grouping, Groups, Ideas, Layout, Repo}
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Retros.Retro

  @stack_overlap 12
  @single_gap 24
  @stack_gap 80
  @section_gap 120
  @min_stacks_per_row 6

  def stack_overlap, do: @stack_overlap
  def stack_gap, do: @stack_gap
  def section_gap, do: @section_gap
  def min_stacks_per_row, do: @min_stacks_per_row

  @doc "Non-action ideas that are not already in a multi-idea group."
  def grouping_candidates(retro_id) do
    grouped = multi_idea_group_ids(retro_id)

    Repo.all(
      from i in Idea,
        where: i.retro_id == ^retro_id and i.category != ^Formats.action_item(),
        order_by: i.id
    )
    |> Enum.reject(&(&1.group_id in grouped))
  end

  @doc """
  Positions suggested groups, runs `Groups.sync/1` and sets AI labels.
  Suggestions are re-checked against the current candidates first.
  """
  @spec apply_grouping(Ecto.UUID.t(), [%{idea_ids: [integer], label: String.t() | nil}]) ::
          {:ok, %{groups: non_neg_integer, labeled: non_neg_integer}}
  def apply_grouping(retro_id, suggestions) do
    candidates = grouping_candidates(retro_id)
    candidate_ids = MapSet.new(candidates, & &1.id)

    suggestions =
      for %{idea_ids: ids} = suggestion <- suggestions,
          ids = Enum.filter(ids, &MapSet.member?(candidate_ids, &1)),
          length(ids) >= 2,
          do: %{suggestion | idea_ids: ids}

    if suggestions == [] do
      {:ok, %{groups: 0, labeled: 0}}
    else
      %Retro{format: format} = Repo.get!(Retro, retro_id)

      positions =
        layout(candidates, suggestions, Formats.categories(format), origin(retro_id, candidates))

      :ok = Ideas.update_positions(retro_id, positions)

      {:ok, _} = Groups.sync(retro_id)

      group_of =
        Repo.all(from i in Idea, where: i.retro_id == ^retro_id, select: {i.id, i.group_id})
        |> Map.new()

      labeled =
        for %{idea_ids: ids, label: label} when is_binary(label) <- suggestions,
            [group_id] <- [ids |> Enum.map(&group_of[&1]) |> Enum.uniq()],
            group_id != nil,
            reduce: 0 do
          count -> count + set_label_if_unlabeled(retro_id, group_id, label)
        end

      {:ok, %{groups: length(suggestions), labeled: labeled}}
    end
  end

  @doc """
  Pure layout: `[{idea_id, x, y}]` for every idea in `ideas` (`%{id, category,
  body}`), starting at `origin`. Ideas in no suggestion are packed at the top;
  each suggestion's ideas are cascaded in suggestion order below them (see the
  moduledoc).
  """
  def layout(ideas, suggestions, category_order, {origin_x, origin_y} = origin \\ {0, 0}) do
    by_id = Map.new(ideas, &{&1.id, &1})
    grouped = suggestions |> Enum.flat_map(& &1.idea_ids) |> MapSet.new()
    singles = Enum.reject(ideas, &MapSet.member?(grouped, &1.id))

    {packed, extent} = Layout.pack(singles, category_order, origin, @single_gap)

    {groups_top, block_w} =
      case extent do
        nil -> {origin_y, 0}
        e -> {e.max_y + @section_gap, e.max_x - origin_x}
      end

    # Aim for about two rows of groups so the board is wide rather than tall
    # (screens are landscape and Fit is otherwise limited by height).
    per_row = max(@min_stacks_per_row, ceil(length(suggestions) / 2))
    row_w = max(block_w, per_row * Grouping.card_w() + (per_row - 1) * @stack_gap)

    stacks =
      for %{idea_ids: ids} <- suggestions do
        cards = Enum.map(ids, &Map.fetch!(by_id, &1))
        {cards, stack_height(cards)}
      end

    {stacked, _} =
      Enum.flat_map_reduce(stacks, {origin_x, groups_top, 0}, fn {cards, height},
                                                                 {x, top, tallest} ->
        {x, top, tallest} =
          if x > origin_x and x + Grouping.card_w() > origin_x + row_w,
            do: {origin_x, top + tallest + @section_gap, 0},
            else: {x, top, tallest}

        {cascade(cards, x, top), {x + Grouping.card_w() + @stack_gap, top, max(tallest, height)}}
      end)

    Enum.map(packed, fn {idea, x, y} -> {idea.id, x, y} end) ++ stacked
  end

  defp cascade(cards, x, top) do
    cards
    |> Enum.map_reduce(top, fn idea, y ->
      {{idea.id, x * 1.0, y * 1.0}, y + Grouping.card_height(idea.body) - @stack_overlap}
    end)
    |> elem(0)
  end

  defp stack_height(cards) do
    heights = Enum.map(cards, &Grouping.card_height(&1.body))
    Enum.sum(heights) - @stack_overlap * (length(heights) - 1)
  end

  # Start below any positioned idea that is not being re-laid out (ideas
  # already in multi-idea groups), or at the origin on a fresh board.
  defp origin(retro_id, candidates) do
    candidate_ids = Enum.map(candidates, & &1.id)

    kept =
      Repo.all(
        from i in Idea,
          where:
            i.retro_id == ^retro_id and i.category != ^Formats.action_item() and
              not is_nil(i.x) and not is_nil(i.y) and i.id not in ^candidate_ids
      )

    case kept do
      [] ->
        {0, 0}

      _ ->
        left = kept |> Enum.map(& &1.x) |> Enum.min()
        bottom = kept |> Enum.map(&(&1.y + Grouping.card_height(&1.body))) |> Enum.max()
        {left, bottom + @section_gap}
    end
  end

  defp multi_idea_group_ids(retro_id) do
    Repo.all(
      from i in Idea,
        where: i.retro_id == ^retro_id and not is_nil(i.group_id),
        group_by: i.group_id,
        having: count(i.id) >= 2,
        select: i.group_id
    )
    |> MapSet.new()
  end

  defp set_label_if_unlabeled(retro_id, group_id, label) do
    {count, _} =
      Repo.update_all(
        from(g in Group,
          where: g.retro_id == ^retro_id and g.id == ^group_id and is_nil(g.label)
        ),
        set: [label: label, label_source: "ai", updated_at: DateTime.utc_now()]
      )

    count
  end
end
