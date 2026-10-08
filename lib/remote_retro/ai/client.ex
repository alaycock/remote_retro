defmodule RemoteRetro.AI.Client do
  @moduledoc "LLM boundary: one structured-JSON generation call."

  @callback generate_json(system :: String.t(), user :: String.t(), schema :: map()) ::
              {:ok, map()} | {:error, term()}

  def generate_json(system, user, schema), do: impl().generate_json(system, user, schema)

  defp impl, do: Application.get_env(:remote_retro, :ai_client, RemoteRetro.AI.Gemini)
end
