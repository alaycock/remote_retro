defmodule RemoteRetro.AI.TaskRunner do
  @moduledoc """
  Default AI runner. `start/2` marks the retro busy (`ai_status`), then runs the
  pass in the background under `RemoteRetro.AI.TaskSupervisor` with a hard
  timeout. Whatever happens, `ai_status` is cleared and a fresh snapshot is
  broadcast; failures also broadcast `ai:error`.

  `run/3` is the same pipeline executed synchronously (used by tests).
  Callers must invoke this after their own transaction has committed.
  """
  @behaviour RemoteRetro.AI.Runner

  require Logger
  import Ecto.Query
  alias RemoteRetro.{AI, Broadcast, Repo, Retros}
  alias RemoteRetro.AI.{Apply, Client, Prompts}
  alias RemoteRetro.Retros.Retro

  @supervisor RemoteRetro.AI.TaskSupervisor
  @timeout 45_000

  @impl true
  def start(kind, retro_id) when kind in [:grouping, :labeling] do
    with {:ok, work} <- prepare(kind, retro_id) do
      mark_busy(kind, retro_id)

      {:ok, _pid} =
        Task.Supervisor.start_child(@supervisor, fn -> execute(kind, retro_id, work, @timeout) end)

      :ok
    end
  end

  @doc """
  Synchronous version of `start/2`. Returns `:skipped`, `:ok` or `{:error, reason}`.
  Options: `:timeout` (ms, default 45s), `:force` (run even when AI is disabled).
  """
  def run(kind, retro_id, opts \\ []) when kind in [:grouping, :labeling] do
    with {:ok, work} <- prepare(kind, retro_id, opts[:force] == true) do
      mark_busy(kind, retro_id)
      execute(kind, retro_id, work, Keyword.get(opts, :timeout, @timeout))
    end
  end

  defp prepare(kind, retro_id, force \\ false) do
    cond do
      not (force or AI.enabled?()) -> :skipped
      kind == :grouping -> retro_id |> Apply.grouping_candidates() |> at_least(2)
      kind == :labeling -> retro_id |> Apply.labeling_candidates() |> at_least(1)
    end
  end

  defp at_least(items, n) when length(items) >= n, do: {:ok, items}
  defp at_least(_items, _n), do: :skipped

  defp mark_busy(kind, retro_id) do
    {:ok, retro} =
      retro_id |> Retros.get_retro!() |> Retros.update_retro(%{ai_status: Atom.to_string(kind)})

    Broadcast.broadcast(retro_id, "retro:updated", %{retro: retro})
  end

  defp execute(kind, retro_id, work, timeout) do
    started = System.monotonic_time(:millisecond)
    task = Task.Supervisor.async_nolink(@supervisor, fn -> perform(kind, retro_id, work) end)

    result =
      case Task.yield(task, timeout) || Task.shutdown(task, :brutal_kill) do
        {:ok, {:ok, stats}} -> {:ok, stats}
        {:ok, {:error, reason}} -> {:error, reason}
        {:ok, other} -> {:error, {:unexpected, other}}
        {:exit, reason} -> {:error, {:crash, reason}}
        nil -> {:error, :timeout}
      end

    elapsed = System.monotonic_time(:millisecond) - started
    finish(kind, retro_id, result, elapsed)
  end

  defp perform(:grouping, retro_id, ideas) do
    {system, user, schema} = Prompts.grouping(ideas)

    with {:ok, response} <- Client.generate_json(system, user, schema) do
      suggestions = Prompts.validate_grouping(response, Enum.map(ideas, & &1.id))
      {:ok, applied} = Apply.apply_grouping(retro_id, suggestions)
      {:ok, Map.merge(applied, %{ideas: length(ideas), suggested: suggestions_count(response)})}
    end
  end

  defp perform(:labeling, retro_id, groups) do
    {system, user, schema} = Prompts.labeling(groups)

    with {:ok, response} <- Client.generate_json(system, user, schema) do
      labels = Prompts.validate_labeling(response, Enum.map(groups, & &1.id))

      {:ok,
       %{
         groups: length(groups),
         proposed: map_size(labels),
         labeled: Apply.apply_labels(retro_id, labels)
       }}
    end
  end

  defp suggestions_count(%{"groups" => groups}) when is_list(groups), do: length(groups)
  defp suggestions_count(_), do: 0

  defp finish(kind, retro_id, result, elapsed) do
    attrs =
      case {kind, result} do
        {:grouping, {:ok, _}} -> [ai_status: nil, ai_grouped_at: DateTime.utc_now()]
        _ -> [ai_status: nil]
      end

    Repo.update_all(from(r in Retro, where: r.id == ^retro_id), set: attrs)

    case result do
      {:ok, stats} ->
        Logger.info("AI #{kind} finished in #{elapsed}ms: #{inspect(stats)}")
        Broadcast.snapshot(retro_id)
        :ok

      {:error, reason} ->
        Logger.warning("AI #{kind} failed after #{elapsed}ms: #{inspect(error_summary(reason))}")
        Broadcast.snapshot(retro_id)

        Broadcast.broadcast(retro_id, "ai:error", %{
          message: "AI #{kind} failed — carry on manually"
        })

        {:error, reason}
    end
  rescue
    e ->
      Logger.error("AI #{kind} could not finish cleanly: #{Exception.message(e)}")
      Repo.update_all(from(r in Retro, where: r.id == ^retro_id), set: [ai_status: nil])
      {:error, :finish_failed}
  end

  # Crash reasons can carry task arguments (idea text); keep logs to the shape only.
  defp error_summary({:crash, {exception, _stack}}) when is_exception(exception),
    do: {:crash, exception.__struct__}

  defp error_summary({:crash, reason}) when is_atom(reason), do: {:crash, reason}
  defp error_summary({:crash, _}), do: :crash
  defp error_summary(reason), do: reason
end
