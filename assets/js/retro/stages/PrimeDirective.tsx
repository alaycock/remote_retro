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
    </div>
  )
}
