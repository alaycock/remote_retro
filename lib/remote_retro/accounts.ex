defmodule RemoteRetro.Accounts do
  @moduledoc "Users and sign-in."
  import Ecto.Query
  alias RemoteRetro.Repo
  alias RemoteRetro.Accounts.User

  def get_user(id), do: Repo.get(User, id)
  def get_user!(id), do: Repo.get!(User, id)

  def get_user_by_email(email), do: Repo.get_by(User, email: email)

  @doc "Creates or updates a user from Google userinfo (or equivalent attrs), stamping last login."
  def upsert_from_google(%{"email" => email} = info) do
    attrs = %{
      email: email,
      name: info["name"] || email,
      given_name: info["given_name"],
      family_name: info["family_name"],
      picture: info["picture"],
      locale: info["locale"],
      last_login_at: DateTime.utc_now()
    }

    (get_user_by_email(email) || %User{})
    |> User.changeset(attrs)
    |> Repo.insert_or_update()
  end

  def list_users_by_ids(ids), do: Repo.all(from u in User, where: u.id in ^ids)
end
