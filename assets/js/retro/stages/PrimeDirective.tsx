const LINES = [
  "Regardless of what we discover,",
  "we understand and truly believe",
  "that everyone did the best job they could,",
  "given what they knew at the time,",
  "their skills and abilities,",
  "the resources available,",
  "and the situation at hand.",
]

export function PrimeDirective() {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-4 py-10 text-center">
      <p className="text-sm font-semibold tracking-widest text-primary uppercase">The Prime Directive</p>
      <blockquote className="mt-6 text-xl leading-relaxed font-medium sm:text-2xl">
        {LINES.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </blockquote>
      <p className="mt-6 text-sm text-base-content/60">Norm Kerth, Project Retrospectives: A Handbook for Team Reviews</p>

      <aside aria-label="How to use the Prime Directive" className="mx-auto mt-10 max-w-md rounded-box bg-base-100 p-4 text-left text-sm shadow-sm">
        <p className="text-base-content/80">
          The Prime Directive sets the stage so the time spent is as constructive as possible.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-base-content/70">
          <li>Ask a volunteer to read it aloud.</li>
          <li>Check that everyone on the team can agree to it.</li>
          <li>Once everyone agrees, move on to idea generation.</li>
        </ol>
      </aside>
    </div>
  )
}
