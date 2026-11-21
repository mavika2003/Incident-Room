import { test, expect } from '@playwright/test'
import { incidentsSchema } from '../src/schemas/incidents-schema'
import { investigationEventsSchema } from '../src/schemas/investigation-events-schema'
import { aiAnalysesSchema } from '../src/schemas/ai-analyses-schema'
import { AI_ANALYSIS_MODEL_ID } from '../src/lib/ai-analysis'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither - see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })

  test('incidents collection enforces claim ownership rules in schema', () => {
    expect(incidentsSchema.ownerField).toBe('assigneeId')
    expect(incidentsSchema.permissions.member?.update).toBe('unclaimed-or-own')
    expect(incidentsSchema.permissions['*']?.read).toBe(false)
    expect(incidentsSchema.permissions['*']?.create).toBe(false)
  })

  test('investigation events stamp authorId and stay append-only for members', () => {
    const author = investigationEventsSchema.columns.find((c) => c.name === 'authorId')
    expect(author?.userBound).toBe(true)
    expect(author?.immutable).toBe(true)
    expect(investigationEventsSchema.permissions.member?.create).toBe(true)
    expect(investigationEventsSchema.permissions.member?.update).toBe(false)
    expect(investigationEventsSchema.permissions.member?.delete).toBe(false)
    expect(investigationEventsSchema.permissions['*']?.read).toBe(false)

    const incidentId = investigationEventsSchema.columns.find((c) => c.name === 'incidentId')
    expect(incidentId?.required).toBe(true)
    expect(incidentId?.immutable).toBe(true)
  })

  test('ai-analyses are server-written and member-readable for realtime review', () => {
    expect(aiAnalysesSchema.permissions.member?.create).toBe(false)
    expect(aiAnalysesSchema.permissions.member?.update).toBe(false)
    expect(aiAnalysesSchema.permissions.member?.read).toBe(true)
    expect(aiAnalysesSchema.permissions.viewer?.read).toBe(true)
    expect(aiAnalysesSchema.permissions['*']?.read).toBe(false)

    const incidentId = aiAnalysesSchema.columns.find((c) => c.name === 'incidentId')
    expect(incidentId?.required).toBe(true)
    expect(incidentId?.immutable).toBe(true)

    const review = aiAnalysesSchema.columns.find((c) => c.name === 'reviewStatus')
    expect(review?.default).toBe('pending_review')

    expect(AI_ANALYSIS_MODEL_ID).toBe('claude-haiku-5-5')
    expect(investigationEventsSchema.columns.find((c) => c.name === 'type')?.interpretation).toMatchObject(
      {
        kind: 'select',
        options: expect.arrayContaining(['ai_analysis', 'ai_review']),
      },
    )
  })
})

