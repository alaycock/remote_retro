defmodule RemoteRetro.Retros.Participation do
  use Ecto.Schema

  schema "participations" do
    belongs_to :user, RemoteRetro.Accounts.User
    belongs_to :retro, RemoteRetro.Retros.Retro, type: :binary_id
    timestamps(type: :utc_datetime_usec)
  end
end
