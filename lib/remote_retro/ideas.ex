defmodule RemoteRetro.Ideas do
  @moduledoc """
  Ideas (including action items). Always scoped to a retro.

  Regular ideas are written during `idea-generation` and moved on the board
  during `grouping` (which is also where groups are labeled); action items (category `"action-item"`) are
  written during `action-items` and must be assigned to a participant.
  """
  import Ecto.Query
  alias RemoteRetro.{Formats, Groups, Repo, Retros}
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Retros.Retro

  @max_coordinate 1.0e6

  def get_idea(retro_id, id),
    do: Repo.one(from i in Idea, where: i.retro_id == ^retro_id and i.id == ^id)

  def fetch_idea(retro_id, id) do
    case get_idea(retro_id, id) do
      nil -> {:error, :not_found}
      idea -> {:ok, idea}
    end
  end

  def list_ideas(retro_id),
    do: Repo.all(from i in Idea, where: i.retro_id == ^retro_id, order_by: i.id)

  def action_item?(%Idea{category: category}), do: category == Formats.action_item()

  @doc "Creates an idea (or action item, depending on `category`) authored by `user_id`."
  def create_idea(%Retro{} = retro, user_id, attrs) do
    action_item? = attrs["category"] == Formats.action_item()

    with :ok <- Retros.ensure_ai_idle(retro),
         :ok <- ensure_writable_stage(retro, action_item?) do
      %Idea{retro_id: retro.id, user_id: user_id}
      |> Idea.create_changeset(attrs)
      |> validate_content(retro, action_item?)
      |> Repo.insert()
    end
  end

  @doc "Edits body/category/assignee. Only the author or the facilitator may edit."
  def update_idea(%Retro{} = retro, actor_id, id, attrs) do
    with {:ok, idea} <- fetch_idea(retro.id, id),
         :ok <- authorize_author(retro, idea, actor_id),
         :ok <- Retros.ensure_ai_idle(retro),
         :ok <- ensure_writable_stage(retro, action_item?(idea)) do
      idea
      |> Idea.update_changeset(attrs)
      |> validate_content(retro, action_item?(idea))
      |> Repo.update()
    end
  end

  @doc """
  Deletes an idea (author or facilitator). On the board stages the groups are
  re-synced in the same transaction; `synced` is the `Groups.sync/1` result
  then, otherwise `nil`.
  """
  def delete_idea(%Retro{} = retro, actor_id, id) do
    with {:ok, idea} <- fetch_idea(retro.id, id),
         :ok <- authorize_author(retro, idea, actor_id),
         :ok <- Retros.ensure_ai_idle(retro),
         :ok <- ensure_deletable_stage(retro, idea) do
      Repo.transact(fn ->
        with {:ok, idea} <- Repo.delete(idea) do
          {:ok, %{idea: idea, synced: maybe_sync(retro)}}
        end
      end)
    end
  end

  @doc "Checks a live drag may be relayed to the room (nothing is persisted)."
  def authorize_drag(%Retro{} = retro, id) do
    with :ok <- Retros.ensure_ai_idle(retro),
         :ok <- Retros.ensure_stage(retro, Groups.board_stages()),
         {:ok, idea} <- fetch_idea(retro.id, id) do
      if action_item?(idea), do: {:error, :invalid}, else: :ok
    end
  end

  @doc """
  Drops an idea at `{x, y}` and regroups the board. Returns the
  `Groups.sync/1` payload, which always includes the moved idea.
  """
  def move_idea(%Retro{} = retro, id, x, y) do
    with :ok <- authorize_drag(retro, id),
         :ok <- validate_coordinates(x, y) do
      Repo.transact(fn ->
        {1, _} =
          Repo.update_all(from(i in Idea, where: i.id == ^id),
            set: [x: x * 1.0, y: y * 1.0, updated_at: DateTime.utc_now()]
          )

        {:ok, synced} = Groups.sync(retro.id)
        {:ok, include_moved(synced, id)}
      end)
    end
  end

  defp include_moved(%{ideas: ideas} = synced, id) do
    if Enum.any?(ideas, &(&1.id == id)) do
      synced
    else
      idea = Repo.get!(Idea, id)
      %{synced | ideas: ideas ++ [%{id: id, group_id: idea.group_id, x: idea.x, y: idea.y}]}
    end
  end

  defp validate_coordinates(x, y) when is_number(x) and is_number(y) do
    if abs(x) <= @max_coordinate and abs(y) <= @max_coordinate, do: :ok, else: {:error, :invalid}
  end

  defp validate_coordinates(_x, _y), do: {:error, :invalid}

  defp authorize_author(retro, %Idea{user_id: author_id}, actor_id) do
    if author_id == actor_id or Retros.facilitator?(retro, actor_id),
      do: :ok,
      else: {:error, :forbidden}
  end

  defp ensure_writable_stage(retro, true = _action_item?),
    do: Retros.ensure_stage(retro, "action-items")

  defp ensure_writable_stage(retro, false), do: Retros.ensure_stage(retro, "idea-generation")

  defp ensure_deletable_stage(retro, idea) do
    if action_item?(idea),
      do: Retros.ensure_stage(retro, "action-items"),
      else: Retros.ensure_stage(retro, ["idea-generation" | Groups.board_stages()])
  end

  defp maybe_sync(%Retro{stage: stage, id: id}) do
    if stage in Groups.board_stages() do
      {:ok, synced} = Groups.sync(id)
      synced
    end
  end

  # Categories can't cross between ideas and action items, and regular ideas
  # must use the retro format's categories.
  defp validate_content(changeset, %Retro{} = retro, action_item?) do
    allowed = if action_item?, do: [Formats.action_item()], else: Formats.categories(retro.format)

    changeset
    |> Ecto.Changeset.validate_inclusion(:category, allowed)
    |> Ecto.Changeset.validate_change(:assignee_id, fn :assignee_id, assignee_id ->
      if Retros.participant?(retro.id, assignee_id),
        do: [],
        else: [assignee_id: "must be a participant"]
    end)
  end

  @doc """
  Sets `{id, x, y}` positions for ideas in the retro in a single statement (one round trip,
  however many ideas — this matters on high-latency connections like dev → Cloud SQL).
  """
  def update_positions(_retro_id, []), do: :ok

  def update_positions(retro_id, positions) do
    {ids, xs, ys} =
      Enum.reduce(Enum.reverse(positions), {[], [], []}, fn {id, x, y}, {ids, xs, ys} ->
        {[id | ids], [x * 1.0 | xs], [y * 1.0 | ys]}
      end)

    Repo.query!(
      """
      UPDATE ideas AS i SET x = v.x, y = v.y, updated_at = $5
      FROM unnest($2::bigint[], $3::float8[], $4::float8[]) AS v(id, x, y)
      WHERE i.id = v.id AND i.retro_id = $1
      """,
      [Ecto.UUID.dump!(retro_id), ids, xs, ys, DateTime.utc_now()]
    )

    :ok
  end
end
