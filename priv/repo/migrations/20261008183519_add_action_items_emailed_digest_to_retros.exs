defmodule RemoteRetro.Repo.Migrations.AddActionItemsEmailedDigestToRetros do
  use Ecto.Migration

  # sha256 of the action items last emailed, so re-closing an unchanged retro sends nothing.
  def change do
    alter table(:retros) do
      add :action_items_emailed_digest, :string
    end
  end
end
