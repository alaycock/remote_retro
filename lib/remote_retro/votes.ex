defmodule RemoteRetro.Votes do
  @moduledoc "Votes on groups during the voting stage. Each participant gets `limit/0` per retro."
  import Ecto.Query
  alias RemoteRetro.{Groups, Repo, Retros}
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Retros.Retro
  alias RemoteRetro.Votes.Vote

  @limit 3

  def limit, do: @limit

  def count_user_votes(retro_id, user_id) do
    Repo.aggregate(
      from(v in Vote,
        join: g in Group,
        on: g.id == v.group_id,
        where: g.retro_id == ^retro_id and v.user_id == ^user_id
      ),
      :count
    )
  end

  @doc "Casts a vote for a group. The limit is checked under the retro's row lock."
  def create_vote(%Retro{} = retro, user_id, group_id) do
    with :ok <- Retros.ensure_stage(retro, "voting"),
         {:ok, group} <- Groups.fetch_group(retro.id, group_id) do
      Repo.transact(fn ->
        Retros.lock_retro!(retro.id)

        if count_user_votes(retro.id, user_id) >= @limit do
          {:error, :vote_limit}
        else
          %Vote{} |> Vote.changeset(%{user_id: user_id, group_id: group.id}) |> Repo.insert()
        end
      end)
    end
  end

  @doc "Removes one of the user's own votes."
  def delete_vote(%Retro{} = retro, user_id, id) do
    with :ok <- Retros.ensure_stage(retro, "voting"),
         {:ok, vote} <- fetch_vote(retro.id, id) do
      if vote.user_id == user_id, do: Repo.delete(vote), else: {:error, :forbidden}
    end
  end

  defp fetch_vote(retro_id, id) do
    query =
      from v in Vote,
        join: g in Group,
        on: g.id == v.group_id,
        where: g.retro_id == ^retro_id and v.id == ^id

    case Repo.one(query) do
      nil -> {:error, :not_found}
      vote -> {:ok, vote}
    end
  end
end
