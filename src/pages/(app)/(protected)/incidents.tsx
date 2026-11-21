import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { FlaskConical, Plus, Siren } from 'lucide-react'
import {
  Button,
  EmptyState,
  Modal,
} from '@/components/ui'
import { CreateIncidentForm } from '@/components/incidents/CreateIncidentForm'
import { IncidentDetail } from '@/components/incidents/IncidentDetail'
import { IncidentFilters, type IncidentFilterState } from '@/components/incidents/IncidentFilters'
import { IncidentList, IncidentListSkeleton } from '@/components/incidents/IncidentList'
import { useSeedSyntheticIncidents } from '@/hooks/useSeedSyntheticIncidents'
import {
  isIncidentSeverity,
  isIncidentStatus,
  type Incident,
} from '@/lib/incidents'
import { cn } from '@/lib/utils'

export default function IncidentsPage() {
  const { records, status, error } = useQuery<Incident>('incidents', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { seed, seeding, ready } = useSeedSyntheticIncidents(records)
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<IncidentFilterState>({ severity: '', status: '' })
  const [createOpen, setCreateOpen] = useState(false)

  const selectedId = searchParams.get('id')

  const filtered = useMemo(() => {
    return records.filter((incident) => {
      if (filters.severity && incident.data.severity !== filters.severity) return false
      if (filters.status && incident.data.status !== filters.status) return false
      if (filters.severity && !isIncidentSeverity(filters.severity)) return false
      if (filters.status && !isIncidentStatus(filters.status)) return false
      return true
    })
  }, [records, filters])

  const selected = filtered.find((row) => row.recordId === selectedId)
    ?? records.find((row) => row.recordId === selectedId)
    ?? null

  function selectIncident(recordId: string) {
    setSearchParams({ id: recordId })
  }

  function clearSelection() {
    setSearchParams({})
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-foreground">
      <div className="border-b border-border px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
            <p className="text-sm text-muted-foreground">
              Filter, inspect, and open new investigations. Demo rows are marked
              explicitly; live rows persist in DeepSpace records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>

        <div className="mt-5">
          <IncidentFilters value={filters} onChange={setFilters} />
        </div>
      </div>

      {status === 'error' && (
        <div className="mx-4 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-6">
          Could not load incidents{error ? `: ${error}` : '.'}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <div className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          {status === 'loading' ? (
            <IncidentListSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Siren />}
              title={records.length === 0 ? 'No incidents yet' : 'No matches'}
              description={
                records.length === 0
                  ? 'Create a live incident or load synthetic demo cases to populate the queue.'
                  : 'Try clearing severity or status filters.'
              }
              action={
                records.length === 0
                  ? { label: 'New incident', onClick: () => setCreateOpen(true) }
                  : { label: 'Clear filters', onClick: () => setFilters({ severity: '', status: '' }) }
              }
              secondaryAction={
                records.length === 0
                  ? { label: 'Load demo incidents', onClick: () => void seed() }
                  : undefined
              }
            />
          ) : (
            <IncidentList
              incidents={filtered}
              selectedId={selectedId}
              onSelect={selectIncident}
            />
          )}
        </div>

        <div
          className={cn(
            'min-h-0 overflow-y-auto bg-card/40',
            selectedId ? 'fixed inset-0 z-30 bg-background lg:static lg:z-auto' : 'hidden lg:block',
          )}
        >
          <IncidentDetail
            incident={selected}
            onClose={selectedId ? clearSelection : undefined}
          />
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} size="lg">
        <Modal.Header>
          <Modal.Title>Create incident</Modal.Title>
          <Modal.Description>
            Saves a live investigation (`source: live`) to the incidents collection.
          </Modal.Description>
        </Modal.Header>
        <Modal.Body>
          <CreateIncidentForm
            onCancel={() => setCreateOpen(false)}
            onCreated={(recordId) => {
              setCreateOpen(false)
              selectIncident(recordId)
            }}
          />
        </Modal.Body>
      </Modal>
    </div>
  )
}
