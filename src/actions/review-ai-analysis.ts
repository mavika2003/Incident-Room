/**
 * Human review labels for persisted AI analyses.
 * Labels are investigator judgments about the report, not confirmation that
 * hypotheses are true. Does not change incident status or ownership.
 */

import {
  resolveAppRole,
  type ActionHandler,
  type ActionResult,
  type ActionTools,
} from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  isHumanReviewStatus,
  reviewStatusLabel,
  type AiAnalysisRecordData,
  type HumanReviewStatus,
} from '../lib/ai-analysis'
import type { InvestigationEvent } from '../lib/investigation-events'

type UserRow = {
  name?: string
  email?: string
  role?: string
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

async function assertInvestigator(
  env: Env,
  userId: string,
  tools: ActionTools,
): Promise<{ name: string } | ActionResult> {
  const role = await resolveAppRole(env, userId)
  if (role === 'viewer') {
    return { success: false, error: 'Forbidden: investigators only' }
  }

  const got = await tools.get<UserRow>('users', userId)
  if (!got.success) {
    return { success: false, error: 'Unable to verify investigator membership' }
  }
  const data = got.data.record.data
  if (asString(data.role) === 'viewer') {
    return { success: false, error: 'Forbidden: investigators only' }
  }
  const name = asString(data.name).trim() || asString(data.email).trim() || 'Investigator'
  return { name }
}

export const reviewAiAnalysis: ActionHandler<Env> = async ({
  userId,
  params,
  tools,
  env,
}) => {
  const analysisId = asString(params.analysisId).trim()
  const reviewStatus = params.reviewStatus
  if (!analysisId) {
    return { success: false, error: 'analysisId is required' }
  }
  if (!isHumanReviewStatus(reviewStatus)) {
    return {
      success: false,
      error: 'reviewStatus must be "reviewed" or "needs_further_investigation"',
    }
  }

  const authz = await assertInvestigator(env, userId, tools)
  if ('success' in authz && authz.success === false) return authz
  const reviewerName = (authz as { name: string }).name

  const existing = await tools.get<AiAnalysisRecordData>('ai-analyses', analysisId)
  if (!existing.success) {
    return { success: false, error: 'AI analysis not found or inaccessible' }
  }

  const row = existing.data.record
  const incidentId = asString(row.data.incidentId).trim()
  if (!incidentId) {
    return { success: false, error: 'AI analysis is missing incident linkage' }
  }

  // Confirm the parent incident still exists (authorization boundary for access).
  const incident = await tools.get('incidents', incidentId)
  if (!incident.success) {
    return { success: false, error: 'Incident not found or inaccessible' }
  }

  const previous = asString(row.data.reviewStatus) || 'pending_review'
  const next = reviewStatus as HumanReviewStatus
  const reviewedAt = new Date().toISOString()

  const updated = await tools.update<AiAnalysisRecordData>('ai-analyses', analysisId, {
    reviewStatus: next,
    reviewedById: userId,
    reviewedByName: reviewerName,
    reviewedAt,
  })
  if (!updated.success) {
    return {
      success: false,
      error: updated.error || 'Failed to update review status',
    }
  }

  await tools.create<InvestigationEvent>('investigation-events', {
    incidentId,
    type: 'ai_review',
    body: `AI analysis marked as ${reviewStatusLabel(next)}.`,
    fromValue: previous,
    toValue: next,
    authorId: '',
    authorName: reviewerName,
  })

  return {
    success: true,
    data: {
      analysisId,
      incidentId,
      reviewStatus: next,
      reviewedById: userId,
      reviewedByName: reviewerName,
      reviewedAt,
    },
  }
}
