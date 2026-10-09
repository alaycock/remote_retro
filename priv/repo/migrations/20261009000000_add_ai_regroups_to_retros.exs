defmodule RemoteRetro.Repo.Migrations.AddAiRegroupsToRetros do
  use Ecto.Migration

  # How many facilitator-triggered AI re-groupings a retro has used (capped; see Retros.regroup/2).
  def change do
    alter table(:retros) do
      add :ai_regroups, :integer, null: false, default: 0
    end
  end
end
