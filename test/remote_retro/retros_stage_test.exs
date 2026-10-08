defmodule RemoteRetro.RetrosStageTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  import Mox
  alias RemoteRetro.{Groups, Ideas, Retros}
  alias RemoteRetro.AI.RunnerMock

  setup :verify_on_exit!

  setup do
    facilitator = user_fixture()
    %{facilitator: facilitator, guest: user_fixture()}
  end

  defp subscribe(retro), do: Phoenix.PubSub.subscribe(RemoteRetro.PubSub, "retro:#{retro.id}")

  test "advances one stage and broadcasts a snapshot", %{facilitator: f} do
    retro = retro_fixture(f)
    subscribe(retro)

    assert {:ok, %{stage: "prime-directive"}} =
             Retros.change_stage(retro, "prime-directive", f.id)

    assert_receive %Phoenix.Socket.Broadcast{
      event: "snapshot",
      payload: %{retro: %{stage: "prime-directive"}}
    }
  end

  test "rejects non-facilitators, non-adjacent and unknown stages, and AI-busy retros", %{
    facilitator: f,
    guest: g
  } do
    retro = retro_fixture(f, %{stage: "idea-generation"})

    assert {:error, :forbidden} = Retros.change_stage(retro, "grouping", g.id)
    assert {:error, :invalid_stage} = Retros.change_stage(retro, "voting", f.id)
    assert {:error, :invalid_stage} = Retros.change_stage(retro, "nope", f.id)
    assert {:error, :invalid_stage} = Retros.change_stage(retro, nil, f.id)

    busy = update_fixture!(retro, %{ai_status: "grouping"})
    assert {:error, :ai_busy} = Retros.change_stage(busy, "grouping", f.id)
    assert Retros.get_retro!(retro.id).stage == "idea-generation"
  end

  test "entering grouping places ideas, syncs groups and starts AI grouping", %{facilitator: f} do
    retro = retro_fixture(f, %{stage: "idea-generation"})
    idea_fixture(retro, f)
    idea_fixture(retro, f, %{category: "sad"})
    id = retro.id
    expect(RunnerMock, :start, fn :grouping, ^id -> :ok end)

    assert {:ok, _} = Retros.change_stage(retro, "grouping", f.id)
    ideas = Ideas.list_ideas(retro.id)
    assert Enum.all?(ideas, &(&1.x && &1.group_id))
    assert length(Groups.list_groups(retro.id)) == 2
  end

  test "AI grouping only runs until it has succeeded once", %{facilitator: f} do
    retro =
      retro_fixture(f, %{stage: "voting"})
      |> update_fixture!(%{ai_grouped_at: DateTime.utc_now()})

    # No expectation: a call would fail verify_on_exit!.
    assert {:ok, %{stage: "grouping"}} = Retros.change_stage(retro, "grouping", f.id)
  end

  test "moving on from grouping to voting syncs and starts AI labeling", %{facilitator: f} do
    retro = retro_fixture(f, %{stage: "grouping"})
    idea = idea_fixture(retro, f, %{x: 0.0, y: 0.0})
    id = retro.id
    expect(RunnerMock, :start, fn :labeling, ^id -> :skipped end)

    assert {:ok, _} = Retros.change_stage(retro, "voting", f.id)
    assert Repo.reload!(idea).group_id
  end

  test "coming back to voting from action items does not relabel", %{facilitator: f} do
    retro = retro_fixture(f, %{stage: "action-items"})
    # No expectation: a call would fail verify_on_exit!.
    assert {:ok, %{stage: "voting"}} = Retros.change_stage(retro, "voting", f.id)
  end

  test "going back from voting keeps votes", %{facilitator: f} do
    retro = retro_fixture(f, %{stage: "voting"})
    group = group_fixture(retro)
    idea_fixture(retro, f, %{x: 0.0, y: 0.0, group_id: group.id})
    vote = vote_fixture(group, f)
    stub(RunnerMock, :start, fn _, _ -> :skipped end)

    assert {:ok, _} = Retros.change_stage(retro, "grouping", f.id)
    assert Repo.reload(vote)
  end

  test "closing and re-opening have no side effects", %{facilitator: f} do
    retro = retro_fixture(f, %{stage: "action-items"})
    assert {:ok, closed} = Retros.change_stage(retro, "closed", f.id)
    assert {:ok, %{stage: "action-items"}} = Retros.change_stage(closed, "action-items", f.id)
  end

  test "change_facilitator hands over to participants only", %{facilitator: f, guest: g} do
    retro = retro_fixture(f)
    stranger = user_fixture()

    assert {:error, :forbidden} = Retros.change_facilitator(retro, g.id, g.id)
    assert {:error, :invalid} = Retros.change_facilitator(retro, f.id, stranger.id)
    :ok = Retros.participate(retro, g.id)
    assert {:ok, %{facilitator_id: gid}} = Retros.change_facilitator(retro, f.id, g.id)
    assert gid == g.id
  end
end
