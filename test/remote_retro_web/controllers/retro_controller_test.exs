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
end
