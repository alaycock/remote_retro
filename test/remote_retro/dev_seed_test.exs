defmodule RemoteRetro.DevSeedTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  alias RemoteRetro.{DevSeed, Ideas}

  test "fills a retro in idea generation, spreading authors across participants" do
    facilitator = user_fixture()
    retro = retro_fixture(facilitator, %{stage: "idea-generation"})
    guest = user_fixture()
    :ok = RemoteRetro.Retros.participate(retro, guest.id)

    assert {:ok, count} = DevSeed.seed_ideas(retro)
    ideas = Ideas.list_ideas(retro.id)
    assert count == length(DevSeed.sample_ideas()) and length(ideas) == count

    assert ideas |> Enum.map(& &1.user_id) |> Enum.uniq() |> Enum.sort() ==
             Enum.sort([facilitator.id, guest.id])

    assert ideas |> Enum.map(& &1.category) |> Enum.uniq() |> Enum.sort() ==
             ~w(confused happy sad)
  end

  test "maps onto Start / Stop / Continue columns" do
    user = user_fixture()
    retro = retro_fixture(user, %{stage: "idea-generation", format: "start_stop_continue"})
    assert {:ok, _} = DevSeed.seed_ideas(retro)

    assert retro.id |> Ideas.list_ideas() |> Enum.map(& &1.category) |> Enum.uniq() |> Enum.sort() ==
             ~w(continue start stop)
  end

  test "respects the normal stage rules" do
    user = user_fixture()
    retro = retro_fixture(user, %{stage: "voting"})
    assert {:error, :invalid_stage} = DevSeed.seed_ideas(retro)
  end
end
