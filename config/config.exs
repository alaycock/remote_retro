# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :remote_retro,
  ecto_repos: [RemoteRetro.Repo],
  generators: [timestamp_type: :utc_datetime_usec]

# Configure the endpoint
config :remote_retro, RemoteRetroWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: RemoteRetroWeb.ErrorHTML, json: RemoteRetroWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: RemoteRetro.PubSub,
  live_view: [signing_salt: "AlLnjxPQ"]

# Action-item emails. Dev previews them at /dev/mailbox; test uses
# Swoosh.Adapters.Test; prod is configured in config/runtime.exs.
config :remote_retro, RemoteRetro.Mailer, adapter: Swoosh.Adapters.Local

config :remote_retro, :mail_from, ~s("Remote Retro" <no-reply@remoteretro.local>)

# Send action-item emails in the background (tests send inline).
config :remote_retro, :async_mail, true

# Configure LiveView
config :phoenix_live_view,
  # the attribute set on all root tags. Used for Phoenix.LiveView.ColocatedCSS.
  root_tag_attribute: "phx-r"

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.4",
  remote_retro: [
    args:
      ~w(js/app.js js/retro/main.tsx --bundle --target=es2022 --jsx=automatic --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=.),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
  ]

# Configure tailwind (the version is required)
config :tailwind,
  version: "4.3.3",
  remote_retro: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/css/app.css
    ),
    cd: Path.expand("..", __DIR__),
    env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
  ]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
