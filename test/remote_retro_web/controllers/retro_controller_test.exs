defmodule RemoteRetroWeb.RetroControllerTest do
  use RemoteRetroWeb.ConnCase, async: true
  import RemoteRetro.Fixtures

  defp sign_in(conn, user), do: init_test_session(conn, user_id: user.id)

  test "redirects anonymous users to sign in", %{conn: conn} do
    assert redirected_to(get(conn, ~p"/retros")) == ~p"/"
  end

  test "creates a retro and renders the room shell", %{conn: conn} do
    user = user_fixture()
    conn = conn |> sign_in(user) |> post(~p"/retros", %{"format" => "start_stop_continue"})
    assert "/retros/" <> id = redirected_to(conn)

    html = build_conn() |> sign_in(user) |> get(~p"/retros/#{id}") |> html_response(200)
    assert html =~ ~s(id="retro-root")
    assert html =~ "/assets/js/retro/main.js"
  end

  test "lists retros by date with the viewer's own action items", %{conn: conn} do
    me = user_fixture(%{"name" => "Me Person"})
    other = user_fixture()
    retro = retro_fixture(me, %{stage: "closed"})

    idea_fixture(retro, me, %{
      category: "action-item",
      body: "Fix the flaky tests",
      assignee_id: me.id
    })

    idea_fixture(retro, me, %{
      category: "action-item",
      body: "Someone else's job",
      assignee_id: other.id
    })

    _empty = retro_fixture(me)

    html = conn |> sign_in(me) |> get(~p"/retros") |> html_response(200)

    assert html =~ Calendar.strftime(retro.inserted_at, "%a, %b %-d, %Y")
    assert html =~ "1 action item for you"
    assert html =~ "Fix the flaky tests"
    refute html =~ "Someone else&#39;s job"
    assert html =~ "No action items assigned to you."
  end
end
