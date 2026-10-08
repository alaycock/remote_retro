defmodule RemoteRetroWeb.RetroChannel.Reply do
  @moduledoc """
  Param parsing and reply shaping for `RemoteRetroWeb.RetroChannel`.

  Errors reply `{:error, %{reason: "..."}}`; changeset failures use reason
  `"invalid"` with the error messages under `errors`.
  """

  def ok(socket, payload), do: {:reply, {:ok, payload}, socket}

  def error(socket, {:error, %Ecto.Changeset{} = changeset}),
    do: {:reply, {:error, %{reason: "invalid", errors: errors(changeset)}}, socket}

  def error(socket, {:error, reason}) when is_atom(reason),
    do: {:reply, {:error, %{reason: Atom.to_string(reason)}}, socket}

  @doc "Reads an integer id from params; unparseable ids can never match a record."
  def id(params, key) do
    case Map.get(params, key) do
      id when is_integer(id) ->
        {:ok, id}

      id when is_binary(id) ->
        case Integer.parse(id) do
          {int, ""} -> {:ok, int}
          _ -> {:error, :not_found}
        end

      _ ->
        {:error, :invalid}
    end
  end

  defp errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Regex.replace(~r"%{(\w+)}", message, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
