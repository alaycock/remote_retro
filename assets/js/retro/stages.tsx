import type { ComponentType, ReactNode } from "react"
import { Board } from "./board/Board"
import { ActionItems } from "./stages/ActionItems"
import { Closed } from "./stages/Closed"
import { IdeaGeneration } from "./stages/IdeaGeneration"
import { Lobby } from "./stages/Lobby"
import { PrimeDirective } from "./stages/PrimeDirective"
import { Voting } from "./stages/Voting"
import { STAGES, type Format, type Stage } from "./types"

export interface StageConfig {
  key: Stage
  /** Full title, e.g. for the help dialog and mobile stepper. */
  title: string
  /** Compact label for the desktop stepper. */
  short: string
  component: ComponentType
  /** Guidance shown in the help dialog (and when the stage is entered). */
  help: ((format: Format) => ReactNode) | null
  /** Label on the facilitator's Next button while in this stage. */
  nextCopy: string | null
  /** Confirmation prompt before advancing from this stage. */
  nextConfirm: string
  /** Label on the facilitator's Back button while in this stage. */
  prevCopy: string | null
  /** Confirmation prompt before going back from this stage. */
  prevConfirm: string
  /** Stages that need the full viewport (no centered max-width container). */
  fullBleed?: boolean
}

function Guidance({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

const IDEA_GENERATION_GUIDANCE: Record<Format, string[]> = {
  happy_sad_confused: [
    "Reflect on the events of this past sprint.",
    "Submit items that made you happy, sad, or just plain confused.",
    "Be thoughtful and blameless with your language; we're all here to improve.",
  ],
  start_stop_continue: [
    "Reflect on the practices and habits of the team.",
    "Suggest practices the team could start, stop, or continue to be more effective.",
    "Be thoughtful with your language; we're here to improve the team.",
  ],
}

const GroupingBoard = () => <Board mode="grouping" />
const LabelingBoard = () => <Board mode="labeling" />

export const STAGE_CONFIGS: Record<Stage, StageConfig> = {
  lobby: {
    key: "lobby",
    title: "Lobby",
    short: "Lobby",
    component: Lobby,
    help: null,
    nextCopy: "Begin retro",
    nextConfirm: "Has everyone arrived?",
    prevCopy: null,
    prevConfirm: "",
  },
  "prime-directive": {
    key: "prime-directive",
    title: "The Prime Directive",
    short: "Prime directive",
    component: PrimeDirective,
    help: () => (
      <>
        <p className="mb-3">
          Norm Kerth's Prime Directive sets the stage for every retrospective, so the time spent is as constructive as
          possible.
        </p>
        <Guidance
          items={[
            "Ask a volunteer to read the Prime Directive aloud.",
            "Ask each member of the team whether they can agree to it.",
            "Once everyone agrees, move on to idea generation.",
          ]}
        />
      </>
    ),
    nextCopy: "Idea generation",
    nextConfirm: "Is everyone ready to start sharing ideas?",
    prevCopy: "Back",
    prevConfirm: "Return to the lobby?",
  },
  "idea-generation": {
    key: "idea-generation",
    title: "Idea generation",
    short: "Ideas",
    component: IdeaGeneration,
    help: (format) => <Guidance items={IDEA_GENERATION_GUIDANCE[format]} />,
    nextCopy: "Grouping",
    nextConfirm: "Has everyone finished submitting ideas? New ideas can't be added after this stage.",
    prevCopy: "Back",
    prevConfirm: "Return to the Prime Directive?",
  },
  grouping: {
    key: "grouping",
    title: "Grouping",
    short: "Grouping",
    component: GroupingBoard,
    help: () => (
      <Guidance
        items={[
          "Drag related ideas so they touch; overlapping cards form a group.",
          "Leave unrelated ideas far apart.",
          "Gemini may have already grouped clearly related ideas. Rearrange anything that doesn't fit.",
          "If there's a disagreement, try to settle it without speaking.",
        ]}
      />
    ),
    nextCopy: "Labeling",
    nextConfirm: "Has your team finished grouping the ideas?",
    prevCopy: "Back",
    prevConfirm: "Return to idea generation? Card positions and groups are kept.",
    fullBleed: true,
  },
  labeling: {
    key: "labeling",
    title: "Labeling",
    short: "Labeling",
    component: LabelingBoard,
    help: () => (
      <Guidance
        items={[
          "Work as a team to give each group a sensible label.",
          "Gemini suggests labels for unlabeled groups. Edit any that miss the mark.",
          "Don't spend too long on any one group; an approximate label is good enough.",
        ]}
      />
    ),
    nextCopy: "Voting",
    nextConfirm: "Is your team happy with the labels?",
    prevCopy: "Back",
    prevConfirm: "Return to grouping?",
    fullBleed: true,
  },
  voting: {
    key: "voting",
    title: "Voting",
    short: "Voting",
    component: Voting,
    help: () => (
      <Guidance
        items={[
          <>
            Vote for the topics you think are <strong>most important</strong> for the team to discuss.
          </>,
          "You can put more than one vote on a single topic.",
          "Voting is blind. Totals are revealed when the facilitator moves on to action items.",
        ]}
      />
    ),
    nextCopy: "Action items",
    nextConfirm: "Is everyone happy with their votes? Totals will be revealed.",
    prevCopy: "Back",
    prevConfirm:
      "Return to labeling? Votes are kept, but votes on any group that gets split or merged may be lost.",
  },
  "action-items": {
    key: "action-items",
    title: "Action items",
    short: "Action items",
    component: ActionItems,
    help: () => (
      <Guidance
        items={[
          "Discuss the highest-voted topics first.",
          "Capture action items that remove the team's bottlenecks or build on its successes.",
          "Give every action item an owner.",
          "If you're in the same room as the facilitator, put your laptop away so you can focus.",
        ]}
      />
    ),
    nextCopy: "Close retro",
    nextConfirm: "Close this retro? You can re-open it later if you need to.",
    prevCopy: "Back",
    prevConfirm: "Return to voting? Vote totals will be hidden again.",
  },
  closed: {
    key: "closed",
    title: "Retro closed",
    short: "Closed",
    component: Closed,
    help: () => (
      <p>
        The facilitator has closed this retro. Review the summary here at any time, or find it later from{" "}
        <a href="/retros" className="link">
          your retros
        </a>
        .
      </p>
    ),
    nextCopy: null,
    nextConfirm: "",
    prevCopy: "Re-open retro",
    prevConfirm: "Re-open this retro? It will return to the action items stage.",
  },
}

export const STAGE_LIST: StageConfig[] = STAGES.map((stage) => STAGE_CONFIGS[stage])

export function nextStage(stage: Stage): Stage | null {
  return STAGES[STAGES.indexOf(stage) + 1] ?? null
}

export function prevStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage)
  return i > 0 ? STAGES[i - 1] : null
}
