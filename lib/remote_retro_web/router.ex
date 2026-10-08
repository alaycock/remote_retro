defmodule RemoteRetroWeb.Router do
  use RemoteRetroWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {RemoteRetroWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug RemoteRetroWeb.Plugs.CurrentUser
  end

  pipeline :require_user do
    plug RemoteRetroWeb.Plugs.RequireUser
  end

  scope "/", RemoteRetroWeb do
    pipe_through :browser

    get "/", PageController, :home
    get "/faq", PageController, :faq
    get "/privacy", PageController, :privacy

    get "/auth/google", AuthController, :request
    get "/auth/google/callback", AuthController, :callback
    get "/logout", AuthController, :logout
  end

  scope "/", RemoteRetroWeb do
    pipe_through [:browser, :require_user]

    get "/retros", RetroController, :index
    post "/retros", RetroController, :create
    get "/retros/:id", RetroController, :show
  end

  if Application.compile_env(:remote_retro, :dev_routes) do
    scope "/dev", RemoteRetroWeb do
      pipe_through :browser

      get "/login", AuthController, :dev_login
    end

    # No module alias here: the plug lives outside RemoteRetroWeb.
    scope "/dev" do
      pipe_through :browser

      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
