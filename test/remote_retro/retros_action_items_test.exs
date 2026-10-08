defmodule RemoteRetro.RetrosActionItemsTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  import Swoosh.TestAssertions
  alias RemoteRetro.Retros

  setup do
    f = user_fixture()
    guest = user_fixture()
    retro = retro_fixture(f, %{stage: "action-items"})
    :ok = Retros.participate(retro, guest.id)
    %{facilitator: f, guest: guest, retro: retro}
  end

  defp action_item(retro, user, body),
    do: idea_fixture(retro, user, %{category: "action-item", body: body, assignee_id: user.id})

  defp assert_sent_to(users) do
    for user <- users, do: assert_email_sent(to: [{user.name, user.email}])
    assert_no_email_sent()
  end

  test "closing emails each participant once", %{facilitator: f, guest: g, retro: retro} do
    action_item(retro, f, "Fix CI")
    assert {:ok, %{stage: "closed"}} = Retros.change_stage(retro, "closed", f.id)
    assert_sent_to([f, g])
    assert Repo.reload!(retro).action_items_emailed_digest =~ ~r/^[0-9a-f]{64}$/
  end

  test "sends nothing without action items", %{facilitator: f, retro: retro} do
    assert {:ok, _} = Retros.change_stage(retro, "closed", f.id)
    assert Retros.deliver_action_items(retro.id) == :skipped
    assert_no_email_sent()
    assert Repo.reload!(retro).action_items_emailed_digest == nil
  end

  test "re-opening sends nothing and re-closing unchanged items sends nothing", %{
    facilitator: f,
    guest: g,
    retro: retro
  } do
    action_item(retro, f, "Fix CI")
    {:ok, closed} = Retros.change_stage(retro, "closed", f.id)
    assert_sent_to([f, g])

    {:ok, reopened} = Retros.change_stage(closed, "action-items", f.id)
    assert_no_email_sent()

    {:ok, _} = Retros.change_stage(reopened, "closed", f.id)
    assert_no_email_sent()
    assert Retros.deliver_action_items(retro.id) == :unchanged
  end

  test "re-closing after the action items changed sends an update", %{
    facilitator: f,
    guest: g,
    retro: retro
  } do
    item = action_item(retro, f, "Fix CI")
    {:ok, closed} = Retros.change_stage(retro, "closed", f.id)
    assert_sent_to([f, g])

    {:ok, reopened} = Retros.change_stage(closed, "action-items", f.id)
    update_fixture!(item, %{assignee_id: g.id})
    {:ok, _} = Retros.change_stage(reopened, "closed", f.id)

    assert_email_sent(fn email -> email.text_body =~ "Fix CI (owner: #{g.name})" end)
    assert_email_sent(to: [{g.name, g.email}])
    assert_no_email_sent()
  end

  test "the digest ignores order but tracks id, body and owner", %{facilitator: f, retro: retro} do
    a = action_item(retro, f, "A")
    b = action_item(retro, f, "B")
    digest = Retros.action_items_digest([a, b])

    assert Retros.action_items_digest([b, a]) == digest
    refute Retros.action_items_digest([a, %{b | body: "B!"}]) == digest
    refute Retros.action_items_digest([a, %{b | assignee_id: -1}]) == digest
    refute Retros.action_items_digest([a]) == digest
  end
end
