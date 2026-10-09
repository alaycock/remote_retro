import { ActionItemForm } from "../components/ActionItemForm"
import { ActionItemList } from "../components/ActionItemList"
import { RankedGroups } from "../components/RankedGroups"

export function ActionItems() {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="discuss-heading">
        <h1 id="discuss-heading" className="mb-3 text-lg font-semibold">
          Discuss, most votes first
        </h1>
        <RankedGroups headingLevel={2} />
      </section>
      <section aria-labelledby="action-items-heading" className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <h2 id="action-items-heading" className="sr-only">
          Action items
        </h2>
        <ActionItemForm />
        <ActionItemList editable />
      </section>
    </div>
  )
}
