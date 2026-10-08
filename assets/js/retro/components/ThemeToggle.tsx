const THEMES = [
  { key: "system", icon: "hero-computer-desktop-micro", label: "Use system theme" },
  { key: "light", icon: "hero-sun-micro", label: "Use light theme" },
  { key: "dark", icon: "hero-moon-micro", label: "Use dark theme" },
] as const

/**
 * Mirrors the server layout's toggle. The inline script in the root layout listens
 * for `phx:set-theme` and reads `data-phx-theme` from the event target.
 */
export function ThemeToggle() {
  return (
    <div className="join" role="group" aria-label="Theme">
      {THEMES.map(({ key, icon, label }) => (
        <button
          key={key}
          type="button"
          className="btn btn-ghost btn-xs join-item"
          data-phx-theme={key}
          aria-label={label}
          title={label}
          onClick={(e) => e.currentTarget.dispatchEvent(new CustomEvent("phx:set-theme", { bubbles: true }))}
        >
          <span className={`${icon} size-4`} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
