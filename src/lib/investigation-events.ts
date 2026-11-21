/**
 * Investigation timeline event types and helpers.
 */

import type { RecordData } from 'deepspace'
import { INVESTIGATION_EVENT_TYPES } from '../schemas/investigation-events-schema'
import { STATUS_LABELS, type IncidentStatus } from './incidents'

export type InvestigationEventType = (typeof INVESTIGATION_EVENT_TYPES)[number]

export type InvestigationEvent = {
  incidentId: string
  type: InvestigationEventType
  body: string
  fromValue: string
  toValue: string
  authorId: string
  authorName: string
}

export type InvestigationEventRecord = RecordData<InvestigationEvent>

export type NoteDraftErrors = { body?: string }

export function validateNoteBody(body: string): NoteDraftErrors {
  const trimmed = body.trim()
  if (!trimmed) return { body: 'Note cannot be empty.' }
  if (trimmed.length > 4000) return { body: 'Note must be 4000 characters or fewer.' }
  return {}
}

export function sortEventsNewestFirst(
  events: InvestigationEventRecord[],
): InvestigationEventRecord[] {
  return [...events].sort((a, b) => {
    const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (delta !== 0) return delta
    return b.recordId.localeCompare(a.recordId)
  })
}

export function statusChangeBody(from: IncidentStatus, to: IncidentStatus): string {
  return `Status changed from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}`
}

export function assignmentClaimBody(name: string): string {
  return `${name} claimed this incident`
}

export function assignmentReleaseBody(name: string): string {
  return `${name} released this incident`
}

export function eventTypeLabel(type: InvestigationEventType): string {
  switch (type) {
    case 'note':
      return 'Note'
    case 'status_change':
      return 'Status'
    case 'assignment':
      return 'Assignment'
    case 'ai_analysis':
      return 'AI analysis'
    case 'ai_review':
      return 'AI review'
  }
}
