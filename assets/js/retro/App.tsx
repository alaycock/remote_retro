import { useAppSelector } from "./store/hooks"

// Placeholder; replaced by the room shell (plan 4).
export function App() {
  const retro = useAppSelector((s) => s.retro)
  return <div className="p-6">Stage: {retro?.stage}</div>
}
