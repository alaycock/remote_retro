defmodule RemoteRetroWeb.RetroController do
  use RemoteRetroWeb, :controller

  alias RemoteRetro.{Formats, Retros}
  alias RemoteRetroWeb.UserSocket

  def index(conn, _params) do
    render(conn, :index,
      retros: Retros.list_retros_for_user(conn.assigns.current_user),
      formats: Formats.all(),
      page_title: "Your retros"
    )
  end

  def create(conn, %{"format" => format}) do
    case Retros.create_retro(conn.assigns.current_user, format) do
      {:ok, retro} -> redirect(conn, to: ~p"/retros/#{retro.id}")
      {:error, _} -> conn |> put_flash(:error, "Could not create retro.") |> redirect(to: ~p"/retros")
    end
  end

  def show(conn, %{"id" => id}) do
    case Retros.get_retro(id) do
      nil ->
        conn |> put_status(:not_found) |> put_view(RemoteRetroWeb.ErrorHTML) |> render(:"404")

      retro ->
        user = conn.assigns.current_user
        :ok = Retros.participate(retro, user.id)

        conn
        |> put_root_layout(html: {RemoteRetroWeb.Layouts, :retro_root})
        |> render(:show,
          retro: retro,
          user_token: UserSocket.sign_token(conn, user.id),
          page_title: "Retro"
        )
    end
  end
end
