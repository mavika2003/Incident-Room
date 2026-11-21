import { useState } from 'react'
import { useAuth, useMutations, useUser } from 'deepspace'
import { useToast } from '@/components/ui'
import {
  formatAssigneeLabel,
  isIncidentAssignee,
  isIncidentUnclaimed,
  type Incident,
  type IncidentRecord,
} from '@/lib/incidents'
import {
  assignmentClaimBody,
  assignmentReleaseBody,
  type InvestigationEvent,
} from '@/lib/investigation-events'

/**
 * Claim / release via putConfirmed against the incidents collection.
 * Server enforcement: update: 'unclaimed-or-own' + ownerField: 'assigneeId'
 * (and checkUnclaimedOwnerTransition) inside the RecordRoom Durable Object.
 */
export function useIncidentAssignment(incident: IncidentRecord | null) {
  const { userId } = useAuth()
  const { user } = useUser()
  const { ready, putConfirmed } = useMutations<Incident>('incidents')
  const { createConfirmed } = useMutations<InvestigationEvent>('investigation-events')
  const { success, error, warning } = useToast()
  const [pending, setPending] = useState(false)

  const displayName = user?.name?.trim() || user?.email?.trim() || 'Investigator'

  async function appendAssignmentEvent(body: string, fromValue: string, toValue: string) {
    if (!incident) return
    try {
      await createConfirmed({
        incidentId: incident.recordId,
        type: 'assignment',
        body,
        fromValue,
        toValue,
        authorId: '', // stamped by userBound
        authorName: displayName,
      })
    } catch (err) {
      warning(
        'Assignment saved, timeline note failed',
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  async function claim() {
    if (!incident || !userId) {
      error('Sign in required', 'Claiming an incident requires an authenticated investigator.')
      return
    }
    if (!isIncidentUnclaimed(incident.data) && !isIncidentAssignee(incident.data, userId)) {
      error('Already claimed', `${formatAssigneeLabel(incident.data)} holds this incident.`)
      return
    }

    setPending(true)
    try {
      await putConfirmed(incident.recordId, {
        assigneeId: userId,
        assigneeName: displayName,
      })
      await appendAssignmentEvent(assignmentClaimBody(displayName), '', userId)
      success('Incident claimed', `You are now assigned as ${displayName}.`)
    } catch (err) {
      error(
        'Could not claim incident',
        err instanceof Error
          ? err.message
          : 'Another investigator may have claimed it first.',
      )
    } finally {
      setPending(false)
    }
  }

  async function release() {
    if (!incident || !userId) {
      error('Sign in required', 'Releasing an incident requires an authenticated investigator.')
      return
    }
    if (!isIncidentAssignee(incident.data, userId)) {
      error('Not your claim', 'Only the assigned investigator can release this incident.')
      return
    }

    const previousId = incident.data.assigneeId
    setPending(true)
    try {
      await putConfirmed(incident.recordId, {
        assigneeId: '',
        assigneeName: '',
      })
      await appendAssignmentEvent(assignmentReleaseBody(displayName), previousId, '')
      success('Incident released', 'This incident is unassigned again.')
    } catch (err) {
      error('Could not release incident', err instanceof Error ? err.message : String(err))
    } finally {
      setPending(false)
    }
  }

  return {
    ready,
    pending,
    userId,
    displayName,
    canClaim: !!userId && !!incident && isIncidentUnclaimed(incident.data),
    canRelease: !!userId && !!incident && isIncidentAssignee(incident.data, userId),
    claim,
    release,
  }
}
