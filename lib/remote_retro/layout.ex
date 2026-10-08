defmodule RemoteRetro.Layout do
  @moduledoc """
  Initial board placement for ideas that have never been positioned.

  Unpositioned ideas are packed into columns with one column block per
  category (in the retro format's order), below any cards already on the
  board. Cards are stacked with their real `Grouping.card_height/1` plus a
  gap, so nothing overlaps and nothing groups by accident.
  """
  import Ecto.Query
  alias RemoteRetro.{Formats, Grouping, Repo}
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Retros.Retro

  @gap 40
  @rows_per_column 4

  def gap, do: @gap
  def rows_per_column, do: @rows_per_column

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

    now = DateTime.utc_now()

    {positions, _extent} = pack(pending, Formats.categories(format), {0, origin_y(positioned)})

    placed =
      Enum.map(positions, fn {idea, x, y} ->
        Repo.update_all(from(i in Idea, where: i.id == ^idea.id),
          set: [x: x, y: y, updated_at: now]
        )

        %{id: idea.id, group_id: idea.group_id, x: x, y: y}
      end)

    {:ok, placed}
  end

  defp origin_y([]), do: 0

  defp origin_y(positioned) do
    bottom = positioned |> Enum.map(&(&1.y + Grouping.card_height(&1.body))) |> Enum.max()
    bottom + 2 * @gap
  end

  @doc """
  Pure column packing. Ideas (`%{category, body}` plus anything else) are put
  in one column block per category, `category_order` first and any other
  categories after (sorted), keeping each category's input order. Each column
  holds at most `rows_per_column/0` cards stacked top to bottom with their real
  heights and `row_gap` between them; columns are `card_w + gap` apart, with an
  extra `gap` between category blocks.

  Returns `{[{idea, x, y}], extent}` where `extent` is `nil` for no ideas or
  `%{min_x, min_y, max_x, max_y}` of the packed cards' boxes.
  """
  def pack(ideas, category_order, {origin_x, origin_y}, row_gap \\ @gap) do
    by_category = Enum.group_by(ideas, & &1.category)
    extra = by_category |> Map.keys() |> Enum.reject(&(&1 in category_order)) |> Enum.sort()

    columns =
      (category_order ++ extra)
      |> Enum.map(&Map.get(by_category, &1, []))
      |> Enum.reject(&(&1 == []))
      |> Enum.with_index()
      |> Enum.flat_map(fn {cards, block} ->
        cards |> Enum.chunk_every(@rows_per_column) |> Enum.map(&{&1, block})
      end)

    positions =
      columns
      |> Enum.with_index()
      |> Enum.flat_map(fn {{cards, block}, column} ->
        x = origin_x + column * (Grouping.card_w() + @gap) + block * @gap

        cards
        |> Enum.map_reduce(origin_y, fn idea, y ->
          {{idea, x * 1.0, y * 1.0}, y + Grouping.card_height(idea.body) + row_gap}
        end)
        |> elem(0)
      end)

    {positions, extent(positions)}
  end

  @doc "`%{min_x, min_y, max_x, max_y}` of `[{idea, x, y}]` card boxes, or `nil`."
  def extent([]), do: nil

  def extent(positions) do
    Enum.reduce(positions, nil, fn {idea, x, y}, acc ->
      box = %{
        min_x: x,
        min_y: y,
        max_x: x + Grouping.card_w(),
        max_y: y + Grouping.card_height(idea.body)
      }

      case acc do
        nil ->
          box

        acc ->
          %{
            min_x: min(acc.min_x, box.min_x),
            min_y: min(acc.min_y, box.min_y),
            max_x: max(acc.max_x, box.max_x),
            max_y: max(acc.max_y, box.max_y)
          }
      end
    end)
  end
end
