defmodule RemoteRetro.Emails do
  @moduledoc """
  Builds the action-items email sent when a retro closes: one message per
  participant with an email address, so nobody sees anyone else's address.

  Everything that comes from users (names, action item text) is HTML-escaped
  in the HTML body.
  """
  use Phoenix.VerifiedRoutes, endpoint: RemoteRetroWeb.Endpoint, router: RemoteRetroWeb.Router

  import Swoosh.Email
  alias RemoteRetro.Mailer
  alias RemoteRetro.Retros.Retro

  @doc """
  `action_items` are ideas with `:assignee` preloaded; `participants` are
  users. Participants without an email address are skipped.
  """
  def action_items(%Retro{} = retro, action_items, participants) do
    date = Calendar.strftime(retro.inserted_at, "%b %-d, %Y")
    link = url(~p"/retros/#{retro.id}")
    items = Enum.map(action_items, &{&1.body, owner_name(&1)})

    for user <- participants, is_binary(user.email) and user.email != "" do
      new()
      |> to({user.name || "", user.email})
      |> from(Mailer.from())
      |> subject("Action items from your retro (#{date})")
      |> text_body(text_body(user, date, items, link))
      |> html_body(html_body(user, date, items, link))
    end
  end

  defp owner_name(%{assignee: %{name: name}}) when is_binary(name) and name != "", do: name
  defp owner_name(_), do: "Unassigned"

  defp text_body(user, date, items, link) do
    lines = Enum.map_join(items, "\n", fn {body, owner} -> "- #{body} (owner: #{owner})" end)

    """
    Hi #{greeting_name(user)},

    Here are the action items from your retro on #{date}:

    #{lines}

    You can revisit the whole retro at #{link}
    """
  end

  defp html_body(user, date, items, link) do
    list =
      Enum.map_join(items, "\n", fn {body, owner} ->
        ~s{    <li>#{esc_multiline(body)} <span style="color:#666">(owner: #{esc(owner)})</span></li>}
      end)

    """
    <div style="font-family:sans-serif;line-height:1.5">
      <p>Hi #{esc(greeting_name(user))},</p>
      <p>Here are the action items from your retro on #{esc(date)}:</p>
      <ul>
    #{list}
      </ul>
      <p>You can revisit the whole retro <a href="#{esc(link)}">here</a>.</p>
    </div>
    """
  end

  defp greeting_name(user), do: user.given_name || user.name || "there"

  defp esc(value), do: value |> Phoenix.HTML.html_escape() |> Phoenix.HTML.safe_to_string()

  # Action items may span lines (Shift+Enter); keep them, after escaping.
  defp esc_multiline(value), do: value |> esc() |> String.replace(~r/\r?\n/, "<br>")
end
