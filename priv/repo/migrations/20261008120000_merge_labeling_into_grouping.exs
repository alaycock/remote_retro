defmodule RemoteRetro.Repo.Migrations.MergeLabelingIntoGrouping do
  use Ecto.Migration

  # The separate `labeling` stage was folded into `grouping` ("Group & label").
  # Going down leaves them in `grouping`: there's no way to know which were labeling.
  def up, do: execute("UPDATE retros SET stage = 'grouping' WHERE stage = 'labeling'")

  def down, do: :ok
end
