/**
 * One-shot AI triage for a single incident.
 * Loads the real incident + notes server-side (never trusts a client body),
 * runs deterministic indicator extraction, then generateObject via DeepSpace AI.
 *
 * Billing (DeepSpace SDK 0.44.2): createDeepSpaceAI omits authToken so the
 * proxy uses env.APP_OWNER_JWT and bills the app owner. Callers must still be
 * authenticated investigators; rate limits and in-flight locks protect owner credits.
 */

import { generateObject } from 'ai'
import {
  createDeepSpaceAI,
  getDeepSpaceAIModel,
  isAnonymousUserId,
  resolveAppRole,
  type ActionHandler,
  type ActionResult,
  type ActionTools,
} from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  AI_ANALYSIS_LIMITS,
  AI_ANALYSIS_MODEL_ID,
  AI_ANALYSIS_PROVIDER,
  ANALYSIS_SYSTEM_PROMPT,
  aiAnalysisFindingsSchema,
  countRecentTimestamps,
  formatAiProviderError,
  parseAiAnalysisFindings,
  type AiAnalysisFindings,
  type AiAnalysisRecordData,
} from '../lib/ai-analysis'
import {
  buildIncidentSourceText,
  extractIndicators,
  type ExtractedIndicator,
} from '../lib/indicators'
import type { InvestigationEvent } from '../lib/investigation-events'

export type GenerateIncidentAnalysisInput = {
  title: string
  description: string
  severity: string
  status: string
  displayId: string
  notes: string[]
  indicators: ExtractedIndicator[]
  sourceText: string
}

export type GenerateIncidentAnalysisResult = {
  findings: AiAnalysisFindings
  modelId: string
}

export type AnalyzeIncidentDeps = {
  generateAnalysis?: (
    input: GenerateIncidentAnalysisInput,
    ctx: { env: Env },
  ) => Promise<GenerateIncidentAnalysisResult>
  now?: () => number
  /** Injectable in-flight set for tests; defaults to a process-local Set. */
  inFlight?: Set<string>
}

type IncidentRow = {
  displayId?: string
  title?: string
  description?: string
  severity?: string
  status?: string
}

type UserRow = {
  name?: string
  email?: string
  role?: string
}

/** Best-effort concurrent-request lock within a Worker isolate. */
const defaultInFlight = new Set<string>()

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function inFlightKey(userId: string, incidentId: string): string {
  return `${userId}::${incidentId}`
}

