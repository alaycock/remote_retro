defmodule RemoteRetroWeb.PageController do
  use RemoteRetroWeb, :controller

  def home(%{assigns: %{current_user: %{}}} = conn, _params), do: redirect(conn, to: ~p"/retros")
  def home(conn, _params), do: render(conn, :home)

  def faq(conn, _params), do: render(conn, :faq, page_title: "FAQ")
  def privacy(conn, _params), do: render(conn, :privacy, page_title: "Privacy")
end
