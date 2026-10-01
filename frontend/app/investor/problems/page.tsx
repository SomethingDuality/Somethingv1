"use client"

import { Suspense } from "react"
import { ProblemsBoard } from "@/components/community/problems-board"

// The problems board is the same for founders and investors (community C3).
export default function InvestorProblemsPage() {
  return (
    <Suspense>
      <ProblemsBoard role="investor" />
    </Suspense>
  )
}
