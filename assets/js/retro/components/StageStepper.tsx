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
                  className={`h-px w-3 xl:w-5 ${i <= index ? "bg-primary" : "bg-base-300"}`}
                />
              )}
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  state === "current" && "bg-primary text-primary-content shadow-sm",
                  state === "done" && "text-base-content/70",
                  state === "upcoming" && "text-base-content/40",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {state === "done" && <span className="hero-check-micro mr-0.5 size-3.5 align-[-2px]" aria-hidden="true" />}
                {config.short}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
