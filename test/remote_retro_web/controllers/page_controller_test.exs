defmodule RemoteRetroWeb.PageControllerTest do
  use RemoteRetroWeb.ConnCase

  test "GET /", %{conn: conn} do
    conn = get(conn, ~p"/")
    assert html_response(conn, 200) =~ "Sign in with Google"
  end
end
