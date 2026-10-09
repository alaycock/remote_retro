defmodule RemoteRetro.TimerTest do
  use ExUnit.Case, async: true
  alias RemoteRetro.Timer

  @now ~U[2026-10-09 12:00:00.000000Z]
  defp at(ms), do: DateTime.add(@now, ms, :millisecond)

  defp timer(attrs \\ %{}),
    do:
      Map.merge(%{timer_duration_ms: 180_000, timer_ends_at: nil, timer_remaining_ms: nil}, attrs)

  defp apply_command(retro, command, now) do
    {:ok, attrs} = Timer.command(command, retro, now)
    Map.merge(retro, attrs)
  end

  test "idle shows the full duration" do
    assert Timer.view(timer(), @now) == %{
             status: "idle",
             duration_ms: 180_000,
             remaining_ms: 180_000
           }
  end

  test "start, pause, resume and run out" do
    running = apply_command(timer(), :start, @now)
    assert %{status: "running", remaining_ms: 180_000} = Timer.view(running, @now)
    assert %{status: "running", remaining_ms: 120_000} = Timer.view(running, at(60_000))

    paused = apply_command(running, :pause, at(60_000))
    # Time passing while paused changes nothing.
    assert %{status: "paused", remaining_ms: 120_000} = Timer.view(paused, at(600_000))

    resumed = apply_command(paused, :start, at(600_000))
    assert %{status: "running", remaining_ms: 120_000} = Timer.view(resumed, at(600_000))
    assert %{status: "done", remaining_ms: 0} = Timer.view(resumed, at(720_000))
  end

  test "reset returns to idle and keeps the chosen duration" do
    retro = timer(%{timer_duration_ms: 300_000}) |> apply_command(:start, @now)

    assert %{status: "idle", remaining_ms: 300_000} =
             retro |> apply_command(:reset, @now) |> Timer.view(@now)
  end

  test "starting after it ran out starts over" do
    done = timer() |> apply_command(:start, @now)

    assert %{status: "running", remaining_ms: 180_000} =
             done |> apply_command(:start, at(200_000)) |> Timer.view(at(200_000))
  end

  test "minutes are set only while idle, between 1 and 60" do
    assert {:ok, %{timer_duration_ms: 240_000}} = Timer.command({:set_minutes, 4}, timer(), @now)
    assert {:ok, %{timer_duration_ms: 60_000}} = Timer.command({:set_minutes, 1}, timer(), @now)

    assert {:ok, %{timer_duration_ms: 3_600_000}} =
             Timer.command({:set_minutes, 60}, timer(), @now)

    assert {:error, :invalid} = Timer.command({:set_minutes, 0}, timer(), @now)
    assert {:error, :invalid} = Timer.command({:set_minutes, 61}, timer(), @now)

    running = apply_command(timer(), :start, @now)
    assert {:error, :timer_changed} = Timer.command({:set_minutes, 4}, running, @now)
  end

  test "commands that no longer fit the state are rejected" do
    running = apply_command(timer(), :start, @now)
    assert {:error, :timer_changed} = Timer.command(:start, running, @now)
    assert {:error, :timer_changed} = Timer.command(:pause, timer(), @now)
  end
end
