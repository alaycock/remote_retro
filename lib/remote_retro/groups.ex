defmodule RemoteRetro.Groups do
  @moduledoc "Groups of ideas. Always scoped to a retro."
  import Ecto.Query
  alias RemoteRetro.{Grouping, Repo, Retros}
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Retros.Retro

  @board_stages ~w(grouping)

  @doc "Stages in which ideas can be moved and groups relabelled."
  def board_stages, do: @board_stages

  def get_group(retro_id, id),
    do: Repo.one(from g in Group, where: g.retro_id == ^retro_id and g.id == ^id)

  def fetch_group(retro_id, id) do
    case get_group(retro_id, id) do
      nil -> {:error, :not_found}
      group -> {:ok, group}
    end
  end

  def list_groups(retro_id),
    do: Repo.all(from g in Group, where: g.retro_id == ^retro_id, order_by: g.id)

  @doc """
  Sets a group's label on behalf of a participant (`label_source: "user"`).
  Blank labels clear it.
  """
  def update_label(%Retro{} = retro, id, label) do
    with :ok <- Retros.ensure_ai_idle(retro),
         :ok <- Retros.ensure_stage(retro, @board_stages),
         {:ok, group} <- fetch_group(retro.id, id) do
      group
      |> Group.changeset(%{label: label, label_source: "user"})
      |> Repo.update()
    end
  end

  @doc """
  Recomputes overlap clusters for the retro's positioned ideas and reconciles
  them with persisted groups. Idempotent. Does not broadcast.
  Returns the full group list and the ideas whose `group_id` changed.

  Each cluster keeps the existing group most of its members already belong to
  (ties go to the lowest id); larger clusters claim groups first, and each
  group is claimed at most once, so a split keeps the id and label on the
  larger side. Groups left without ideas are deleted, cascading their votes.
  """
  @spec sync(Ecto.UUID.t()) ::
          {:ok,
           %{
             groups: [Group.t()],
             ideas: [%{id: integer, group_id: integer | nil, x: float | nil, y: float | nil}]
           }}
  def sync(retro_id) do
    Repo.transact(fn ->
      Retros.lock_retro!(retro_id)

      ideas = Repo.all(from i in Idea, where: i.retro_id == ^retro_id, order_by: i.id)
      targets = assign_groups(Grouping.clusters(ideas), ideas, retro_id)
      changed = Enum.filter(ideas, &(Map.get(targets, &1.id) != &1.group_id))

      persist_assignments(changed, targets)
      delete_unused_groups(retro_id, targets |> Map.values() |> Enum.uniq())

      {:ok,
       %{
         groups: list_groups(retro_id),
         ideas:
           Enum.map(changed, &%{id: &1.id, group_id: Map.get(targets, &1.id), x: &1.x, y: &1.y})
       }}
    end)
  end

  # Returns %{idea_id => group_id} for every clustered idea.
  defp assign_groups(clusters, ideas, retro_id) do
    current = Map.new(ideas, &{&1.id, &1.group_id})
    available = list_groups(retro_id) |> MapSet.new(& &1.id)

    clusters
    |> Enum.sort_by(&{-length(&1), hd(&1)})
    |> Enum.reduce({%{}, available}, fn cluster, {targets, available} ->
      {group_id, available} = claim_group(cluster, current, available, retro_id)
      {Enum.reduce(cluster, targets, &Map.put(&2, &1, group_id)), available}
    end)
    |> elem(0)
  end

  defp claim_group(cluster, current, available, retro_id) do
    counts =
      cluster
      |> Enum.map(&Map.get(current, &1))
      |> Enum.filter(&MapSet.member?(available, &1))
      |> Enum.frequencies()

    case Enum.min_by(counts, fn {id, count} -> {-count, id} end, fn -> nil end) do
      {group_id, _count} -> {group_id, MapSet.delete(available, group_id)}
      nil -> {Repo.insert!(%Group{retro_id: retro_id}).id, available}
    end
  end

  defp persist_assignments(changed, targets) do
    now = DateTime.utc_now()

    changed
    |> Enum.group_by(&Map.get(targets, &1.id), & &1.id)
    |> Enum.each(fn {group_id, ids} ->
      Repo.update_all(from(i in Idea, where: i.id in ^ids),
        set: [group_id: group_id, updated_at: now]
      )
    end)
  end

  defp delete_unused_groups(retro_id, used_ids) do
    Repo.delete_all(from g in Group, where: g.retro_id == ^retro_id and g.id not in ^used_ids)
  end
end
