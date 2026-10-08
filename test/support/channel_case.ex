defmodule RemoteRetroWeb.ChannelCase do
  @moduledoc "Test case for channel tests."
  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest
      import RemoteRetroWeb.ChannelCase
      import RemoteRetro.Fixtures

      @endpoint RemoteRetroWeb.Endpoint
    end
  end

  setup tags do
    RemoteRetro.DataCase.setup_sandbox(tags)
    :ok
  end

  @doc "Connects as `user` and joins the retro's channel, returning `{socket, snapshot}`."
  def join_retro(user, retro) do
    token = RemoteRetroWeb.UserSocket.sign_token(RemoteRetroWeb.Endpoint, user.id)

    {:ok, socket} =
      Phoenix.ChannelTest.__connect__(
        RemoteRetroWeb.Endpoint,
        RemoteRetroWeb.UserSocket,
        %{"token" => token},
        []
      )

    {:ok, snapshot, socket} =
      Phoenix.ChannelTest.subscribe_and_join(
        socket,
        RemoteRetroWeb.RetroChannel,
        "retro:#{retro.id}"
      )

    {socket, snapshot}
  end
end
