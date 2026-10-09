defmodule RemoteRetroWeb.RetroChannelJoinTest do
  use RemoteRetroWeb.ChannelCase, async: true

  alias RemoteRetroWeb.UserSocket

  test "socket connect rejects missing and forged tokens" do
    assert :error = connect(UserSocket, %{})
    assert :error = connect(UserSocket, %{"token" => "forged"})
  end

  test "join replies with a snapshot and records participation" do
    facilitator = user_fixture()
    retro = retro_fixture(facilitator)
    guest = user_fixture()
    idea_fixture(retro, facilitator)

    {_socket, snapshot} = join_retro(guest, retro)

    assert snapshot.retro.id == retro.id
    assert is_boolean(snapshot.ai_enabled)
    assert length(snapshot.ideas) == 1

    assert Enum.map(snapshot.users, & &1.id) |> Enum.sort() ==
             Enum.sort([facilitator.id, guest.id])
  end

  test "join fails for unknown retros" do
    user = user_fixture()
    token = UserSocket.sign_token(@endpoint, user.id)
    {:ok, socket} = connect(UserSocket, %{"token" => token})

    assert {:error, %{reason: "not_found"}} =
             subscribe_and_join(
               socket,
               RemoteRetroWeb.RetroChannel,
               "retro:#{Ecto.UUID.generate()}"
             )
  end

  test "dev:seed_ideas fills the retro and broadcasts a snapshot" do
    user = user_fixture()
    retro = retro_fixture(user, %{stage: "idea-generation"})
    {socket, _snapshot} = join_retro(user, retro)

    ref = push(socket, "dev:seed_ideas", %{})
    # Seeding inserts the whole sample set; slow CI runners can miss the 100ms default.
    assert_reply ref, :ok, %{count: count}, 2_000
    assert count > 0
    assert_broadcast "snapshot", %{ideas: ideas}, 2_000
    assert length(ideas) == count
  end
end
