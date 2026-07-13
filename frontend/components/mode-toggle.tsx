"use client"

import React from "react"
import { Button } from "@/components/ui/button"

type Mode = "mut" | "iny" | "mutiny"

export default function ModeToggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-md bg-white/4 p-1 gap-1">
      <Button size="sm" variant={value === "mut" ? "default" : "ghost"} onClick={() => onChange("mut")}>Nothing</Button>
      <Button size="sm" variant={value === "iny" ? "default" : "ghost"} onClick={() => onChange("iny")}>Something</Button>
      <Button size="sm" variant={value === "mutiny" ? "default" : "ghost"} onClick={() => onChange("mutiny")}>Nothing & Something</Button>
    </div>
  )
}
