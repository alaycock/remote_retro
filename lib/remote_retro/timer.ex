defmodule RemoteRetro.Timer do
  @moduledoc """
  The facilitator's countdown for the timed stages (ideas, group & label, voting).
  Pure: works on a retro's timer fields and returns the attrs to write.

  The state lives in three columns:

    * idle    – no `timer_ends_at`, no `timer_remaining_ms`; shows `timer_duration_ms`
    * running – `timer_ends_at` is in the future
    * paused  – no `timer_ends_at`, `timer_remaining_ms` holds what's left
    * done    – `timer_ends_at` has passed (nothing is written when it runs out)

  The timer never changes the stage or locks anything; clients chime when it hits zero.
  Entering any stage resets it to idle with the default duration (`reset_attrs/0`).
  """

  @default_ms 180_000
  @step_ms 60_000
  @min_ms @step_ms
  @max_ms 60 * @step_ms
  @timed_stages ~w(idea-generation grouping voting)

  def default_ms, do: @default_ms
  def max_ms, do: @max_ms
  def timed_stage?(stage), do: stage in @timed_stages

  @doc "Attrs that put the timer back to idle at the default duration."
  def reset_attrs,
    do: %{timer_duration_ms: @default_ms, timer_ends_at: nil, timer_remaining_ms: nil}

  def status(%{timer_ends_at: nil, timer_remaining_ms: nil}, _now), do: :idle
  def status(%{timer_ends_at: nil}, _now), do: :paused

  def status(%{timer_ends_at: ends_at}, now),
    do: if(DateTime.after?(ends_at, now), do: :running, else: :done)

  def remaining_ms(retro, now) do
    case status(retro, now) do
      :idle -> retro.timer_duration_ms
      :paused -> retro.timer_remaining_ms
      :running -> DateTime.diff(retro.timer_ends_at, now, :millisecond)
      :done -> 0
    end
  end

  @doc """
  What clients render. `remaining_ms` is relative to `now` so clients count down
  from their own clock, which keeps everyone in step whatever their clock says.
  """
  def view(retro, now \\ DateTime.utc_now()) do
    %{
      status: Atom.to_string(status(retro, now)),
      duration_ms: retro.timer_duration_ms,
      remaining_ms: remaining_ms(retro, now)
    }
  end

  @doc """
  Applies `:start`, `:pause`, `:reset` or `{:set_minutes, 1..60}` (idle only; absolute, so a
  client can debounce rapid +/- clicks into one command).
  Returns `{:ok, attrs}` or `{:error, :timer_changed}` when the command no longer
  fits the timer's state (e.g. someone else already paused it).
  """
  def command(command, retro, now \\ DateTime.utc_now())

  def command(:start, retro, now) do
    case status(retro, now) do
      :paused ->
        {:ok, %{timer_ends_at: after_ms(now, retro.timer_remaining_ms), timer_remaining_ms: nil}}

      :running ->
        {:error, :timer_changed}

      _idle_or_done ->
        {:ok, %{timer_ends_at: after_ms(now, retro.timer_duration_ms), timer_remaining_ms: nil}}
    end
  end

  def command(:pause, retro, now) do
    case status(retro, now) do
      :running -> {:ok, %{timer_ends_at: nil, timer_remaining_ms: remaining_ms(retro, now)}}
      _ -> {:error, :timer_changed}
    end
  end

  def command(:reset, _retro, _now), do: {:ok, %{timer_ends_at: nil, timer_remaining_ms: nil}}

  def command({:set_minutes, minutes}, retro, now)
      when is_integer(minutes) and minutes * @step_ms >= @min_ms and minutes * @step_ms <= @max_ms do
    case status(retro, now) do
      :idle -> {:ok, %{timer_duration_ms: minutes * @step_ms}}
      _ -> {:error, :timer_changed}
    end
  end

  def command(_command, _retro, _now), do: {:error, :invalid}

  defp after_ms(now, ms), do: DateTime.add(now, ms, :millisecond)
end
