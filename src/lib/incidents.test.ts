import { describe, expect, it } from 'vitest'
import {
  formatAssigneeLabel,
  isIncidentAssignee,
  isIncidentUnclaimed,
  validateIncidentDraft,
  type Incident,
} from './incidents'
import {
  assignmentClaimBody,
  sortEventsNewestFirst,
  statusChangeBody,
  validateNoteBody,
  type InvestigationEventRecord,
} from './investigation-events'

const baseIncident = (overrides: Partial<Incident> = {}): Incident => ({
  displayId: 'INC-TEST',
  title: 'Test',
  description: '',
  severity: 'medium',
  status: 'open',
  assigneeId: '',
  assigneeName: '',
  source: 'live',
  ...overrides,
})

describe('incident assignment helpers', () => {
  it('treats empty assigneeId as unclaimed', () => {
    expect(isIncidentUnclaimed(baseIncident())).toBe(true)
    expect(isIncidentUnclaimed(baseIncident({ assigneeId: 'user_1' }))).toBe(false)
  })

  it('matches assignee by authenticated user id', () => {
    const incident = baseIncident({ assigneeId: 'user_a', assigneeName: 'Ada' })
    expect(isIncidentAssignee(incident, 'user_a')).toBe(true)
    expect(isIncidentAssignee(incident, 'user_b')).toBe(false)
    expect(isIncidentAssignee(incident, null)).toBe(false)
  })

  it('prefers roster name, then denormalized name, then Unassigned', () => {
    expect(formatAssigneeLabel(baseIncident(), null)).toBe('Unassigned')
    expect(
      formatAssigneeLabel(baseIncident({ assigneeName: 'Demo: Alex' }), null),
    ).toBe('Demo: Alex')
    expect(
      formatAssigneeLabel(
        baseIncident({ assigneeId: 'u1', assigneeName: 'Stored' }),
        'Roster Name',
      ),
    ).toBe('Roster Name')
  })

  it('tolerates missing assigneeName on pre-migration records', () => {
    const legacy = baseIncident()
    // Simulate Phase 1 rows that predate assigneeName.
    delete (legacy as { assigneeName?: string }).assigneeName
    expect(formatAssigneeLabel(legacy, null)).toBe('Unassigned')
  })
})

describe('incident draft validation', () => {
  it('requires a title', () => {
    expect(validateIncidentDraft({
      title: '   ',
      description: '',
      severity: 'low',
      status: 'open',
    }).title).toBeTruthy()
  })

  it('accepts a valid draft', () => {
    expect(validateIncidentDraft({
      title: 'Suspicious login',
      description: 'Details',
      severity: 'high',
      status: 'investigating',
    })).toEqual({})
  })
})

describe('investigation timeline helpers', () => {
  it('rejects empty notes', () => {
    expect(validateNoteBody('   ').body).toBeTruthy()
  })

  it('associates timeline copy with status transitions', () => {
    expect(statusChangeBody('open', 'investigating')).toContain('Investigating')
    expect(assignmentClaimBody('Ada')).toContain('Ada')
  })

  it('sorts events newest first and keeps incident association intact', () => {
    const older: InvestigationEventRecord = {
      recordId: 'a',
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: {
        incidentId: 'inc_1',
        type: 'note',
        body: 'older',
        fromValue: '',
        toValue: '',
        authorId: 'u1',
        authorName: 'Ada',
      },
    }
    const newer: InvestigationEventRecord = {
      recordId: 'b',
      createdBy: 'u2',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      data: {
        incidentId: 'inc_1',
        type: 'note',
        body: 'newer',
        fromValue: '',
        toValue: '',
        authorId: 'u2',
        authorName: 'Bob',
      },
    }
    const sorted = sortEventsNewestFirst([older, newer])
    expect(sorted.map((e) => e.data.body)).toEqual(['newer', 'older'])
    expect(sorted.every((e) => e.data.incidentId === 'inc_1')).toBe(true)
  })
})
