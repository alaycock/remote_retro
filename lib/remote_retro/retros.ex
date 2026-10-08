defmodule RemoteRetro.Retros do
  @moduledoc "Retros, participation and the full-state snapshot sent to clients."
  import Ecto.Query
  alias RemoteRetro.Repo
  alias RemoteRetro.Retros.{Retro, Participation}
  alias RemoteRetro.Accounts.User
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Votes.Vote

  def get_retro(id) do
    case Ecto.UUID.cast(id) do
      {:ok, uuid} -> Repo.get(Retro, uuid)
      :error -> nil
    end
  end

  def get_retro!(id), do: Repo.get!(Retro, id)

  def create_retro(%User{id: user_id}, format) do
    Repo.transact(fn ->
      with {:ok, retro} <-
             %Retro{} |> Retro.create_changeset(%{format: format, facilitator_id: user_id}) |> Repo.insert(),
           :ok <- participate(retro, user_id) do
        {:ok, retro}
      end
    end)
  end

  @doc "Retros the user has participated in, newest first."
  def list_retros_for_user(%User{id: user_id}, limit \\ 20) do
    Repo.all(
      from r in Retro,
        join: p in Participation,
        on: p.retro_id == r.id and p.user_id == ^user_id,
        order_by: [desc: r.inserted_at],
        limit: ^limit
    )
  end

  def participate(%Retro{id: retro_id}, user_id) do
    now = DateTime.utc_now()

    Repo.insert_all(
      Participation,
      [%{retro_id: retro_id, user_id: user_id, inserted_at: now, updated_at: now}],
      on_conflict: :nothing,
      conflict_target: [:user_id, :retro_id]
    )

    :ok
  end

  def facilitator?(%Retro{facilitator_id: fid}, user_id), do: fid == user_id

  def update_retro(%Retro{} = retro, attrs), do: retro |> Retro.changeset(attrs) |> Repo.update()

  def list_participants(retro_id) do
    Repo.all(
      from u in User,
        join: p in Participation,
        on: p.user_id == u.id and p.retro_id == ^retro_id,
        order_by: p.inserted_at
    )
  end

  @doc "Everything a client needs to render the room."
  def snapshot(retro_id) do
    retro = get_retro!(retro_id)

    %{
      retro: retro,
      users: list_participants(retro_id),
      ideas: Repo.all(from i in Idea, where: i.retro_id == ^retro_id, order_by: i.id),
      groups: Repo.all(from g in Group, where: g.retro_id == ^retro_id, order_by: g.id),
      votes:
        Repo.all(
          from v in Vote, join: g in Group, on: g.id == v.group_id, where: g.retro_id == ^retro_id, order_by: v.id
        )
    }
  end
end
