defmodule RemoteRetro.AI.TaskRunnerTest do
  use RemoteRetro.DataCase, async: false
  import Mox
  import RemoteRetro.Fixtures
  import ExUnit.CaptureLog
  alias RemoteRetro.AI.{Apply, ClientMock, TaskRunner}
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

      # Ungrouped b on top; a and c cascade below it, overlapping by stack_overlap.
      new_a = Repo.get!(Idea, a.id)
      new_c = Repo.get!(Idea, c.id)
      new_b = Repo.get!(Idea, b.id)
      assert {new_b.x, new_b.y} == {+0.0, +0.0}
      assert new_a.y == RemoteRetro.Grouping.card_h() + Apply.section_gap()

      assert {new_c.x - new_a.x, new_c.y - new_a.y} ==
               {+0.0, (RemoteRetro.Grouping.card_h() - Apply.stack_overlap()) * 1.0}
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
    end

    test "runs asynchronously and returns immediately", %{
      user: user,
      retro: retro,
      previous: previous
    } do
      Application.put_env(:remote_retro, :ai, Keyword.put(previous || [], :enabled, true))
      ideas(retro, user, ["one", "two"])
      test_pid = self()

      expect(ClientMock, :generate_json, fn _, _, _ ->
        send(test_pid, :model_called)
        {:ok, %{"groups" => []}}
      end)

      assert TaskRunner.start(:grouping, retro.id) == :ok
      assert Repo.get!(Retro, retro.id).ai_status == "grouping"
      assert_receive :model_called, 1_000
      assert_receive %{event: "snapshot", payload: %{retro: %Retro{ai_status: nil}}}, 1_000
    end
  end
end
