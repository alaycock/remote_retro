defmodule RemoteRetro.Ideas do
  @moduledoc "Ideas (including action items). Always scoped to a retro."
  import Ecto.Query
  alias RemoteRetro.Repo
  alias RemoteRetro.Ideas.Idea

  def get_idea(retro_id, id), do: Repo.one(from i in Idea, where: i.retro_id == ^retro_id and i.id == ^id)

  def list_ideas(retro_id), do: Repo.all(from i in Idea, where: i.retro_id == ^retro_id, order_by: i.id)
end
