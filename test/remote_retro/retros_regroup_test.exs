defmodule RemoteRetro.RetrosRegroupTest do
  # Not async: toggles the global :ai config.
  use RemoteRetro.DataCase, async: false
  import Mox
  import RemoteRetro.Fixtures
  alias RemoteRetro.AI.RunnerMock
  alias RemoteRetro.Retros

  setup :verify_on_exit!

  setup do
    previous = Application.get_env(:remote_retro, :ai)
    on_exit(fn -> Application.put_env(:remote_retro, :ai, previous) end)
    facilitator = user_fixture()

    %{
      facilitator: facilitator,
      guest: user_fixture(),
      retro: retro_fixture(facilitator, %{stage: "grouping"})
    }
  end

  defp enable_ai, do: Application.put_env(:remote_retro, :ai, enabled: true)

  test "facilitator only, in Group & label, while the AI is idle", %{
    facilitator: f,
    guest: g,
    retro: retro
  } do
    enable_ai()
    assert {:error, :forbidden} = Retros.regroup(retro, g.id)
    assert {:error, :invalid_stage} = Retros.regroup(%{retro | stage: "voting"}, f.id)
    assert {:error, :ai_busy} = Retros.regroup(%{retro | ai_status: "grouping"}, f.id)
  end

  test "reports when AI isn't configured", %{facilitator: f, retro: retro} do
    Application.put_env(:remote_retro, :ai, enabled: false)
    assert {:error, :ai_disabled} = Retros.regroup(retro, f.id)
  end

  test "starts a grouping pass even after the first one has run", %{facilitator: f, retro: retro} do
    enable_ai()
    retro = update_fixture!(retro, %{ai_grouped_at: DateTime.utc_now()})
    id = retro.id
    expect(RunnerMock, :start, fn :grouping, ^id -> :ok end)
    assert {:ok, :started} = Retros.regroup(retro, f.id)
  end

  test "says so when there's nothing left to group", %{facilitator: f, retro: retro} do
    enable_ai()
    expect(RunnerMock, :start, fn :grouping, _ -> :skipped end)
    assert {:ok, :nothing_to_group} = Retros.regroup(retro, f.id)
  end
end
