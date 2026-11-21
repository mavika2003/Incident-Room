import { useState, type FormEvent } from 'react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '@/components/ui'
import { useMutations } from 'deepspace'
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '@/schemas/incidents-schema'
import {
  EMPTY_INCIDENT_DRAFT,
  SEVERITY_LABELS,
  STATUS_LABELS,
  createDisplayId,
  validateIncidentDraft,
  type Incident,
  type IncidentDraft,
  type IncidentFieldErrors,
} from '@/lib/incidents'

export function CreateIncidentForm({
  onCreated,
  onCancel,
}: {
  onCreated?: (recordId: string) => void
  onCancel?: () => void
}) {
  const { ready, createConfirmed } = useMutations<Incident>('incidents')
  const { success, error } = useToast()
  const [draft, setDraft] = useState<IncidentDraft>(EMPTY_INCIDENT_DRAFT)
  const [fieldErrors, setFieldErrors] = useState<IncidentFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function updateField<K extends keyof IncidentDraft>(key: K, value: IncidentDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const errors = validateIncidentDraft(draft)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const recordId = await createConfirmed({
        displayId: createDisplayId(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        severity: draft.severity,
        status: draft.status,
        assigneeId: '',
        assigneeName: '',
        source: 'live',
      })
      success('Incident created', `${draft.title.trim()} is now tracked.`)
      setDraft(EMPTY_INCIDENT_DRAFT)
      onCreated?.(recordId)
    } catch (err) {
      error('Could not create incident', err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="incident-title">Title</Label>
        <Input
          id="incident-title"
          value={draft.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Brief summary of the incident"
          aria-invalid={!!fieldErrors.title}
          maxLength={160}
          autoFocus
        />
        {fieldErrors.title && (
          <p className="text-xs text-destructive">{fieldErrors.title}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="incident-description">Description</Label>
        <Textarea
          id="incident-description"
          value={draft.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="What was observed, systems involved, and current impact"
          rows={4}
          aria-invalid={!!fieldErrors.description}
          maxLength={4000}
        />
        {fieldErrors.description && (
          <p className="text-xs text-destructive">{fieldErrors.description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="incident-severity">Severity</Label>
          <Select
            value={draft.severity}
            onValueChange={(value) =>
              updateField('severity', value as IncidentDraft['severity'])
            }
          >
            <SelectTrigger id="incident-severity">
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
          {fieldErrors.severity && (
            <p className="text-xs text-destructive">{fieldErrors.severity}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="incident-status">Status</Label>
          <Select
            value={draft.status}
            onValueChange={(value) =>
              updateField('status', value as IncidentDraft['status'])
            }
          >
            <SelectTrigger id="incident-status">
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
          {fieldErrors.status && (
            <p className="text-xs text-destructive">{fieldErrors.status}</p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        New incidents start unassigned. Use Claim incident in the detail panel to
        assign yourself with your signed-in identity.
      </p>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting} disabled={!ready}>
          Create incident
        </Button>
      </div>
    </form>
  )
}
