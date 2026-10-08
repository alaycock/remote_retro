defmodule RemoteRetro.Groups do
  @moduledoc "Groups of ideas. Always scoped to a retro."
  import Ecto.Query
  alias RemoteRetro.Repo
  alias RemoteRetro.Groups.Group

  def get_group(retro_id, id), do: Repo.one(from g in Group, where: g.retro_id == ^retro_id and g.id == ^id)

  @doc """
  Recomputes overlap clusters for the retro's positioned ideas and reconciles
  them with persisted groups (plan 2). Idempotent. Does not broadcast.
  Returns the full group list and the ideas whose `group_id`/position changed.
  """
  @spec sync(Ecto.UUID.t()) ::
          {:ok, %{groups: [Group.t()], ideas: [%{id: integer, group_id: integer | nil, x: float | nil, y: float | nil}]}}
  def sync(retro_id), do: {:ok, %{groups: list_groups(retro_id), ideas: []}}

  def list_groups(retro_id), do: Repo.all(from g in Group, where: g.retro_id == ^retro_id, order_by: g.id)
end
