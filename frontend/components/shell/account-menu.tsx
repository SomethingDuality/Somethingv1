"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useGhostMode } from "@/hooks/use-ghost-mode"
import { accountRowClass } from "@/components/shell/menu-rows"

export function AccountMenu({ role }: { role: "founder" | "investor" }) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const ghostMode = useGhostMode()
  const ghost = role === "investor" && ghostMode.on

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={accountRowClass}>
        <span className="block truncate text-foreground">{user?.name || "Account"}</span>
        {role === "investor" && ghost && <span className="block text-xs text-muted-foreground">Ghost Mode on</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56 bg-popover border-border rounded-xl p-1">
        {user?.email && <p className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</p>}
        <DropdownMenuItem onClick={() => router.push(`/${role}/profile`)} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/${role}/settings`)} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
          Settings
        </DropdownMenuItem>
        {user?.isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
            Admin
          </DropdownMenuItem>
        )}
        {role === "investor" && (
          <DropdownMenuItem onClick={() => ghostMode.set(!ghostMode.on)} disabled={ghostMode.saving} className="px-3 py-2 text-sm cursor-pointer rounded-lg">
            {ghost ? "Turn Ghost Mode off" : "Turn Ghost Mode on"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={() => logout()} className="px-3 py-2 text-sm cursor-pointer rounded-lg text-destructive focus:text-destructive">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
