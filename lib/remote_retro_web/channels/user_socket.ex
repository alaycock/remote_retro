defmodule RemoteRetroWeb.UserSocket do
  use Phoenix.Socket

  channel "retro:*", RemoteRetroWeb.RetroChannel

  @token_salt "user socket"
  # Tokens are minted on page load; two weeks covers long-lived tabs.
  @max_age 14 * 24 * 60 * 60

  def sign_token(conn_or_endpoint, user_id), do: Phoenix.Token.sign(conn_or_endpoint, @token_salt, user_id)

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Phoenix.Token.verify(socket, @token_salt, token, max_age: @max_age) do
      {:ok, user_id} -> {:ok, assign(socket, :user_id, user_id)}
      {:error, _} -> :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end
