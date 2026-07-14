import apiClient from "./axios"
import { getProjectById, updateProject, pledgeCommunityFunding, getProjects } from "./projects-store"

export interface Pledge {
  id: string
  founderName: string
  founderAvatar?: string
  amount: number
  date: string
  note?: string
}

export interface CommunityUpdate {
  id: string
  title: string
  content: string
  date: string
}

export interface CommunityStats {
  communityTarget: number
  communityRaised: number
  pledges: Pledge[]
  communityUpdates: CommunityUpdate[]
}

/**
 * Fetch community details, pledges, and updates for a specific project.
 * 
 * TODO FOR BACKEND DEVELOPER:
 * Implement: GET /ideas/:id/community
 * Expected response: { success: boolean, communityTarget: number, communityRaised: number, pledges: Pledge[], communityUpdates: CommunityUpdate[] }
 */
export async function getCommunityStats(projectId: string): Promise<CommunityStats> {
  try {
    const res = await apiClient.get<{
      success: boolean
      communityTarget: number
      communityRaised: number
      pledges: Pledge[]
      communityUpdates: CommunityUpdate[]
    }>(`/ideas/${projectId}/community`)
    
    if (res.data && res.data.success) {
      return {
        communityTarget: res.data.communityTarget,
        communityRaised: res.data.communityRaised,
        pledges: res.data.pledges || [],
        communityUpdates: res.data.communityUpdates || [],
      }
    }
  } catch (err) {
    console.warn(`[Community API] GET /ideas/${projectId}/community failed or not implemented, falling back to local projects-store:`, err)
  }

  // Fallback to local projects-store (localStorage)
  const storeProj = getProjectById(projectId) || getProjectById("p1")
  return {
    communityTarget: storeProj?.communityTarget ?? 25000,
    communityRaised: storeProj?.communityRaised ?? 0,
    pledges: storeProj?.pledges ?? [],
    communityUpdates: storeProj?.communityUpdates ?? [],
  }
}

/**
 * Submit a community pledge (backing a project).
 * 
 * TODO FOR BACKEND DEVELOPER:
 * Implement: POST /ideas/:id/pledge
 * Request body: { amount: number, note?: string }
 * Expected response: { success: boolean, communityRaised: number, pledge: Pledge }
 */
export async function submitCommunityPledge(
  projectId: string,
  amount: number,
  founderName: string,
  note?: string
): Promise<{ success: boolean; communityRaised: number }> {
  try {
    const res = await apiClient.post<{
      success: boolean
      communityRaised: number
      pledge: Pledge
    }>(`/ideas/${projectId}/pledge`, { amount, note })
    
    if (res.data && res.data.success) {
      return {
        success: true,
        communityRaised: res.data.communityRaised,
      }
    }
  } catch (err) {
    console.warn(`[Community API] POST /ideas/${projectId}/pledge failed or not implemented, falling back to local projects-store:`, err)
  }

  // Fallback to local projects-store (localStorage)
  const updatedProj = pledgeCommunityFunding(projectId, amount, founderName, note)
  return {
    success: !!updatedProj,
    communityRaised: updatedProj?.communityRaised ?? 0,
  }
}

/**
 * Post a builder/backer announcement.
 * 
 * TODO FOR BACKEND DEVELOPER:
 * Implement: POST /ideas/:id/announcements
 * Request body: { title: string, content: string }
 * Expected response: { success: boolean, announcement: CommunityUpdate }
 */
export async function postCommunityAnnouncement(
  projectId: string,
  title: string,
  content: string
): Promise<{ success: boolean; announcement?: CommunityUpdate }> {
  try {
    const res = await apiClient.post<{
      success: boolean
      announcement: CommunityUpdate
    }>(`/ideas/${projectId}/announcements`, { title, content })
    
    if (res.data && res.data.success) {
      return {
        success: true,
        announcement: res.data.announcement,
      }
    }
  } catch (err) {
    console.warn(`[Community API] POST /ideas/${projectId}/announcements failed or not implemented, falling back to local projects-store:`, err)
  }

  // Fallback to local projects-store (localStorage)
  const proj = getProjectById(projectId)
  if (!proj) return { success: false }

  const currentUpdates = proj.communityUpdates || []
  const newUpdate: CommunityUpdate = {
    id: `upd-${Date.now()}`,
    title,
    content,
    date: new Date().toISOString().split("T")[0],
  }
  
  const updated = updateProject(projectId, {
    communityUpdates: [newUpdate, ...currentUpdates],
  })

  return {
    success: !!updated,
    announcement: newUpdate,
  }
}

/**
 * Fetch cohort metrics for an investor's portfolio projects.
 */
export interface CohortStats {
  pledged: number
  count: number
  announcements: number
  list: any[]
}

export async function getCohortStats(portfolioItems: any[]): Promise<CohortStats> {
  // TODO FOR BACKEND DEVELOPER:
  // Implement an endpoint like: GET /investor/cohort-stats
  // Or handle it on the client by querying community details for each portfolio item.
  // Below we implement the client-side query (with fallback) which is friendly for both.

  const list: any[] = []
  let pledged = 0
  let count = 0
  let announcements = 0

  for (const item of portfolioItems) {
    const projId = item.ideaId || item.id
    const stats = await getCommunityStats(projId)
    
    // Get full project details to construct the item listing
    const storeProj = getProjectById(projId) || getProjects()[0]
    
    const listItem = {
      ...storeProj,
      id: projId,
      name: item.name || storeProj.name,
      communityRaised: stats.communityRaised,
      communityTarget: stats.communityTarget,
      pledges: stats.pledges,
      communityUpdates: stats.communityUpdates,
    }
    
    list.push(listItem)
    pledged += stats.communityRaised
    count += stats.pledges.length
    announcements += stats.communityUpdates.length
  }

  return {
    pledged,
    count,
    announcements,
    list,
  }
}
