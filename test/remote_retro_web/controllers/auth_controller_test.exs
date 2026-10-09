defmodule RemoteRetroWeb.AuthControllerTest do
  use RemoteRetroWeb.ConnCase, async: true

  alias RemoteRetro.Accounts
  alias RemoteRetro.AI.Access

  test "dev login verifies the email and does not invent a hosted domain", %{conn: conn} do
    conn = get(conn, "/dev/login?email=ada@highbeam.co")
    assert redirected_to(conn) == ~p"/retros"

    user = Accounts.get_user_by_email("ada@highbeam.co")
    assert user.email_verified
    assert user.hosted_domain == nil
    assert Access.member?(user)

    build_conn() |> get("/dev/login?email=ada@gmail.com")
    outsider = Accounts.get_user_by_email("ada@gmail.com")
    assert outsider.email_verified
    assert outsider.hosted_domain == nil
    refute Access.member?(outsider)
  end
end
