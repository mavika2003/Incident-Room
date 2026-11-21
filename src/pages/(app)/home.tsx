/* home pattern: data-forward - live severity mix and open-queue counts above the fold */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuth, useQuery } from 'deepspace'
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Plus,
  Shield,
  Siren,
} from 'lucide-react'
import { Button, EmptyState, Modal } from '@/components/ui'
import { CreateIncidentForm } from '@/components/incidents/CreateIncidentForm'
import { SeverityBadge } from '@/components/incidents/SeverityBadge'
import { StatusBadge } from '@/components/incidents/StatusBadge'
import { useSeedSyntheticIncidents } from '@/hooks/useSeedSyntheticIncidents'
import {
  SYNTHETIC_INCIDENTS,
  formatRelativeTime,
  type Incident,
  type IncidentRecord,
} from '@/lib/incidents'

function summarize(incidents: Array<{ severity: Incident['severity']; status: Incident['status']; source: Incident['source'] }>) {
  const openLike = incidents.filter((i) =>
    i.status === 'open' || i.status === 'investigating' || i.status === 'contained',
  )
  return {
    total: incidents.length,
    open: openLike.length,
    critical: incidents.filter((i) => i.severity === 'critical').length,
    high: incidents.filter((i) => i.severity === 'high').length,
    demo: incidents.filter((i) => i.source === 'synthetic').length,
    live: incidents.filter((i) => i.source === 'live').length,
  }
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: number | string
  hint: string
  tone?: 'default' | 'critical' | 'warning' | 'success'
}) {
  const toneClass =
    tone === 'critical'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'success'
          ? 'text-success'
          : 'text-foreground'

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function RecentRow({
  displayId,
  title,
  severity,
  status,
  createdAt,
  source,
  onOpen,
}: {
  displayId: string
  title: string
  severity: Incident['severity']
  status: Incident['status']
  createdAt?: string
  source: Incident['source']
  onOpen?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/70"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{displayId}</span>
          {source === 'synthetic' && (
            <span className="rounded border border-border px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
              Demo
            </span>
          )}
        </div>
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {createdAt && (
          <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(createdAt)}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <SeverityBadge severity={severity} />
        <StatusBadge status={status} />
      </div>
    </button>
  )
}

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()
  const { records, status, error } = useQuery<Incident>('incidents', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { seed, seeding, ready } = useSeedSyntheticIncidents(records)
  const [createOpen, setCreateOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  const previewRows = useMemo(
    () =>
      SYNTHETIC_INCIDENTS.map((row) => ({
        recordId: row.displayId,
        data: row,
        createdBy: 'preview',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })) as IncidentRecord[],
    [],
  )

  const activeRecords = isSignedIn ? records : previewRows
  const stats = summarize(activeRecords.map((r) => r.data))
  const recent = activeRecords.slice(0, 5)

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Operations dashboard
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">IncidentRoom</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Track security investigations, triage severity, and keep a durable
              timeline of every case in one collaborative room.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSignedIn ? (
              <>
                <Button
                  variant="outline"
                  loading={seeding}
                  disabled={!ready}
                  onClick={() => void seed()}
                >
                  <FlaskConical className="size-4" aria-hidden />
                  Load demo incidents
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  New incident
                </Button>
              </>
            ) : (
              <Button onClick={() => setAuthOpen(true)} disabled={!isLoaded}>
                Sign in to investigate
              </Button>
            )}
          </div>
        </header>

        {!isSignedIn && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Preview mode uses local synthetic cases only. Sign in to read and
            write persistent DeepSpace incident records.
          </div>
        )}

        {isSignedIn && status === 'error' && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load incidents{error ? `: ${error}` : '.'}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isSignedIn && status === 'loading' ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))
          ) : (
            <>
              <StatCard label="Active queue" value={stats.open} hint="Open, investigating, or contained" tone="warning" />
              <StatCard label="Critical" value={stats.critical} hint="Highest severity cases" tone="critical" />
              <StatCard label="High" value={stats.high} hint="Elevated priority" tone="warning" />
              <StatCard
                label="Tracked"
                value={stats.total}
                hint={
                  isSignedIn
                    ? `${stats.live} live · ${stats.demo} demo`
                    : 'Synthetic preview sample'
                }
                tone="success"
              />
            </>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Siren className="size-4 text-primary" aria-hidden />
                <h2 className="text-sm font-semibold">Recent incidents</h2>
              </div>
              <Link to="/incidents" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>

            {isSignedIn && status === 'loading' ? (
              <div className="space-y-3 p-4" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={<Shield />}
                title="No incidents yet"
                description="Create your first live investigation, or load synthetic demo cases to explore the workflow."
                action={{ label: 'New incident', onClick: () => setCreateOpen(true) }}
                secondaryAction={{ label: 'Load demo incidents', onClick: () => void seed() }}
              />
            ) : (
              <div className="divide-y divide-border px-2 py-1">
                {recent.map((incident) => (
                  <RecentRow
                    key={incident.recordId}
                    displayId={incident.data.displayId}
                    title={incident.data.title}
                    severity={incident.data.severity}
                    status={incident.data.status}
                    createdAt={isSignedIn ? incident.createdAt : undefined}
                    source={incident.data.source}
                    onOpen={
                      isSignedIn
                        ? () => navigate(`/incidents?id=${encodeURIComponent(incident.recordId)}`)
                        : () => setAuthOpen(true)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" aria-hidden />
                <h2 className="text-sm font-semibold">Triage focus</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Prioritize critical and high severity items in the active queue.</li>
                <li>Demo rows stay labeled so they never look like production cases.</li>
                <li>Live creates persist through DeepSpace `useMutations` + RecordRoom.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                <h2 className="text-sm font-semibold">Room health</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {isSignedIn
                  ? status === 'ready'
                    ? 'Records room connected. Changes sync to every signed-in investigator.'
                    : status === 'loading'
                      ? 'Connecting to the incidents collection…'
                      : 'Records room reported an error. Retry or check auth.'
                  : 'Sign in to connect the incidents RecordRoom and persist investigations.'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} size="lg">
        <Modal.Header>
          <Modal.Title>Create incident</Modal.Title>
          <Modal.Description>
            Opens a live investigation record in the shared DeepSpace collection.
          </Modal.Description>
        </Modal.Header>
        <Modal.Body>
          <CreateIncidentForm
            onCancel={() => setCreateOpen(false)}
            onCreated={(recordId) => {
              setCreateOpen(false)
              navigate(`/incidents?id=${encodeURIComponent(recordId)}`)
            }}
          />
        </Modal.Body>
      </Modal>

      {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
