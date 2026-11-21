import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createAnalyzeIncidentAction } from './analyze-incident'
import { reviewAiAnalysis } from './review-ai-analysis'
import type { AiAnalysisFindings } from '../lib/ai-analysis'

vi.mock('deepspace/worker', async () => {
  const actual = await vi.importActual<typeof import('deepspace/worker')>('deepspace/worker')
  return {
    ...actual,
    resolveAppRole: vi.fn(async (_env: Env, userId: string) => {
      if (userId === 'viewer-1') return 'viewer'
      return 'member'
    }),
  }
})

const sampleFindings: AiAnalysisFindings = {
  summary: 'Failed then successful authentication sequence.',
  threatCategory: 'credential_access',
  supportingEvidence: ['47 failed authentication attempts'],
  hypotheses: ['Possible MFA fatigue'],
  recommendedSteps: ['Review session context'],
  confidence: { level: 'medium', justification: 'Sequence is present in text.' },
  missingEvidence: ['Source IP not provided'],
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

function fail(error: string): ActionResult {
  return { success: false, error }
}

function createTools(overrides: Partial<ActionTools> = {}): ActionTools & {
  creates: Array<{ collection: string; data: Record<string, unknown> }>
  updates: Array<{ collection: string; recordId: string; data: Record<string, unknown> }>
} {
  const creates: Array<{ collection: string; data: Record<string, unknown> }> = []
  const updates: Array<{ collection: string; recordId: string; data: Record<string, unknown> }> = []

  const tools = {
    create: vi.fn(async (collection: string, data: Record<string, unknown>) => {
      creates.push({ collection, data })
      return ok({ recordId: `${collection}-1` })
    }),
    update: vi.fn(async (collection: string, recordId: string, data: Record<string, unknown>) => {
      updates.push({ collection, recordId, data })
      return ok({ recordId })
    }),
    remove: vi.fn(async () => fail('unused')),
    deleteWhere: vi.fn(async () => fail('unused')),
    get: vi.fn(async (collection: string, recordId: string) => {
      if (collection === 'users') {
        if (recordId === 'viewer-1') {
          return ok({
            record: {
              recordId,
              data: { name: 'Viewer', role: 'viewer' },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          })
        }
        return ok({
          record: {
            recordId,
            data: { name: 'Ada Investigator', role: 'member' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        })
      }
      if (collection === 'incidents' && recordId === 'inc-1') {
        return ok({
          record: {
            recordId,
            data: {
              displayId: 'DEMO-INC-2402',
              title: 'Elevated failed MFA challenge rate on admin cohort',
              description:
                'Logs show 47 failed authentication attempts. One successful authentication following failures was recorded.',
              severity: 'high',
              status: 'open',
            },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        })
      }
      if (collection === 'ai-analyses' && recordId === 'ai-analyses-1') {
        return ok({
          record: {
            recordId,
            data: {
              incidentId: 'inc-1',
              findings: sampleFindings,
              indicators: [],
              modelId: 'claude-haiku-5-5',
              createdById: 'user-1',
              createdByName: 'Ada Investigator',
              reviewStatus: 'pending_review',
              reviewedById: '',
              reviewedByName: '',
              reviewedAt: '',
            },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        })
      }
      return fail('not found')
    }),
    query: vi.fn(async (collection: string) => {
      if (collection === 'investigation-events') {
        return ok({ records: [], count: 0 })
      }
      if (collection === 'ai-analyses') {
        return ok({ records: [], count: 0 })
      }
      return ok({ records: [], count: 0 })
    }),
    integration: vi.fn(async () => fail('unused')),
    registerUser: vi.fn(async () => fail('unused')),
    ...overrides,
    creates,
    updates,
  }

  return tools as ActionTools & {
    creates: typeof creates
    updates: typeof updates
  }
}

function baseEnv(): Env {
  return {
    APP_OWNER_JWT: 'owner-jwt',
    OWNER_USER_ID: 'owner-1',
    DEEPSPACE_APP_ID: 'app-test',
  } as Env
}

function ctx(
  partial: Partial<ActionContext<Env>> & { tools: ActionTools },
): ActionContext<Env> {
  return {
    userId: 'user-1',
    params: {},
    env: baseEnv(),
    callerJwt: 'caller-jwt',
    ...partial,
  }
}

describe('analyzeIncident action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized viewers', async () => {
    const tools = createTools()
    const action = createAnalyzeIncidentAction({
      generateAnalysis: async () => ({
        findings: sampleFindings,
        modelId: 'claude-haiku-5-5',
      }),
    })
    const result = await action(
      ctx({ userId: 'viewer-1', params: { incidentId: 'inc-1' }, tools }),
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/Forbidden/i)
    expect(tools.creates).toHaveLength(0)
  })

  it('rejects missing incidents instead of trusting a client body', async () => {
    const tools = createTools()
    const action = createAnalyzeIncidentAction({
      generateAnalysis: async () => ({
        findings: sampleFindings,
        modelId: 'claude-haiku-5-5',
      }),
    })
    const result = await action(
      ctx({ params: { incidentId: 'missing-incident' }, tools }),
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  it('surfaces AI provider failures without saving a canned report', async () => {
    const tools = createTools()
    const action = createAnalyzeIncidentAction({
      generateAnalysis: async () => {
        throw new Error('provider unavailable')
      },
    })
    const result = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/provider unavailable/)
    expect(tools.creates.filter((c) => c.collection === 'ai-analyses')).toHaveLength(0)
  })

  it('maps insufficient-credit failures to a clear owner-billing message', async () => {
    const tools = createTools()
    const action = createAnalyzeIncidentAction({
      generateAnalysis: async () => {
        throw new Error('insufficient credits on account')
      },
    })
    const result = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/insufficient credits or quota on the app owner account/i)
    }
  })

  it('rejects concurrent duplicate analysis for the same user and incident', async () => {
    const tools = createTools()
    const inFlight = new Set<string>()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let entered = 0

    const action = createAnalyzeIncidentAction({
      inFlight,
      generateAnalysis: async () => {
        entered += 1
        await gate
        return { findings: sampleFindings, modelId: 'claude-haiku-5-5' }
      },
    })

    const first = action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    await vi.waitFor(() => {
      expect(entered).toBe(1)
    })
    const second = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error).toMatch(/already running/i)
    release()
    const firstResult = await first
    expect(firstResult.success).toBe(true)
  })

  it('rate-limits repeated analyses for the same user', async () => {
    const nowMs = Date.parse('2026-11-21T18:00:00.000Z')
    const recent = Array.from({ length: 10 }, (_, i) => ({
      recordId: `ai-${i}`,
      createdAt: new Date(nowMs - i * 60_000).toISOString(),
      updatedAt: new Date(nowMs - i * 60_000).toISOString(),
      createdBy: 'user-1',
      data: {
        incidentId: `other-${i}`,
        findings: sampleFindings,
        indicators: [],
        modelId: 'claude-haiku-5-5',
        createdById: 'user-1',
        createdByName: 'Ada',
        reviewStatus: 'pending_review' as const,
        reviewedById: '',
        reviewedByName: '',
        reviewedAt: '',
      },
    }))
    const tools = createTools()
    tools.query = vi.fn(async (collection: string, options?: { where?: Record<string, unknown> }) => {
      if (collection === 'investigation-events') return ok({ records: [], count: 0 })
      if (collection === 'ai-analyses' && options?.where?.createdById === 'user-1') {
        return ok({ records: recent, count: recent.length })
      }
      return ok({ records: [], count: 0 })
    }) as typeof tools.query
    const action = createAnalyzeIncidentAction({
      now: () => nowMs,
      generateAnalysis: async () => ({
        findings: sampleFindings,
        modelId: 'claude-haiku-5-5',
      }),
    })
    const result = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/Rate limit/i)
  })

  it('uses app-owner billing context (no caller JWT required for generation)', async () => {
    const tools = createTools()
    const action = createAnalyzeIncidentAction({
      generateAnalysis: async (_input, genCtx) => {
        expect(genCtx.env.APP_OWNER_JWT).toBe('owner-jwt')
        expect(Object.keys(genCtx)).toEqual(['env'])
        return { findings: sampleFindings, modelId: 'claude-haiku-5-5' }
      },
    })
    const result = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({ billing: 'app_owner', modelId: 'claude-haiku-5-5' })
    }
  })

  it('persists validated findings and a timeline event on success', async () => {
    const tools = createTools()
    const action = createAnalyzeIncidentAction({
      generateAnalysis: async (input) => {
        expect(input.title).toContain('failed MFA')
        expect(input.indicators.some((i) => i.id === 'failed_auth_attempts')).toBe(true)
        return { findings: sampleFindings, modelId: 'claude-haiku-5-5' }
      },
    })
    const result = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    expect(result.success).toBe(true)
    const analysisCreate = tools.creates.find((c) => c.collection === 'ai-analyses')
    expect(analysisCreate?.data.incidentId).toBe('inc-1')
    expect(analysisCreate?.data.reviewStatus).toBe('pending_review')
    expect(analysisCreate?.data.findings).toEqual(sampleFindings)
    expect(analysisCreate?.data.createdById).toBe('user-1')
    const timeline = tools.creates.find((c) => c.collection === 'investigation-events')
    expect(timeline?.data.type).toBe('ai_analysis')
  })

  it('keeps prior analyses by creating new rows instead of overwriting', async () => {
    const tools = createTools()
    let createCount = 0
    tools.create = vi.fn(async (collection: string, data: Record<string, unknown>) => {
      tools.creates.push({ collection, data })
      createCount += 1
      return ok({ recordId: `${collection}-${createCount}` })
    }) as typeof tools.create

    const action = createAnalyzeIncidentAction({
      generateAnalysis: async () => ({
        findings: sampleFindings,
        modelId: 'claude-haiku-5-5',
      }),
      now: () => Date.now() + createCount * 60_000,
    })

    const first = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    const second = await action(ctx({ params: { incidentId: 'inc-1' }, tools }))
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(tools.creates.filter((c) => c.collection === 'ai-analyses')).toHaveLength(2)
  })
})

describe('reviewAiAnalysis action', () => {
  it('updates review status and records timeline activity', async () => {
    const tools = createTools()
    const result = await reviewAiAnalysis(
      ctx({
        params: { analysisId: 'ai-analyses-1', reviewStatus: 'reviewed' },
        tools,
      }),
    )
    expect(result.success).toBe(true)
    expect(tools.updates[0]?.data.reviewStatus).toBe('reviewed')
    expect(tools.updates[0]?.data.reviewedById).toBe('user-1')
    const event = tools.creates.find((c) => c.collection === 'investigation-events')
    expect(event?.data.type).toBe('ai_review')
    expect(event?.data.toValue).toBe('reviewed')
  })

  it('rejects unauthorized viewers from reviewing', async () => {
    const tools = createTools()
    const result = await reviewAiAnalysis(
      ctx({
        userId: 'viewer-1',
        params: {
          analysisId: 'ai-analyses-1',
          reviewStatus: 'needs_further_investigation',
        },
        tools,
      }),
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/Forbidden/i)
    expect(tools.updates).toHaveLength(0)
  })
})
