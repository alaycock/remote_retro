import { useState } from "react"
import { Avatar } from "../components/Avatar"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { selectAiStatus, selectFacilitator, selectIsFacilitator, selectPresentUsers } from "../store/selectors"
import { changeStage } from "../store/thunks"

function ShareLink() {
  const [copied, setCopied] = useState(false)
  const url = window.location.href

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="join w-full">
      <label className="input join-item w-full">
        <span className="hero-link size-4 opacity-60" aria-hidden="true" />
        <span className="sr-only">Retro link</span>
        <input type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="grow" />
      </label>
      <button type="button" className="btn btn-neutral join-item" onClick={copy}>
        <span className={`${copied ? "hero-check" : "hero-clipboard-document"} size-4`} aria-hidden="true" />
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  )
}

export function Lobby() {
  const dispatch = useAppDispatch()
  const users = useAppSelector(selectPresentUsers)
  const isFacilitator = useAppSelector(selectIsFacilitator)
  const facilitator = useAppSelector(selectFacilitator)
  const aiBusy = useAppSelector(selectAiStatus) != null
  const [starting, setStarting] = useState(false)

  const begin = async () => {
    setStarting(true)
    await dispatch(changeStage("prime-directive"))
    setStarting(false)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Retro lobby</h1>
        <p className="mt-3 text-base-content/70">
          {isFacilitator ? (
            <>
              As <strong>facilitator</strong>, you'll guide the team through each stage. Share the link below and
              begin once everyone has arrived.
            </>
          ) : (
            <>
              Once everyone has arrived, {facilitator ? <strong>{facilitator.given_name}</strong> : "the facilitator"}{" "}
              will begin the retro. Hold tight!
            </>
          )}
        </p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Invite your team</h2>
          <ShareLink />
          <div>
            <p className="mb-3 text-sm text-base-content/60">
              {users.length === 1 ? "1 person is here" : `${users.length} people are here`}
            </p>
            <ul className="flex flex-wrap gap-3">
              {users.map((user) => (
                <li key={user.id} className="flex w-16 flex-col items-center gap-1 text-center" title={user.name}>
                  <Avatar user={user} size="lg" />
                  <span className="w-full truncate text-xs">{user.given_name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {isFacilitator && (
        <button type="button" className="btn btn-primary btn-lg self-center" onClick={begin} disabled={starting || aiBusy}>
          {starting && <span className="loading loading-spinner" />}
          Begin retro
          <span className="hero-arrow-right size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
