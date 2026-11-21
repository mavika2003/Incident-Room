import { useCallback, useState } from 'react'
import { useMutations } from 'deepspace'
import { useToast } from '@/components/ui'
import { SYNTHETIC_INCIDENTS, type Incident, type IncidentRecord } from '@/lib/incidents'


export function useSeedSyntheticIncidents(existing: IncidentRecord[]) {
  const { ready, createConfirmed } = useMutations<Incident>('incidents')
  const { success, error, info } = useToast()
  const [seeding, setSeeding] = useState(false)

  const seed = useCallback(async () => {
    if (!ready) {
      info('Still connecting', 'Wait for the records room to become ready.')
      return
    }

    const existingIds = new Set(existing.map((row) => row.data.displayId))
    const missing = SYNTHETIC_INCIDENTS.filter((row) => !existingIds.has(row.displayId))

    if (missing.length === 0) {
      info('Demo data already present', 'All synthetic DEMO incidents are already loaded.')
      return
    }

    setSeeding(true)
    try {
      for (const row of missing) {
        await createConfirmed({ ...row })
      }
      success(
        'Demo incidents seeded',
        `Added ${missing.length} synthetic incident${missing.length === 1 ? '' : 's'}.`,
      )
    } catch (err) {
      error(
        'Could not seed demo data',
        err instanceof Error ? err.message : String(err),
      )
    } finally {
      setSeeding(false)
    }
  }, [createConfirmed, existing, info, ready, success, error])

  return { seed, seeding, ready }
}
