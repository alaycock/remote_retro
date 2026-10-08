defmodule RemoteRetroWeb.RetroChannel do
  @moduledoc """
  Real-time room for a single retro. Joins reply with a full snapshot;
  see the contract in the project notes for every event.
  """
  use RemoteRetroWeb, :channel

  alias RemoteRetro.{Accounts, Retros}
  alias RemoteRetroWeb.Presence

  @impl true
  def join("retro:" <> retro_id, _params, socket) do
    with %Retros.Retro{} = retro <- Retros.get_retro(retro_id),
         %Accounts.User{} = user <- Accounts.get_user(socket.assigns.user_id) do
      :ok = Retros.participate(retro, user.id)
      send(self(), :after_join)
      {:ok, Retros.snapshot(retro.id), assign(socket, retro_id: retro.id, user: user)}
    else
      nil -> {:error, %{reason: "not_found"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    user = socket.assigns.user
    # Participants who joined after others already loaded the room need to reach them.
    broadcast_from!(socket, "user:joined", %{user: user})

    {:ok, _} =
      Presence.track(socket, to_string(user.id), %{
        user_id: user.id,
        online_at: System.system_time(:second)
      })

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end
end
