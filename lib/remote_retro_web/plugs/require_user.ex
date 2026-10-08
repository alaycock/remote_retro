defmodule RemoteRetroWeb.Plugs.RequireUser do
  @moduledoc "Redirects to sign-in, remembering where the user was headed."
  import Plug.Conn
  import Phoenix.Controller

  def init(opts), do: opts

  def call(%{assigns: %{current_user: %{}}} = conn, _opts), do: conn

  def call(conn, _opts) do
    conn
    |> maybe_store_return_to()
    |> redirect(to: "/")
    |> halt()
  end

  defp maybe_store_return_to(%{method: "GET"} = conn),
    do: put_session(conn, :return_to, current_path(conn))

  defp maybe_store_return_to(conn), do: conn
end
