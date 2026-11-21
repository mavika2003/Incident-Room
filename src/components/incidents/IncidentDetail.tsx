import { useState } from 'react'
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/ui'
import { useMutations, useUser, useUserLookup } from 'deepspace'
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '@/schemas/incidents-schema'
import {
  SEVERITY_LABELS,
  STATUS_LABELS,
  asText,
  formatAssigneeLabel,
  formatIncidentTime,
  isIncidentAssignee,
  isIncidentUnclaimed,
  type Incident,
  type IncidentRecord,
  type IncidentSeverity,
  type IncidentStatus,
} from '@/lib/incidents'
import {
  statusChangeBody,
  type InvestigationEvent,
} from '@/lib/investigation-events'
import { useIncidentAssignment } from '@/hooks/useIncidentAssignment'
import { SeverityBadge } from './SeverityBadge'
import { StatusBadge } from './StatusBadge'
import { InvestigationTimeline } from './InvestigationTimeline'
import { AiAnalysisPanel } from './AiAnalysisPanel'
import { ShieldAlert, UserMinus, UserPlus, X } from 'lucide-react'

export function IncidentDetail({
  incident,
  onClose,
}: {
  incident: IncidentRecord | null
  onClose?: () => void
}) {
  const { ready, putConfirmed } = useMutations<Incident>('incidents')
  const { createConfirmed } = useMutations<InvestigationEvent>('investigation-events')
  const { user } = useUser()
  const { getName } = useUserLookup()
  const { success, error, warning } = useToast()
  const assignment = useIncidentAssignment(incident)
  const [statusPending, setStatusPending] = useState(false)
  const [severityPending, setSeverityPending] = useState(false)

  if (!incident) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <ShieldAlert className="size-8 opacity-40" aria-hidden />
        <p className="text-sm">Select an incident to inspect details.</p>
      </div>
    )
  }

  const current = incident
  const isDemo = current.data.source === 'synthetic'
  const resolvedAssigneeName = current.data.assigneeId
    ? getName(current.data.assigneeId)
    : null
  const assigneeLabel = formatAssigneeLabel(current.data, resolvedAssigneeName)
  const canEdit =
    ready &&
    (isIncidentUnclaimed(current.data) ||
      isIncidentAssignee(current.data, assignment.userId))

  async function appendStatusEvent(from: IncidentStatus, to: IncidentStatus) {
    try {
      await createConfirmed({
        incidentId: current.recordId,
        type: 'status_change',
        body: statusChangeBody(from, to),
        fromValue: from,
        toValue: to,
        authorId: '',
        authorName: user?.name?.trim() || user?.email?.trim() || '',
      })
    } catch (err) {
      warning(
        'Status saved, timeline note failed',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  async function updateSeverity(severity: IncidentSeverity) {
    if (severity === current.data.severity) return
    setSeverityPending(true)
    try {
      await putConfirmed(current.recordId, { severity })
      success('Severity updated')
    } catch (err) {
      error('Update failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSeverityPending(false)
    }
  }

  async function updateStatus(status: IncidentStatus) {
    if (status === current.data.status) return
    const previous = current.data.status
    setStatusPending(true)
    try {
      await putConfirmed(current.recordId, { status })
      await appendStatusEvent(previous, status)
      success('Status updated', STATUS_LABELS[status])
    } catch (err) {
      error('Update failed', err instanceof Error ? err.message : String(err))
    } finally {
      setStatusPending(false)
    }
  }

  return (
    <div className="flex h-full flex-col" data-testid="incident-detail">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {incident.data.displayId}
            </span>
            {isDemo && <Badge variant="outline">Demo data</Badge>}
            <SeverityBadge severity={incident.data.severity} />
            <StatusBadge status={incident.data.status} />
          </div>
          <h2 className="text-lg font-semibold leading-snug text-foreground">
            {incident.data.title}
          </h2>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close detail panel"
            onClick={onClose}
            className="shrink-0 lg:hidden"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {asText(current.data.description).trim() || 'No description provided.'}
          </p>
        </section>

        <section
          className="rounded-lg border border-border bg-card/50 p-4"
          data-testid="incident-assignee-section"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assigned investigator
          </h3>
          <p className="mt-2 text-sm font-medium text-foreground" data-testid="incident-assignee-name">
            {assigneeLabel}
          </p>
          {!incident.data.assigneeId && incident.data.assigneeName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Demo label only - this incident is unclaimed and can be claimed.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {assignment.canClaim && (
              <Button
                size="sm"
                loading={assignment.pending}
                disabled={!assignment.ready}
                onClick={() => void assignment.claim()}
                data-testid="claim-incident-button"
              >
                <UserPlus className="size-4" aria-hidden />
                Claim incident
              </Button>
            )}
            {assignment.canRelease && (
              <Button
                size="sm"
                variant="outline"
                loading={assignment.pending}
                disabled={!assignment.ready}
                onClick={() => void assignment.release()}
                data-testid="release-incident-button"
              >
                <UserMinus className="size-4" aria-hidden />
                Release incident
              </Button>
            )}
            {!assignment.canClaim && !assignment.canRelease && incident.data.assigneeId && (
              <p className="text-xs text-muted-foreground">
                Claimed by another investigator. Status edits require the assignee (or admin).
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Severity
            </p>
            <Select
              value={incident.data.severity}
              onValueChange={(value) => void updateSeverity(value as IncidentSeverity)}
              disabled={!canEdit || severityPending}
            >
              <SelectTrigger aria-label="Update severity" data-testid="incident-severity-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_SEVERITIES.map((severity) => (
                  <SelectItem key={severity} value={severity}>
                    {SEVERITY_LABELS[severity]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <Select
              value={incident.data.status}
              onValueChange={(value) => void updateStatus(value as IncidentStatus)}
              disabled={!canEdit || statusPending}
            >
              <SelectTrigger aria-label="Update status" data-testid="incident-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <StatusBadge status="open" />
              <StatusBadge status="investigating" />
              <StatusBadge status="resolved" />
            </div>
          </div>
        </section>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Source
            </dt>
            <dd className="mt-1 text-foreground">
              {isDemo ? 'Synthetic demo seed' : 'Live investigation'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Created
            </dt>
            <dd className="mt-1 text-foreground">
              {formatIncidentTime(incident.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Updated
            </dt>
            <dd className="mt-1 text-foreground">
              {formatIncidentTime(incident.updatedAt)}
            </dd>
          </div>
        </dl>

        {isDemo && (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            This row was seeded as synthetic demo data (`source: synthetic`).
            Live investigations use `source: live` and a non-DEMO display ID.
          </p>
        )}

        <AiAnalysisPanel incidentId={incident.recordId} />

        <InvestigationTimeline incidentId={incident.recordId} />
      </div>
    </div>
  )
}
