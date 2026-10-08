defmodule RemoteRetro.Mailer do
  @moduledoc """
  Swoosh mailer. The adapter is set per environment: the local mailbox in dev
  (`/dev/mailbox`), `Swoosh.Adapters.Test` in test, and in prod SendGrid when
  `SENDGRID_API_KEY` is set, otherwise the logger (see `config/runtime.exs`).
  """
  use Swoosh.Mailer, otp_app: :remote_retro

  require Logger

  @doc """
  The sender as `{name, address}`, parsed from the `:mail_from` setting
  (`MAIL_FROM`), which may be `Name <address>` or a bare address.
  """
  def from do
    :remote_retro
    |> Application.fetch_env!(:mail_from)
    |> parse_address()
  end

  @doc false
  def parse_address(value) do
    case Regex.run(~r/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/, value) do
      [_, name, address] -> {String.trim(name), String.trim(address)}
      nil -> {"", String.trim(value)}
    end
  end

  @doc "Logs boot-time warnings when prod email is not fully configured."
  def warn_if_unconfigured do
    if Application.get_env(:remote_retro, __MODULE__, [])[:adapter] == Swoosh.Adapters.Logger do
      Logger.warning("SENDGRID_API_KEY is not set: action-item emails are logged, not sent")
    end

    if Application.get_env(:remote_retro, :warn_default_mail_from, false) do
      {_name, address} = from()
      Logger.warning("MAIL_FROM is not set: action-item emails are sent from #{address}")
    end

    :ok
  end
end
