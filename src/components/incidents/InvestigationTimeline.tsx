import { useMemo, useState, type FormEvent } from 'react'
import { useMutations, useQuery, useUser, useUserLookup } from 'deepspace'
import { MessageSquarePlus } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  Label,
  Textarea,
  useToast,
} from '@/components/ui'
import {
  eventTypeLabel,
  sortEventsNewestFirst,
  validateNoteBody,
  type InvestigationEvent,
} from '@/lib/investigation-events'
import { asText, formatIncidentTime, formatRelativeTime } from '@/lib/incidents'

function TimelineSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading timeline">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border p-3">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function InvestigationTimeline({ incidentId }: { incidentId: string }) {
  const { records, status, error } = useQuery<InvestigationEvent>('investigation-events', {
    where: { incidentId },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { ready, createConfirmed } = useMutations<InvestigationEvent>('investigation-events')
  const { user } = useUser()
  const { getName } = useUserLookup()
  const { success, error: showError } = useToast()
  const [body, setBody] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const events = useMemo(() => sortEventsNewestFirst(records), [records])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const errors = validateNoteBody(body)
    if (errors.body) {
      setFieldError(errors.body)
      return
    }

    setSubmitting(true)
    setFieldError(undefined)
    try {
      await createConfirmed({
        incidentId,
        type: 'note',
        body: body.trim(),
        fromValue: '',
        toValue: '',
        authorId: '', // stamped by userBound
        authorName: user?.name?.trim() || user?.email?.trim() || '',
      })
      setBody('')
      success('Note added', 'Your investigation note is on the timeline.')
    } catch (err) {
      showError('Could not add note', err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4" data-testid="investigation-timeline">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Investigation timeline
        </h3>
        {status === 'ready' && (
          <span className="text-[11px] text-muted-foreground">{events.length} entries</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2" noValidate>
        <Label htmlFor="investigation-note">Add note</Label>
        <Textarea
          id="investigation-note"
          data-testid="investigation-note-input"
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (fieldError) setFieldError(undefined)
          }}
          placeholder="Record findings, hypotheses, or next steps"
          rows={3}
          maxLength={4000}
          aria-invalid={!!fieldError}
        />
        {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={submitting}
            disabled={!ready}
            data-testid="investigation-note-submit"
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Add note
          </Button>
        </div>
      </form>

      {status === 'loading' && <TimelineSkeleton />}

      {status === 'error' && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Could not load timeline{error ? `: ${error}` : '.'}
        </div>
      )}

      {status === 'ready' && events.length === 0 && (
        <EmptyState
          className="py-8"
          icon={<MessageSquarePlus />}
          title="No timeline entries yet"
          description="Add a note, claim the incident, or change status to start the investigation record."
        />
      )}

      {status === 'ready' && events.length > 0 && (
        <ol className="space-y-3">
          {events.map((entry) => {
            const author =
              getName(entry.data.authorId) ||
              asText(entry.data.authorName).trim() ||
              'Investigator'
            return (
              <li
                key={entry.recordId}
                data-testid="timeline-entry"
                className="min-w-0 rounded-md border border-border bg-card/60 px-3 py-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" size="sm">
                    {eventTypeLabel(entry.data.type)}
                  </Badge>
                  <span className="min-w-0 break-words text-xs font-medium text-foreground">
                    {author}
                  </span>
                  <span
                    className="text-[11px] text-muted-foreground"
                    title={formatIncidentTime(entry.createdAt)}
                  >
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  {entry.data.body}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
