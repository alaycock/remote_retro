defmodule RemoteRetroWeb.RetroHTML do
  use RemoteRetroWeb, :html

  embed_templates "retro_html/*"

  def format_name("happy_sad_confused"), do: "Happy / Sad / Confused"
  def format_name("start_stop_continue"), do: "Start / Stop / Continue"

  @stage_names %{
    "lobby" => "Lobby",
    "prime-directive" => "Prime Directive",
    "idea-generation" => "Ideas",
    "grouping" => "Group & label",
    "voting" => "Voting",
    "action-items" => "Action items",
    "closed" => "Closed"
  }

  def stage_name(stage), do: Map.get(@stage_names, stage, stage)

  def retro_date(%{inserted_at: at}), do: Calendar.strftime(at, "%a, %b %-d, %Y")
end
