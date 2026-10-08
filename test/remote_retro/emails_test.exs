defmodule RemoteRetro.EmailsTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  alias RemoteRetro.{Emails, Mailer, Retros}

  setup do
    owner = user_fixture(%{"name" => "Ada <b>Lovelace</b>", "given_name" => "Ada"})
    guest = user_fixture(%{"name" => "Grace Hopper", "given_name" => "Grace"})
    retro = retro_fixture(owner, %{stage: "action-items"})
    :ok = Retros.participate(retro, guest.id)

    idea_fixture(retro, owner, %{
      category: "action-item",
      body: "Fix CI <script>alert(1)</script> & deploys",
      assignee_id: owner.id
    })

    idea_fixture(retro, owner, %{
      category: "action-item",
      body: "Pair more",
      assignee_id: guest.id
    })

    %{retro: retro, owner: owner, guest: guest}
  end

  defp build(retro),
    do:
      Emails.action_items(
        retro,
        Retros.list_action_items(retro.id),
        Retros.list_participants(retro.id)
      )

  test "builds one email per participant, each addressed only to them", %{
    retro: retro,
    owner: owner,
    guest: guest
  } do
    emails = build(retro)
    assert Enum.map(emails, & &1.to) == [[{owner.name, owner.email}], [{guest.name, guest.email}]]
    assert Enum.all?(emails, &(&1.cc == [] and &1.bcc == []))
    assert hd(emails).from == {"Remote Retro", "no-reply@remoteretro.local"}
    date = Calendar.strftime(retro.inserted_at, "%b %-d, %Y")
    assert hd(emails).subject == "Action items from your retro (#{date})"
  end

  test "lists action items with owners and links to the retro", %{retro: retro} do
    [email | _] = build(retro)
    link = RemoteRetroWeb.Endpoint.url() <> "/retros/#{retro.id}"

    assert email.text_body =~
             "- Fix CI <script>alert(1)</script> & deploys (owner: Ada <b>Lovelace</b>)"

    assert email.text_body =~ "- Pair more (owner: Grace Hopper)"
    assert email.text_body =~ link
    assert email.html_body =~ ~s(href="#{link}")
    assert email.html_body =~ "Grace Hopper"
  end

  test "HTML-escapes user content", %{retro: retro} do
    [email | _] = build(retro)
    refute email.html_body =~ "<script>"
    refute email.html_body =~ "<b>"
    assert email.html_body =~ "Fix CI &lt;script&gt;alert(1)&lt;/script&gt; &amp; deploys"
    assert email.html_body =~ "Ada &lt;b&gt;Lovelace&lt;/b&gt;"
  end

  test "skips participants without an email address", %{retro: retro, owner: owner} do
    [_ | others] = Retros.list_participants(retro.id)
    participants = [%{owner | email: nil} | others]
    assert [_one] = Emails.action_items(retro, Retros.list_action_items(retro.id), participants)
  end

  test "parses MAIL_FROM-style addresses" do
    assert Mailer.parse_address(~s("Team Retro" <retro@example.com>)) ==
             {"Team Retro", "retro@example.com"}

    assert Mailer.parse_address("Retro <retro@example.com>") == {"Retro", "retro@example.com"}
    assert Mailer.parse_address(" retro@example.com ") == {"", "retro@example.com"}
  end

  test "keeps line breaks in the HTML body, after escaping" do
    user = user_fixture(%{"email" => "lines@example.com"})
    retro = retro_fixture(user)

    item =
      idea_fixture(retro, user, %{
        category: "action-item",
        body: "First <b>\nsecond",
        assignee_id: user.id
      })

    [email] = RemoteRetro.Emails.action_items(retro, [item], [user])
    assert email.html_body =~ "First &lt;b&gt;<br>second"
  end
end
