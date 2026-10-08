defmodule RemoteRetroWeb.PageHTML do
  @moduledoc """
  This module contains pages rendered by PageController.

  See the `page_html` directory for all templates available.
  """
  use RemoteRetroWeb, :html

  embed_templates "page_html/*"

  attr :question, :string, required: true
  slot :inner_block, required: true

  @doc "One collapsible question on the landing page."
  def faq(assigns) do
    ~H"""
    <details class="collapse-arrow collapse border border-base-300 bg-base-100">
      <summary class="collapse-title font-medium">{@question}</summary>
      <div class="collapse-content space-y-2 text-base-content/75">
        {render_slot(@inner_block)}
      </div>
    </details>
    """
  end

  @stages ["Prime Directive", "Ideas", "Group & label", "Voting", "Action items"]

  @doc "The retro stages as a compact row of steps."
  def stage_steps(assigns) do
    assigns = assign(assigns, :stages, Enum.with_index(@stages))

    ~H"""
    <ol class="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm" aria-label="Retro stages">
      <li :for={{stage, i} <- @stages} class="flex items-center gap-1.5">
        <.icon :if={i > 0} name="hero-arrow-long-right" class="size-4 text-base-content/40" />
        <span class="rounded-full bg-base-200 px-2.5 py-0.5 font-medium text-base-content">
          {stage}
        </span>
      </li>
    </ol>
    """
  end
end
