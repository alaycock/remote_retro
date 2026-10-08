defmodule RemoteRetro.Votes.Vote do
  use Ecto.Schema
  import Ecto.Changeset

  @derive {Jason.Encoder, only: [:id, :user_id, :group_id]}
  schema "votes" do
    belongs_to :user, RemoteRetro.Accounts.User
    belongs_to :group, RemoteRetro.Groups.Group
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(vote, attrs) do
    vote
    |> cast(attrs, [:user_id, :group_id])
    |> validate_required([:user_id, :group_id])
    |> foreign_key_constraint(:group_id)
  end
end
