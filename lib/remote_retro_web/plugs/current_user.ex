defmodule RemoteRetroWeb.Plugs.CurrentUser do
  @moduledoc "Assigns `:current_user` from the session (nil when signed out)."
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    user = with id when not is_nil(id) <- get_session(conn, :user_id), do: RemoteRetro.Accounts.get_user(id)
    assign(conn, :current_user, user)
  end
end
