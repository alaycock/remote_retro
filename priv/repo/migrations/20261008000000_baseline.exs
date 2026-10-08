defmodule RemoteRetro.Repo.Migrations.Baseline do
  use Ecto.Migration

  def change do
    execute "CREATE EXTENSION IF NOT EXISTS citext", "DROP EXTENSION IF EXISTS citext"

    create table(:users) do
      add :email, :citext, null: false
      add :name, :string, null: false
      add :given_name, :string, null: false
      add :family_name, :string
      add :picture, :text
      add :locale, :string
      add :last_login_at, :utc_datetime_usec
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:users, [:email])

    create table(:retros, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :format, :string, null: false
      add :stage, :string, null: false, default: "lobby"
      add :facilitator_id, references(:users, on_delete: :nilify_all)
      add :ai_status, :string
      add :ai_grouped_at, :utc_datetime_usec
      timestamps(type: :utc_datetime_usec)
    end

    create index(:retros, [:facilitator_id])

    create table(:participations) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :retro_id, references(:retros, type: :binary_id, on_delete: :delete_all), null: false
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:participations, [:user_id, :retro_id])
    create index(:participations, [:retro_id])

    create table(:groups) do
      add :retro_id, references(:retros, type: :binary_id, on_delete: :delete_all), null: false
      add :label, :string
      add :label_source, :string
      timestamps(type: :utc_datetime_usec)
    end

    create index(:groups, [:retro_id])

    create table(:ideas) do
      add :retro_id, references(:retros, type: :binary_id, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :category, :string, null: false
      add :body, :text, null: false
      add :x, :float
      add :y, :float
      add :group_id, references(:groups, on_delete: :nilify_all)
      add :assignee_id, references(:users, on_delete: :nilify_all)
      timestamps(type: :utc_datetime_usec)
    end

    create index(:ideas, [:retro_id])
    create index(:ideas, [:group_id])

    create table(:votes) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :group_id, references(:groups, on_delete: :delete_all), null: false
      timestamps(type: :utc_datetime_usec)
    end

    create index(:votes, [:group_id])
    create index(:votes, [:user_id])
  end
end
