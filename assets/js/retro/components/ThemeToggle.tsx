import { useSyncExternalStore } from "react"

type ThemeKey = "system" | "light" | "dark"

const THEMES: { key: ThemeKey; icon: string; label: string }[] = [
  { key: "system", icon: "hero-computer-desktop", label: "Device" },
  { key: "light", icon: "hero-sun", label: "Light" },
  { key: "dark", icon: "hero-moon", label: "Dark" },
]

// The inline script in the root layout owns the theme: it sets `data-theme` and
// `data-theme-source` on <html> and listens for `phx:set-theme`.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ["data-theme", "data-theme-source"] })
  return () => observer.disconnect()
}

function currentTheme(): ThemeKey {
  const html = document.documentElement
  if (html.dataset.themeSource !== "user") return "system"
  return html.dataset.theme === "dark" ? "dark" : "light"
}

/** Single icon for the current theme; opens a menu of Device / Light / Dark. Mirrors the server layout. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "system" as ThemeKey)
  const active = THEMES.find((t) => t.key === theme) ?? THEMES[0]

  const choose = (el: HTMLElement) => {
    el.dispatchEvent(new CustomEvent("phx:set-theme", { bubbles: true }))
    // daisyUI dropdowns stay open while focused; release focus to close it.
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm btn-circle"
        aria-label={`Theme: ${active.label}`}
        title={`Theme: ${active.label}`}
      >
        <span className={`${active.icon} size-5`} aria-hidden="true" />
      </div>
      <ul tabIndex={0} className="dropdown-content menu z-40 mt-2 w-40 rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-300">
        {THEMES.map(({ key, icon, label }) => (
          <li key={key}>
            <button
              type="button"
              data-phx-theme={key}
              className={key === theme ? "menu-active" : undefined}
              aria-pressed={key === theme}
              onClick={(e) => choose(e.currentTarget)}
            >
              <span className={`${icon} size-4`} aria-hidden="true" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
