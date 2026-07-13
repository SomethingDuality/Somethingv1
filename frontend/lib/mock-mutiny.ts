// This module has been replaced with a real API integration.
// All Mutiny AI queries now go to the backend via apiClient.
// See: /src/routes/investor.routes.js and /src/controllers/investor.controller.js

import apiClient from "@/lib/axios"

export type Person = { id: string; name: string; role: string; headline?: string; similarityScore: number; reasons: string[] }
export type Investor = { id: string; name: string; stage: string; sectors: string[]; matchScore: number }
export type Idea = { id: string; title: string; summary: string; ownerName: string; similarityScore: number }
export type Patent = { id: string; title: string; number: string; assignee: string; similarityScore: number; description: string }

export type MutinyResponse = {
  people?: Person[]
  investors?: Investor[]
  ideas?: Idea[]
  patents?: Patent[]
  rationale: string
}

export type MutinyMode = "feature" | "match" | "critic" | "support"

export async function queryMutiny(idea: string, mode: MutinyMode): Promise<MutinyResponse> {
  const res = await apiClient.post<MutinyResponse>("/investor/mutiny", { idea, mode })
  return res.data
}
