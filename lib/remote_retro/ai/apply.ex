defmodule RemoteRetro.AI.Apply do
  @moduledoc """
  Applies validated AI suggestions to a retro.

  Each suggested group's ideas are cascaded mostly vertically from an anchor
  (offset 12,84 per card). Neighbouring 200x120 cards then overlap by 188x36,
  well over the 8px buffer on both axes, so `Groups.sync/1` clusters them,
  while each card's author line and first couple of text lines stay visible.
  Anchors are laid out in a grid in free space to the right of every
  positioned idea; cells are sized for the largest stack plus an 80px gap so
  stacks never touch each other or existing cards. Other ideas stay where they
  are.

  A label the model suggested is only written to a group that is still
  unlabelled at apply time (`label_source: "ai"`), so user edits always win.
  Does not broadcast.
  """
  import Ecto.Query
  alias RemoteRetro.{Formats, Groups, Repo}
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Ideas.Idea

  @card_w 200
  @card_h 120
  @offset_x 12
  @offset_y 84
  @gap 80

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
    candidate_ids = retro_id |> grouping_candidates() |> MapSet.new(& &1.id)

    suggestions =
      for %{idea_ids: ids} = suggestion <- suggestions,
          ids = Enum.filter(ids, &MapSet.member?(candidate_ids, &1)),
          length(ids) >= 2,
          do: %{suggestion | idea_ids: ids}

    if suggestions == [] do
      {:ok, %{groups: 0, labeled: 0}}
    else
      positions = layout(bounding_box(retro_id), suggestions)
      now = DateTime.utc_now()

      {:ok, _} =
        Repo.transact(fn ->
          for {id, x, y} <- positions do
            Repo.update_all(from(i in Idea, where: i.retro_id == ^retro_id and i.id == ^id),
              set: [x: x, y: y, updated_at: now]
            )
          end

          {:ok, length(positions)}
        end)

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
  Pure layout: `[{idea_id, x, y}]` for each suggestion, stacked at grid anchors
  right of `bbox` (`{min_x, min_y, max_x, max_y}` of card origins, or `nil`).
  """
  def layout(bbox, suggestions) do
    {origin_x, origin_y} =
      case bbox do
        nil -> {0, 0}
        {_min_x, min_y, max_x, _max_y} -> {max_x + @card_w + @gap, min_y}
      end

    largest = suggestions |> Enum.map(&length(&1.idea_ids)) |> Enum.max(fn -> 1 end)
    cell_w = @card_w + @offset_x * (largest - 1) + @gap
    cell_h = @card_h + @offset_y * (largest - 1) + @gap
    cols = suggestions |> length() |> :math.sqrt() |> ceil() |> max(1)

    for {%{idea_ids: ids}, index} <- Enum.with_index(suggestions),
        anchor_x = origin_x + rem(index, cols) * cell_w,
        anchor_y = origin_y + div(index, cols) * cell_h,
        {id, k} <- Enum.with_index(ids) do
      {id, (anchor_x + k * @offset_x) * 1.0, (anchor_y + k * @offset_y) * 1.0}
    end
  end

  defp bounding_box(retro_id) do
    case Repo.one(
           from i in Idea,
             where: i.retro_id == ^retro_id and not is_nil(i.x) and not is_nil(i.y),
             select: {min(i.x), min(i.y), max(i.x), max(i.y)}
         ) do
      {nil, _, _, _} -> nil
      nil -> nil
      bbox -> bbox
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
