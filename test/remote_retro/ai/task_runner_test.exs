defmodule RemoteRetro.AI.TaskRunnerTest do
  use RemoteRetro.DataCase, async: false
  import Mox
  import RemoteRetro.Fixtures
  import ExUnit.CaptureLog
  alias RemoteRetro.AI.{ClientMock, TaskRunner}
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Retros.Retro

  setup :verify_on_exit!

  setup do
    user = user_fixture()
    retro = retro_fixture(user, %{stage: "grouping"})
    RemoteRetroWeb.Endpoint.subscribe("retro:#{retro.id}")
    %{user: user, retro: retro}
  end

  defp ideas(retro, user, bodies) do
    for {body, i} <- Enum.with_index(bodies),
        do: idea_fixture(retro, user, %{body: body, x: i * 240.0, y: 0.0})
  end

  defp labeled_pair(retro, user) do
    group = group_fixture(retro)

    for body <- ["Flaky tests", "Tests time out"],
        do: idea_fixture(retro, user, %{body: body, group_id: group.id})

    group
  end

  describe "grouping" do
    test "skips without calling the model when fewer than 2 candidate ideas", %{
      user: user,
      retro: retro
    } do
      ideas(retro, user, ["only one"])
      assert TaskRunner.run(:grouping, retro.id, force: true) == :skipped
      assert Repo.get!(Retro, retro.id).ai_status == nil
      refute_received %{event: "retro:updated"}
    end

    test "marks busy, applies validated suggestions, sets ai_grouped_at and clears status", %{
      user: user,
      retro: retro
    } do
      [a, b, c] = ideas(retro, user, ["CI is slow", "Lunch was great", "CI takes forever"])
      retro_id = retro.id

      expect(ClientMock, :generate_json, fn system, user_msg, schema ->
        assert system =~ "clearly and obviously"
        assert user_msg =~ "CI takes forever"
        assert schema["required"] == ["groups"]
        # status is visible while the model is working
        assert Repo.get!(Retro, retro_id).ai_status == "grouping"

        {:ok,
         %{
           "groups" => [
             %{"idea_ids" => [a.id, c.id, 12_345], "label" => "CI speed"},
             %{"idea_ids" => [b.id], "label" => nil}
           ]
         }}
      end)

      assert TaskRunner.run(:grouping, retro.id, force: true) == :ok

      assert_received %{event: "retro:updated", payload: %{retro: %Retro{ai_status: "grouping"}}}
      assert_received %{event: "snapshot", payload: %{retro: %Retro{ai_status: nil}}}
      refute_received %{event: "ai:error"}

      updated = Repo.get!(Retro, retro.id)
      assert updated.ai_status == nil
      assert updated.ai_grouped_at != nil

      new_a = Repo.get!(Idea, a.id)
      new_c = Repo.get!(Idea, c.id)
      assert new_a.x > 2 * 240 + 200
      assert {new_c.x - new_a.x, new_c.y - new_a.y} == {24.0, 24.0}
      assert Repo.get!(Idea, b.id).x == 240.0
    end

    @tag :needs_groups_sync
    test "labels the AI group after sync", %{user: user, retro: retro} do
      [a, _b, c] = ideas(retro, user, ["CI is slow", "Lunch was great", "CI takes forever"])

      expect(ClientMock, :generate_json, fn _, _, _ ->
        {:ok, %{"groups" => [%{"idea_ids" => [a.id, c.id], "label" => "CI speed"}]}}
      end)

      assert TaskRunner.run(:grouping, retro.id, force: true) == :ok
      group_id = Repo.get!(Idea, a.id).group_id
      assert group_id != nil and group_id == Repo.get!(Idea, c.id).group_id
      assert %{label: "CI speed", label_source: "ai"} = Repo.get!(Group, group_id)
    end

    test "on model error clears status, keeps ai_grouped_at nil and broadcasts ai:error", %{
      user: user,
      retro: retro
    } do
      ideas(retro, user, ["one", "two"])
      expect(ClientMock, :generate_json, fn _, _, _ -> {:error, {:http_error, 429, "quota"}} end)

      log =
        capture_log(fn ->
          assert {:error, _} = TaskRunner.run(:grouping, retro.id, force: true)
        end)

      assert log =~ "AI grouping failed"
      refute log =~ "one"
      assert %{ai_status: nil, ai_grouped_at: nil} = Repo.get!(Retro, retro.id)
      assert_received %{event: "snapshot"}

      assert_received %{
        event: "ai:error",
        payload: %{message: "AI grouping failed — carry on manually"}
      }
    end

    test "on crash clears status and broadcasts ai:error", %{user: user, retro: retro} do
      ideas(retro, user, ["one", "two"])
      expect(ClientMock, :generate_json, fn _, _, _ -> raise "boom" end)

      capture_log(fn ->
        assert {:error, {:crash, _}} = TaskRunner.run(:grouping, retro.id, force: true)
      end)

      assert Repo.get!(Retro, retro.id).ai_status == nil
      assert_received %{event: "ai:error"}
    end

    test "on timeout clears status and broadcasts ai:error", %{user: user, retro: retro} do
      ideas(retro, user, ["one", "two"])
      stub(ClientMock, :generate_json, fn _, _, _ -> Process.sleep(5_000) end)

      capture_log(fn ->
        assert {:error, :timeout} = TaskRunner.run(:grouping, retro.id, force: true, timeout: 50)
      end)

      assert Repo.get!(Retro, retro.id).ai_status == nil
      assert_received %{event: "ai:error"}
    end
  end

  describe "labeling" do
    test "skips when there are no unlabeled multi-idea groups", %{user: user, retro: retro} do
      group = group_fixture(retro, %{label: "Taken", label_source: "user"})
      for b <- ~w(a b), do: idea_fixture(retro, user, %{body: b, group_id: group.id})
      assert TaskRunner.run(:labeling, retro.id, force: true) == :skipped
    end

    test "labels unlabeled groups but never overwrites a label set mid-flight", %{
      user: user,
      retro: retro
    } do
      open = labeled_pair(retro, user)
      raced = labeled_pair(retro, user)
      retro_id = retro.id

      expect(ClientMock, :generate_json, fn _system, user_msg, _schema ->
        assert user_msg =~ "Flaky tests"
        assert Repo.get!(Retro, retro_id).ai_status == "labeling"
        # a participant labels this group while the model is thinking
        raced |> Ecto.Changeset.change(label: "Mine", label_source: "user") |> Repo.update!()

        {:ok,
         %{
           "labels" => [
             %{"group_id" => open.id, "label" => "Test flakiness"},
             %{"group_id" => raced.id, "label" => "AI"}
           ]
         }}
      end)

      assert TaskRunner.run(:labeling, retro.id, force: true) == :ok

      assert %{label: "Test flakiness", label_source: "ai"} = Repo.get!(Group, open.id)
      assert %{label: "Mine", label_source: "user"} = Repo.get!(Group, raced.id)
      assert %{ai_status: nil, ai_grouped_at: nil} = Repo.get!(Retro, retro.id)
      assert_received %{event: "retro:updated", payload: %{retro: %Retro{ai_status: "labeling"}}}
      assert_received %{event: "snapshot"}
    end
  end

  describe "start/2" do
    setup do
      previous = Application.get_env(:remote_retro, :ai)
      on_exit(fn -> Application.put_env(:remote_retro, :ai, previous) end)
      %{previous: previous}
    end

    test "is skipped when AI is disabled", %{user: user, retro: retro, previous: previous} do
      Application.put_env(:remote_retro, :ai, Keyword.put(previous || [], :enabled, false))
      ideas(retro, user, ["one", "two"])
      assert TaskRunner.start(:grouping, retro.id) == :skipped
      assert TaskRunner.start(:labeling, retro.id) == :skipped
    end

    test "runs asynchronously and returns immediately", %{
      user: user,
      retro: retro,
      previous: previous
    } do
      Application.put_env(:remote_retro, :ai, Keyword.put(previous || [], :enabled, true))
      labeled_pair(retro, user)
      test_pid = self()

      expect(ClientMock, :generate_json, fn _, _, _ ->
        send(test_pid, :model_called)
        {:ok, %{"labels" => []}}
      end)

      assert TaskRunner.start(:labeling, retro.id) == :ok
      assert Repo.get!(Retro, retro.id).ai_status == "labeling"
      assert_receive :model_called, 1_000
      assert_receive %{event: "snapshot", payload: %{retro: %Retro{ai_status: nil}}}, 1_000
    end
  end
end
