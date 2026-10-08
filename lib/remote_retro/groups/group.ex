defmodule RemoteRetro.Groups.Group do
  use Ecto.Schema
  import Ecto.Changeset

  @max_label 60

  @type t :: %__MODULE__{}

  @derive {Jason.Encoder, only: [:id, :retro_id, :label, :label_source]}
  schema "groups" do
    field :label, :string
    field :label_source, :string
    belongs_to :retro, RemoteRetro.Retros.Retro, type: :binary_id
    has_many :ideas, RemoteRetro.Ideas.Idea
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(group, attrs) do
    group
    |> cast(attrs, [:label, :label_source, :retro_id], empty_values: [])
    |> update_change(:label, &normalize_label/1)
    |> validate_length(:label, max: @max_label)
    |> validate_inclusion(:label_source, ~w(user ai))
    |> validate_required([:retro_id])
  end

  defp normalize_label(nil), do: nil

  defp normalize_label(label) do
    case String.trim(label) do
      "" -> nil
      trimmed -> trimmed
    end
  end
end
