import { STAGE_CONFIGS, STAGE_LIST } from "../stages"
import { STAGES, type Stage } from "../types"

/** Read-only progress through the stages; compact text on small screens. */
export function StageStepper({ stage }: { stage: Stage }) {
  const index = STAGES.indexOf(stage)
  return (
    <nav aria-label="Retro progress" className="min-w-0">
      <p className="text-sm font-medium lg:hidden">
        <span className="text-base-content/60">
          Step {index + 1} of {STAGES.length}:
        </span>{" "}
        {STAGE_CONFIGS[stage].title}
      </p>
      <ol className="hidden items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] lg:flex">
        {STAGE_LIST.map((config, i) => {
          const state = i < index ? "done" : i === index ? "current" : "upcoming"
          return (
            <li key={config.key} className="flex items-center gap-1">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-px w-3 xl:w-5 ${i < index ? "bg-success/50" : i === index ? "bg-primary" : "bg-base-content/15"}`}
                />
              )}
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={[
                  // Every step is a pill (same border box), so states differ only in colour.
                  "rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  state === "current" && "border-transparent bg-primary text-primary-content shadow-sm",
                  state === "done" && "border-transparent bg-success/15 text-success",
                  state === "upcoming" && "border-transparent bg-base-content/5 text-base-content/50",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {state === "done" && (
                  <>
                    <span className="hero-check-micro mr-0.5 size-3.5 align-[-2px]" aria-hidden="true" />
                    <span className="sr-only">Completed: </span>
                  </>
                )}
                {config.short}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
