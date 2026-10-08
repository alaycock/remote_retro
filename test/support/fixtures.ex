defmodule RemoteRetro.Fixtures do
  @moduledoc "Test data builders."
  alias RemoteRetro.{Accounts, Repo, Retros}
  alias RemoteRetro.Ideas.Idea
  alias RemoteRetro.Groups.Group

  def user_fixture(attrs \\ %{}) do
    n = System.unique_integer([:positive])

    {:ok, user} =
      Map.merge(%{"email" => "user#{n}@example.com", "name" => "User #{n}", "given_name" => "User"}, attrs)
      |> Accounts.upsert_from_google()

    user
  end

  def retro_fixture(facilitator \\ user_fixture(), attrs \\ %{}) do
    {:ok, retro} = Retros.create_retro(facilitator, attrs[:format] || "happy_sad_confused")
    if stage = attrs[:stage], do: retro |> Ecto.Changeset.change(stage: stage) |> Repo.update!(), else: retro
  end

  def idea_fixture(retro, user, attrs \\ %{}) do
    Repo.insert!(
      struct(%Idea{retro_id: retro.id, user_id: user.id, category: "happy", body: "An idea"}, attrs)
    )
  end

  def group_fixture(retro, attrs \\ %{}), do: Repo.insert!(struct(%Group{retro_id: retro.id}, attrs))
end
