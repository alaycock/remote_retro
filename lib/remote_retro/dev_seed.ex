defmodule RemoteRetro.DevSeed do
  @moduledoc """
  Dev-only: fill a retro in idea generation with sample ideas for testing.

  Ideas come from `priv/dev/sample_ideas.json` when present (gitignored — it may hold real
  retro content; a list of `%{"category" => "happy" | "sad" | "confused", "body" => ...}`),
  otherwise from a small built-in set. Only reachable via the channel's `dev:seed_ideas`
  event, which exists only when `:dev_routes` is enabled.
  """
  alias RemoteRetro.{Ideas, Retros}
  alias RemoteRetro.Retros.Retro

  @fallback [
    {"happy", "Shipped the new onboarding flow ahead of schedule"},
    {"happy", "Pairing sessions helped new teammates ramp up quickly"},
    {"happy", "Customer feedback on the dashboard redesign was great"},
    {"happy", "Deploys were smooth all sprint"},
    {"sad", "Flaky CI tests blocked merges several times"},
    {"sad", "CI pipeline is slow and fails randomly"},
    {"sad", "Too many meetings left little focus time"},
    {"sad", "Release notes went out late again"},
    {"confused", "Who owns the on-call rotation this month?"},
    {"confused", "The on-call schedule is unclear"},
    {"confused", "What are our priorities for next quarter?"},
    {"confused", "How do we decide what goes into a release?"}
  ]

  # Start/Stop/Continue retros get the same content mapped onto their columns.
  @start_stop_continue %{"happy" => "continue", "sad" => "stop", "confused" => "start"}

  @doc "Inserts the sample ideas, spreading authorship across the retro's participants."
  def seed_ideas(%Retro{} = retro) do
    authors = retro.id |> Retros.list_participants() |> Enum.map(& &1.id)

    sample_ideas()
    |> Enum.zip(Stream.cycle(authors))
    |> Enum.reduce_while({:ok, 0}, fn {{category, body}, author_id}, {:ok, count} ->
      case Ideas.create_idea(retro, author_id, %{
             "category" => category(retro, category),
             "body" => body
           }) do
        {:ok, _idea} -> {:cont, {:ok, count + 1}}
        error -> {:halt, error}
      end
    end)
  end

  @doc "The sample ideas as `{category, body}` (happy/sad/confused)."
  def sample_ideas do
    path = Application.app_dir(:remote_retro, "priv/dev/sample_ideas.json")

    with {:ok, json} <- File.read(path),
         {:ok, [_ | _] = ideas} <- Jason.decode(json) do
      for %{"category" => category, "body" => body} <- ideas,
          category in ~w(happy sad confused) and is_binary(body),
          do: {category, body}
    else
      _ -> @fallback
    end
  end

  defp category(%Retro{format: "start_stop_continue"}, category),
    do: @start_stop_continue[category]

  defp category(%Retro{}, category), do: category
end
