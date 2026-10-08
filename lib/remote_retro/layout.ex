defmodule RemoteRetro.Layout do
  @moduledoc """
  Initial board placement for ideas that have never been positioned.

  Unpositioned ideas are laid out in a grid with one column block per
  category (in the retro format's order), below any cards already on the
  board, so nothing overlaps and nothing groups by accident.
  """
  import Ecto.Query
  alias RemoteRetro.{Formats, Grouping, Repo}
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Retros.Retro

  @gap 40
  @rows_per_column 6

  def gap, do: @gap

  @doc """
  Gives every unpositioned, non-action-item idea in the retro an `{x, y}`.
  Returns the ideas it moved as `%{id, group_id, x, y}` maps.
  """
  @spec place_unpositioned(Ecto.UUID.t()) ::
          {:ok, [%{id: integer, group_id: integer | nil, x: float, y: float}]}
  def place_unpositioned(retro_id) do
    %Retro{format: format} = Repo.get!(Retro, retro_id)

    {positioned, pending} =
      Repo.all(
        from i in Idea,
          where: i.retro_id == ^retro_id and i.category != ^Formats.action_item(),
          order_by: i.id
      )
      |> Enum.split_with(&(is_number(&1.x) and is_number(&1.y)))

    origin_y = origin_y(positioned)
    now = DateTime.utc_now()

    placed =
      pending
      |> grid(Formats.categories(format), origin_y)
      |> Enum.map(fn {idea, x, y} ->
        Repo.update_all(from(i in Idea, where: i.id == ^idea.id),
          set: [x: x, y: y, updated_at: now]
        )

        %{id: idea.id, group_id: idea.group_id, x: x, y: y}
      end)

    {:ok, placed}
  end

  defp origin_y([]), do: 0.0

  defp origin_y(positioned) do
    bottom = positioned |> Enum.map(& &1.y) |> Enum.max()
    bottom + Grouping.card_h() + 2 * @gap
  end

  defp grid(ideas, category_order, origin_y) do
    by_category = Enum.group_by(ideas, & &1.category)
    extra = by_category |> Map.keys() |> Enum.reject(&(&1 in category_order)) |> Enum.sort()

    (category_order ++ extra)
    |> Enum.map(&Map.get(by_category, &1, []))
    |> Enum.reject(&(&1 == []))
    |> Enum.with_index()
    |> Enum.flat_map_reduce(0, fn {cards, block}, first_column ->
      positions =
        cards
        |> Enum.with_index()
        |> Enum.map(fn {idea, i} ->
          column = first_column + div(i, @rows_per_column)
          row = rem(i, @rows_per_column)
          x = column * (Grouping.card_w() + @gap) + block * @gap
          y = origin_y + row * (Grouping.card_h() + @gap)
          {idea, x * 1.0, y * 1.0}
        end)

      {positions, first_column + div(length(cards) - 1, @rows_per_column) + 1}
    end)
    |> elem(0)
  end
end
