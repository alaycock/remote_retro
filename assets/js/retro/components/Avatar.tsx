import { useState } from "react"
import type { User } from "../types"

const SIZES = { xs: "size-6 text-[0.6rem]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base" }

export function initials(user: Pick<User, "name">): string {
  const parts = user.name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?"
}

interface AvatarProps {
  user: User
  size?: keyof typeof SIZES
  className?: string
}

export function Avatar({ user, size = "sm", className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const sizing = SIZES[size]
  if (user.picture && !failed) {
    return (
      <img
        src={user.picture}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizing} shrink-0 rounded-full object-cover ring-2 ring-base-100 ${className}`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${sizing} inline-grid shrink-0 place-items-center rounded-full bg-neutral font-semibold text-neutral-content ring-2 ring-base-100 ${className}`}
    >
      {initials(user)}
    </span>
  )
}
