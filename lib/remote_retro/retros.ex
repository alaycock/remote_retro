defmodule RemoteRetro.Retros do
  @moduledoc "Retros, participation and the full-state snapshot sent to clients."
  import Ecto.Query
  alias RemoteRetro.{AI, Broadcast, Groups, Layout, Repo, Stages}
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
             %Retro{}
             |> Retro.create_changeset(%{format: format, facilitator_id: user_id})
             |> Repo.insert(),
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

  def participant?(retro_id, user_id) do
    Repo.exists?(
      from p in Participation, where: p.retro_id == ^retro_id and p.user_id == ^user_id
    )
  end

  @doc "Re-reads the retro holding a row lock until the surrounding transaction ends."
  def lock_retro!(retro_id),
    do: Repo.one!(from r in Retro, where: r.id == ^retro_id, lock: "FOR UPDATE")

  @doc "Guards shared by mutations: the retro must not be mid AI pass."
  def ensure_ai_idle(%Retro{ai_status: nil}), do: :ok
  def ensure_ai_idle(%Retro{}), do: {:error, :ai_busy}

  def ensure_stage(%Retro{stage: stage}, stages) when is_list(stages),
    do: if(stage in stages, do: :ok, else: {:error, :invalid_stage})

  def ensure_stage(retro, stage), do: ensure_stage(retro, [stage])

  def ensure_facilitator(retro, user_id),
    do: if(facilitator?(retro, user_id), do: :ok, else: {:error, :forbidden})

  @doc """
  Moves the retro one stage forward or back on behalf of the facilitator.

  Entering `grouping` lays out unpositioned ideas and syncs groups; moving
  forward from `grouping` to `voting` syncs groups once more. After commit,
  every client gets a fresh `snapshot` and the AI runner is started: a
  grouping pass on entering `grouping` (only until it has succeeded once) and
  a labeling pass for still-unlabeled groups on the way into `voting`. The
  runner decides whether AI is enabled.
  Moving back from `closed` re-opens the retro with no side effects.
  """
  def change_stage(%Retro{id: retro_id}, to_stage, actor_id) do
    result =
      Repo.transact(fn ->
        retro = lock_retro!(retro_id)

        with :ok <- ensure_facilitator(retro, actor_id),
             :ok <- ensure_ai_idle(retro),
             :ok <- ensure_adjacent(retro.stage, to_stage),
             {:ok, updated} <- update_retro(retro, %{stage: to_stage}),
             :ok <- enter_stage(retro.stage, updated) do
          {:ok, {retro.stage, updated}}
        end
      end)

    with {:ok, {from, retro}} <- result do
      Broadcast.snapshot(retro.id)
      start_ai(from, retro)
      {:ok, retro}
    end
  end

  defp ensure_adjacent(from, to) when is_binary(to),
    do:
      if(Stages.valid?(to) and Stages.adjacent?(from, to),
        do: :ok,
        else: {:error, :invalid_stage}
      )

  defp ensure_adjacent(_from, _to), do: {:error, :invalid_stage}

  defp enter_stage(_from, %Retro{stage: "grouping", id: id}) do
    {:ok, _} = Layout.place_unpositioned(id)
    {:ok, _} = Groups.sync(id)
    :ok
  end

  defp enter_stage("grouping", %Retro{stage: "voting", id: id}) do
    {:ok, _} = Groups.sync(id)
    :ok
  end

  defp enter_stage(_from, %Retro{}), do: :ok

  defp start_ai(_from, %Retro{stage: "grouping", ai_grouped_at: nil, id: id}),
    do: AI.Runner.start(:grouping, id)

  defp start_ai("grouping", %Retro{stage: "voting", id: id}), do: AI.Runner.start(:labeling, id)
  defp start_ai(_from, %Retro{}), do: :skipped

  @doc "Hands the facilitator role to another participant (current facilitator only)."
  def change_facilitator(%Retro{id: retro_id}, actor_id, user_id) do
    Repo.transact(fn ->
      retro = lock_retro!(retro_id)

      with :ok <- ensure_facilitator(retro, actor_id),
           :ok <- ensure_participant(retro_id, user_id) do
        update_retro(retro, %{facilitator_id: user_id})
      end
    end)
  end

  defp ensure_participant(retro_id, user_id) when is_integer(user_id),
    do: if(participant?(retro_id, user_id), do: :ok, else: {:error, :invalid})

  defp ensure_participant(_retro_id, _user_id), do: {:error, :invalid}

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
          from v in Vote,
            join: g in Group,
            on: g.id == v.group_id,
            where: g.retro_id == ^retro_id,
            order_by: v.id
        )
    }
  end
end
