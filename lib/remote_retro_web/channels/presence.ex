defmodule RemoteRetroWeb.Presence do
  use Phoenix.Presence, otp_app: :remote_retro, pubsub_server: RemoteRetro.PubSub
end