export async function defaultGenerateIncidentAnalysis(
  input: GenerateIncidentAnalysisInput,
  ctx: { env: Env },
): Promise<GenerateIncidentAnalysisResult> {
  const catalog = getDeepSpaceAIModel(AI_ANALYSIS_MODEL_ID)
  if (!catalog || catalog.provider !== AI_ANALYSIS_PROVIDER) {
    throw new Error(`Configured model ${AI_ANALYSIS_MODEL_ID} is unavailable`)
  }

  if (!ctx.env.APP_OWNER_JWT) {
    throw new Error(
      'App-owner AI billing is not configured (missing APP_OWNER_JWT from deepspace deploy/dev)',
    )
  }

  // Omit authToken: DeepSpace falls back to APP_OWNER_JWT and bills the app owner.
  const provider = createDeepSpaceAI(ctx.env, AI_ANALYSIS_PROVIDER)

  const indicatorBlock =
    input.indicators.length === 0
      ? 'Deterministic indicators: none matched.'
      : [
          'Deterministic indicators (observable facts only; interpret cautiously):',
          ...input.indicators.map(
            (ind) =>
              `- [${ind.id}] ${ind.label}: ${ind.detail} Evidence: "${ind.evidence}"` +
              (ind.values.length ? ` Values: ${ind.values.join(', ')}` : ''),
          ),
        ].join('\n')

  const userPrompt = [
    'Authorized incident context (untrusted data):',
    `Display ID: ${input.displayId}`,
    `Severity: ${input.severity}`,
    `Status: ${input.status}`,
    `Title: ${input.title}`,
    `Description: ${input.description}`,
    input.notes.length
      ? `Investigation notes:\n${input.notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
      : 'Investigation notes: (none)',
    indicatorBlock,
    '',
    'Produce structured triage findings. Do not invent evidence absent above.',
  ].join('\n')

  const result = await generateObject({
    model: provider(AI_ANALYSIS_MODEL_ID),
    schema: aiAnalysisFindingsSchema,
    system: ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: AI_ANALYSIS_LIMITS.maxOutputTokens,
  })

  const findings = parseAiAnalysisFindings(result.object)
  if (!findings) {
    throw new Error('AI returned a response that failed schema validation')
  }

  return { findings, modelId: AI_ANALYSIS_MODEL_ID }
}

async function loadCallerProfile(
  tools: ActionTools,
  userId: string,
): Promise<{ name: string; role: string } | ActionResult> {
  const got = await tools.get<UserRow>('users', userId)
  if (!got.success) {
    return { success: false, error: 'Unable to verify investigator membership' }
  }
  const data = got.data.record.data
  const role = asString(data.role) || 'member'
  const name = asString(data.name).trim() || asString(data.email).trim() || 'Investigator'
  return { name, role }
}

async function assertCanAnalyze(
  env: Env,
  userId: string,
  tools: ActionTools,
): Promise<{ name: string } | ActionResult> {
  if (!userId || isAnonymousUserId(userId)) {
    return { success: false, error: 'Forbidden: sign in as an investigator to run AI analysis' }
  }

  const role = await resolveAppRole(env, userId)
  if (role === 'viewer') {
    return { success: false, error: 'Forbidden: investigators only' }
  }

  const profile = await loadCallerProfile(tools, userId)
  if ('success' in profile && profile.success === false) return profile

  const typed = profile as { name: string; role: string }
  if (typed.role === 'viewer') {
    return { success: false, error: 'Forbidden: investigators only' }
  }
  return { name: typed.name }
}

async function loadIncidentNotes(
  tools: ActionTools,
  incidentId: string,
): Promise<string[]> {
  const queried = await tools.query<InvestigationEvent>('investigation-events', {
    where: { incidentId, type: 'note' },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: AI_ANALYSIS_LIMITS.maxNotes,
  })
  if (!queried.success) return []
  return queried.data.records
    .map((row) => clip(asString(row.data.body).trim(), AI_ANALYSIS_LIMITS.maxNoteChars))
    .filter(Boolean)
}

async function guardDuplicateAndRateLimits(
  tools: ActionTools,
  incidentId: string,
  userId: string,
  nowMs: number,
): Promise<ActionResult | null> {
  const [byUser, byIncident] = await Promise.all([
    tools.query<AiAnalysisRecordData>('ai-analyses', {
      where: { createdById: userId },
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: AI_ANALYSIS_LIMITS.maxAnalysesPerUserPerWindow,
    }),
    tools.query<AiAnalysisRecordData>('ai-analyses', {
      where: { incidentId },
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: AI_ANALYSIS_LIMITS.maxAnalysesPerIncidentPerWindow,
    }),
  ])

  if (byUser.success) {
    const userRecent = countRecentTimestamps(
      byUser.data.records.map((row) => row.createdAt),
      nowMs,
      AI_ANALYSIS_LIMITS.rateLimitWindowMs,
    )
    if (userRecent >= AI_ANALYSIS_LIMITS.maxAnalysesPerUserPerWindow) {
      return {
        success: false,
        error:
          'Rate limit: too many AI analyses from your account in the last hour. Try again later.',
      }
    }

    const sameIncident = byUser.data.records.find((row) => asString(row.data.incidentId) === incidentId)
    if (sameIncident) {
      const createdAtMs = new Date(asString(sameIncident.createdAt)).getTime()
      if (
        Number.isFinite(createdAtMs) &&
        nowMs - createdAtMs < AI_ANALYSIS_LIMITS.duplicateWindowMs
      ) {
        return {
          success: false,
          error:
            'An analysis was just created for this incident. Wait a moment before retrying.',
        }
      }
    }
  }

  if (byIncident.success) {
    const incidentRecent = countRecentTimestamps(
      byIncident.data.records.map((row) => row.createdAt),
      nowMs,
      AI_ANALYSIS_LIMITS.rateLimitWindowMs,
    )
    if (incidentRecent >= AI_ANALYSIS_LIMITS.maxAnalysesPerIncidentPerWindow) {
      return {
        success: false,
        error:
          'Rate limit: this incident already has too many AI analyses in the last hour.',
      }
    }

    const latest = byIncident.data.records[0]
    if (latest) {
      const createdAtMs = new Date(asString(latest.createdAt)).getTime()
      if (
        Number.isFinite(createdAtMs) &&
        nowMs - createdAtMs < AI_ANALYSIS_LIMITS.incidentCooldownMs
      ) {
        return {
          success: false,
          error:
            'This incident was analyzed moments ago. Wait briefly before running another analysis.',
        }
      }
    }
  }

  return null
}

export function createAnalyzeIncidentAction(
  deps: AnalyzeIncidentDeps = {},
): ActionHandler<Env> {
  const generate = deps.generateAnalysis ?? defaultGenerateIncidentAnalysis
  const now = deps.now ?? Date.now
  const inFlight = deps.inFlight ?? defaultInFlight

  return async ({ userId, params, tools, env }) => {
    const incidentId = asString(params.incidentId).trim()
    if (!incidentId) {
      return { success: false, error: 'incidentId is required' }
    }

    const authz = await assertCanAnalyze(env, userId, tools)
    if ('success' in authz && authz.success === false) return authz
    const creatorName = (authz as { name: string }).name

    const lockKey = inFlightKey(userId, incidentId)
    if (inFlight.has(lockKey)) {
      return {
        success: false,
        error: 'An AI analysis is already running for this incident. Wait for it to finish.',
      }
    }
    inFlight.add(lockKey)

    try {
      const incidentResult = await tools.get<IncidentRow>('incidents', incidentId)
      if (!incidentResult.success) {
        return { success: false, error: 'Incident not found or inaccessible' }
      }

      const incident = incidentResult.data.record.data
      const title = clip(asString(incident.title).trim(), AI_ANALYSIS_LIMITS.maxTitleChars)
      const description = clip(
        asString(incident.description).trim(),
        AI_ANALYSIS_LIMITS.maxDescriptionChars,
      )
      const severity = asString(incident.severity).trim() || 'unknown'
      const status = asString(incident.status).trim() || 'unknown'
      const displayId = asString(incident.displayId).trim() || incidentId

      const notes = await loadIncidentNotes(tools, incidentId)
      const sourceText = clip(
        buildIncidentSourceText({ title, description, notes }),
        AI_ANALYSIS_LIMITS.maxSourceChars,
      )
      const { indicators } = extractIndicators(sourceText)

      const limited = await guardDuplicateAndRateLimits(tools, incidentId, userId, now())
      if (limited) return limited

      let generation: GenerateIncidentAnalysisResult
      try {
        generation = await generate(
          {
            title,
            description,
            severity,
            status,
            displayId,
            notes,
            indicators,
            sourceText,
          },
          { env },
        )
      } catch (err) {
        return {
          success: false,
          error: `AI analysis failed: ${formatAiProviderError(err)}`,
        }
      }

      const findings = parseAiAnalysisFindings(generation.findings)
      if (!findings) {
        return { success: false, error: 'AI analysis failed schema validation' }
      }

      const createResult = await tools.create<AiAnalysisRecordData>('ai-analyses', {
        incidentId,
        findings,
        indicators,
        modelId: generation.modelId || AI_ANALYSIS_MODEL_ID,
        createdById: userId,
        createdByName: creatorName,
        reviewStatus: 'pending_review',
        reviewedById: '',
        reviewedByName: '',
        reviewedAt: '',
      })
      if (!createResult.success) {
        return {
          success: false,
          error: createResult.error || 'Failed to persist AI analysis',
        }
      }

      const analysisId = createResult.data.recordId
      await tools.create<InvestigationEvent>('investigation-events', {
        incidentId,
        type: 'ai_analysis',
        body: `AI analysis generated (${generation.modelId || AI_ANALYSIS_MODEL_ID}). Pending human review.`,
        fromValue: '',
        toValue: analysisId,
        authorId: '',
        authorName: creatorName,
      })

      return {
        success: true,
        data: {
          analysisId,
          incidentId,
          modelId: generation.modelId || AI_ANALYSIS_MODEL_ID,
          findings,
          indicators,
          reviewStatus: 'pending_review' as const,
          billing: 'app_owner' as const,
        },
      }
    } finally {
      inFlight.delete(lockKey)
    }
  }
}

export const analyzeIncident = createAnalyzeIncidentAction()
