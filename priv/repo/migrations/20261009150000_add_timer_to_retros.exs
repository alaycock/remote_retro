defmodule RemoteRetro.Repo.Migrations.AddTimerToRetros do
  use Ecto.Migration

  def change do
    alter table(:retros) do
      add :timer_duration_ms, :integer, null: false, default: 180_000
      add :timer_ends_at, :utc_datetime_usec
      add :timer_remaining_ms, :integer
    end
  end
end
