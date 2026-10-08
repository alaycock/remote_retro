defmodule RemoteRetroWeb.OAuth.Google do
  @moduledoc "Google OAuth 2 sign-in (authorization code flow)."

  @scope "openid email profile"
  @userinfo_url "https://openidconnect.googleapis.com/v1/userinfo"

  def authorize_url!, do: OAuth2.Client.authorize_url!(client(), scope: @scope)

  def fetch_user_info!(code) do
    client = OAuth2.Client.get_token!(client(), code: code)
    %{body: info} = OAuth2.Client.get!(client, @userinfo_url)
    info
  end

  defp client do
    config = Application.fetch_env!(:remote_retro, :google_oauth)

    OAuth2.Client.new(
      strategy: OAuth2.Strategy.AuthCode,
      client_id: config[:client_id],
      client_secret: config[:client_secret],
      redirect_uri: config[:redirect_uri],
      site: "https://accounts.google.com",
      authorize_url: "https://accounts.google.com/o/oauth2/v2/auth",
      token_url: "https://oauth2.googleapis.com/token",
      token_method: :post
    )
    |> OAuth2.Client.put_serializer("application/json", Jason)
  end
end
