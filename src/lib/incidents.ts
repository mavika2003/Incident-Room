/**
 * Incident domain types, validation, and display helpers.
 * Synthetic seed payloads are marked source: 'synthetic' so demo rows
 * stay visually and logically distinct from live investigations.
 */

import type { RecordData } from 'deepspace'
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SOURCES,
  INCIDENT_STATUSES,
} from '../schemas/incidents-schema'

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]
export type IncidentSource = (typeof INCIDENT_SOURCES)[number]

export type Incident = {
  displayId: string
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  /** Authenticated investigator user id, or '' when unclaimed. */
  assigneeId: string
  /** Denormalized display name (live claim or synthetic demo label). */
  assigneeName: string
  source: IncidentSource
}

export type IncidentRecord = RecordData<Incident>

export type IncidentDraft = {
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
}

export type IncidentFieldErrors = Partial<Record<keyof IncidentDraft, string>>

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  contained: 'Contained',
  resolved: 'Resolved',
  closed: 'Closed',
}

/** Compact status set highlighted in the detail header. */
export const PRIMARY_STATUS_FOCUS = ['open', 'investigating', 'resolved'] as const

/** Badge variant mapping for severity pills. */
export function severityBadgeVariant(
  severity: IncidentSeverity,
): 'destructive' | 'warning' | 'info' | 'secondary' {
  switch (severity) {
    case 'critical':
      return 'destructive'
    case 'high':
      return 'warning'
    case 'medium':
      return 'info'
    case 'low':
      return 'secondary'
  }
}

/** Badge variant mapping for status pills. */
export function statusBadgeVariant(
  status: IncidentStatus,
): 'destructive' | 'warning' | 'info' | 'success' | 'secondary' {
  switch (status) {
    case 'open':
      return 'destructive'
    case 'investigating':
      return 'warning'
    case 'contained':
      return 'info'
    case 'resolved':
      return 'success'
    case 'closed':
      return 'secondary'
  }
}

export function isIncidentSeverity(value: string): value is IncidentSeverity {
  return (INCIDENT_SEVERITIES as readonly string[]).includes(value)
}

export function isIncidentStatus(value: string): value is IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(value)
}

export function isIncidentUnclaimed(incident: Incident): boolean {
  return !incident.assigneeId
}

export function isIncidentAssignee(incident: Incident, userId: string | null | undefined): boolean {
  return !!userId && incident.assigneeId === userId
}

/** Safe string from a record field that may be missing on pre-migration rows. */
export function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Display label for the assigned investigator. */
export function formatAssigneeLabel(
  incident: Incident,
  resolvedName?: string | null,
): string {
  const storedName = asText(incident.assigneeName).trim()
  if (!incident.assigneeId) {
    return storedName || 'Unassigned'
  }
  return resolvedName?.trim() || storedName || 'Assigned investigator'
}

/** Client-side validation for the create form. */
export function validateIncidentDraft(draft: IncidentDraft): IncidentFieldErrors {
  const errors: IncidentFieldErrors = {}
  const title = draft.title.trim()
  if (!title) {
    errors.title = 'Title is required.'
  } else if (title.length > 160) {
    errors.title = 'Title must be 160 characters or fewer.'
  }

  if (draft.description.length > 4000) {
    errors.description = 'Description must be 4000 characters or fewer.'
  }

  if (!isIncidentSeverity(draft.severity)) {
    errors.severity = 'Choose a valid severity.'
  }

  if (!isIncidentStatus(draft.status)) {
    errors.status = 'Choose a valid status.'
  }

  return errors
}

/** Human-readable incident key for new live records. */
export function createDisplayId(): string {
  const stamp = Date.now().toString(36).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `INC-${stamp}-${suffix}`
}

export function formatIncidentTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  const deltaMs = date.getTime() - Date.now()
  const absSec = Math.round(Math.abs(deltaMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (absSec < 60) return rtf.format(Math.round(deltaMs / 1000), 'second')
  const absMin = Math.round(absSec / 60)
  if (absMin < 60) return rtf.format(Math.round(deltaMs / 60000), 'minute')
  const absHr = Math.round(absMin / 60)
  if (absHr < 48) return rtf.format(Math.round(deltaMs / 3600000), 'hour')
  return rtf.format(Math.round(deltaMs / 86400000), 'day')
}

export const EMPTY_INCIDENT_DRAFT: IncidentDraft = {
  title: '',
  description: '',
  severity: 'medium',
  status: 'open',
}

/**
 * Fixed synthetic demo incidents. Distinct displayId prefix (DEMO-) and
 * source: 'synthetic'. Demo assigneeName labels are not real user ids, so
 * assigneeId stays empty and investigators can still claim them.
 */
export const SYNTHETIC_INCIDENTS: ReadonlyArray<Incident> = [
  {
    displayId: 'DEMO-INC-2401',
    title: 'Suspicious OAuth token reuse from unfamiliar ASN',
    description:
      'Multiple short-lived refresh tokens issued for the same service account from an ASN not seen in the last 90 days. Session footprints span two regions within 12 minutes.',
    severity: 'critical',
    status: 'investigating',
    assigneeId: '',
    assigneeName: 'Demo: Alex Rivera',
    source: 'synthetic',
  },
  {
    displayId: 'DEMO-INC-2402',
    title: 'Elevated failed MFA challenge rate on admin cohort',
    description:
      'MFA push fatigue pattern against privileged accounts. Logs show 47 failed authentication attempts clustered between 02:10-02:40 UTC with identical user-agent strings. One successful authentication following failures was recorded for admin-bridge at 02:41 UTC.',
    severity: 'high',
    status: 'open',
    assigneeId: '',
    assigneeName: '',
    source: 'synthetic',
  },
  {
    displayId: 'DEMO-INC-2403',
    title: 'Anomalous outbound DNS to newly registered domain',
    description:
      'Workstation fleet resolving a domain registered 18 hours ago. Volume is low but the query pattern matches known staging C2 beacons.',
    severity: 'high',
    status: 'contained',
    assigneeId: '',
    assigneeName: 'Demo: Sam Okonkwo',
    source: 'synthetic',
  },
  {
    displayId: 'DEMO-INC-2404',
    title: 'Privileged role grant outside change window',
    description:
      'IAM role with production write access was attached outside the approved maintenance window. No matching change ticket found.',
    severity: 'medium',
    status: 'investigating',
    assigneeId: '',
    assigneeName: 'Demo: Priya Shah',
    source: 'synthetic',
  },
  {
    displayId: 'DEMO-INC-2405',
    title: 'Phishing payload blocked at secure email gateway',
    description:
      'Credential-harvest page mimicking the SSO portal was blocked for 14 recipients. Two users reported clicking before the block landed.',
    severity: 'medium',
    status: 'resolved',
    assigneeId: '',
    assigneeName: 'Demo: Chris Nguyen',
    source: 'synthetic',
  },
  {
    displayId: 'DEMO-INC-2406',
    title: 'Stale API key detected in CI artifact cache',
    description:
      'Scanner flagged a long-lived API key in a cached build artifact. Key scope is read-only staging; rotation ticket opened. Related staging traffic showed 1200 API requests per minute and intermittent HTTP 429 rate-limit responses before the key was quarantined. One job also downloaded 4.2 GB of package metadata.',
    severity: 'low',
    status: 'closed',
    assigneeId: '',
    assigneeName: '',
    source: 'synthetic',
  },
]
