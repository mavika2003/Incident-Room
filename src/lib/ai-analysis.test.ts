import { describe, expect, it } from 'vitest'
import {
  aiAnalysisFindingsSchema,
  countRecentTimestamps,
  formatAiProviderError,
  parseAiAnalysisFindings,
  type AiAnalysisFindings,
} from './ai-analysis'

const validFindings: AiAnalysisFindings = {
  summary: 'Multiple failed MFA challenges against admin accounts, then one success.',
  threatCategory: 'credential_access',
  supportingEvidence: [
    '47 failed authentication attempts between 02:10-02:40 UTC',
    'Successful authentication following failures at 02:41 UTC',
  ],
  hypotheses: [
    'Possible MFA fatigue leading to accidental approval',
    'Possible credential stuffing culminating in a valid login',
  ],
  recommendedSteps: [
    'Confirm whether the successful session used expected device posture',
    'Review related auth logs for the admin-bridge principal',
  ],
  confidence: {
    level: 'medium',
    justification: 'Counts and sequence are present, but intent is not proven.',
  },
  missingEvidence: [
    'Source IP or ASN for the successful session',
    'Whether the push was approved or bypassed',
  ],
}

describe('aiAnalysisFindingsSchema', () => {
  it('accepts a complete structured analysis', () => {
    expect(aiAnalysisFindingsSchema.parse(validFindings)).toEqual(validFindings)
  })

  it('rejects missing required fields', () => {
    const parsed = aiAnalysisFindingsSchema.safeParse({
      summary: 'Incomplete',
    })
    expect(parsed.success).toBe(false)
  })

  it('parseAiAnalysisFindings returns null for malformed payloads', () => {
    expect(parseAiAnalysisFindings(null)).toBeNull()
    expect(parseAiAnalysisFindings({ summary: 12 })).toBeNull()
    expect(
      parseAiAnalysisFindings({
        ...validFindings,
        confidence: { level: 'extreme', justification: 'nope' },
      }),
    ).toBeNull()
  })

  it('keeps sparse-evidence analyses valid when uncertainty is explicit', () => {
    const sparse: AiAnalysisFindings = {
      summary: 'Insufficient detail to triage confidently.',
      threatCategory: 'insufficient_information',
      supportingEvidence: ['Title only mentions an anomaly without telemetry.'],
      hypotheses: ['Could be benign noise or an early-stage intrusion.'],
      recommendedSteps: ['Request raw auth and network telemetry for the window.'],
      confidence: {
        level: 'low',
        justification: 'No concrete indicators or timestamps were provided.',
      },
      missingEvidence: ['No IPs, hosts, users, or log excerpts were present.'],
    }
    expect(parseAiAnalysisFindings(sparse)).toEqual(sparse)
  })
})

describe('AI billing helpers', () => {
  it('counts only timestamps inside the sliding window', () => {
    const now = Date.parse('2026-11-21T18:00:00.000Z')
    const hour = 60 * 60 * 1000
    expect(
      countRecentTimestamps(
        [
          '2026-11-21T17:30:00.000Z',
          '2026-11-21T17:10:00.000Z',
          '2026-11-21T10:00:00.000Z',
        ],
        now,
        hour,
      ),
    ).toBe(2)
  })

  it('formats insufficient-credit provider failures clearly', () => {
    expect(formatAiProviderError(new Error('insufficient credits'))).toMatch(
      /insufficient credits or quota on the app owner account/i,
    )
  })
})
