export type FeedbackEvent = {
  id: string
  type: 'accept'|'flag'|'introduce'
  targetType: 'person'|'investor'|'idea'
  targetId: string
  timestamp: string
  note?: string
}

const STORAGE_KEY = 'mutiny.feedback'

export function logFeedback(evt: FeedbackEvent) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]'
    const cur: FeedbackEvent[] = JSON.parse(raw)
    cur.push(evt)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur))
    // dispatch event so UI can update
    window.dispatchEvent(new CustomEvent('mutiny:feedback', { detail: evt }))
  } catch (err) {
    console.error('Failed to log feedback', err)
  }
}

export function getFeedback(): FeedbackEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}
