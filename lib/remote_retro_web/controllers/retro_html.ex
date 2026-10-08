defmodule RemoteRetroWeb.RetroHTML do
  use RemoteRetroWeb, :html

  embed_templates "retro_html/*"

  def format_name("happy_sad_confused"), do: "Happy / Sad / Confused"
  def format_name("start_stop_continue"), do: "Start / Stop / Continue"

  def stage_name(stage), do: stage |> String.replace("-", " ") |> String.capitalize()
end
