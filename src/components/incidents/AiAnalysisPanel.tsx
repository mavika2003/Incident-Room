import { useMemo, useRef, useState } from 'react'
import { useQuery, useUser, useUserLookup } from 'deepspace'
import { AlertTriangle, BrainCircuit, CheckCircle2, Loader2, Search } from 'lucide-react'
import {
  Badge,
  Button,
  useToast,
} from '@/components/ui'
import {
  confidenceLabel,
  parseAiAnalysisFindings,
  reviewStatusLabel,
  sortAnalysesNewestFirst,
  type AiAnalysisFindings,
  type AiAnalysisRecord,
  type AiAnalysisRecordData,
  type HumanReviewStatus,
} from '@/lib/ai-analysis'
import { invokeAction } from '@/lib/invoke-action'
import { asText, formatIncidentTime } from '@/lib/incidents'
import type { ExtractedIndicator } from '@/lib/indicators'

function FindingsBody({ findings }: { findings: AiAnalysisFindings }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </h5>
        <p className="mt-1 break-words leading-relaxed text-foreground">{findings.summary}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Threat category
          </h5>
          <p className="mt-1 break-words text-foreground">{findings.threatCategory}</p>
        </div>
        <div className="min-w-0">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Confidence
          </h5>
          <p className="mt-1 break-words text-foreground">
            {confidenceLabel(findings.confidence.level)} - {findings.confidence.justification}
          </p>
        </div>
      </div>

      <EvidenceList title="Supporting evidence" items={findings.supportingEvidence} tone="fact" />
      <EvidenceList title="Hypotheses (not confirmed)" items={findings.hypotheses} tone="hypothesis" />
      <EvidenceList title="Recommended investigation steps" items={findings.recommendedSteps} />
      <EvidenceList
        title="Missing evidence / unresolved questions"
        items={findings.missingEvidence}
        tone="gap"
      />
    </div>
  )
}

function EvidenceList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone?: 'fact' | 'hypothesis' | 'gap'
}) {
  if (items.length === 0) {
    return (
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h5>
        <p className="mt-1 text-xs text-muted-foreground">None listed.</p>
      </div>
    )
  }

  const marker =
    tone === 'hypothesis' ? '?' : tone === 'gap' ? '!' : '•'

  return (
    <div>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h5>
      <ul className="mt-1 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 leading-relaxed text-foreground">
            <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground" aria-hidden>
              {marker}
            </span>
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function IndicatorList({ indicators }: { indicators: ExtractedIndicator[] }) {
  if (!indicators.length) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        No rule-based indicators matched this text. That only means the built-in extractors did not
        fire; the AI report above can still triage unsupported patterns from the incident
        description and notes.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {indicators.map((ind) => (
        <li
          key={ind.id}
          className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs"
        >
          <p className="break-words font-medium text-foreground">{ind.label}</p>
          <p className="mt-0.5 break-words text-muted-foreground">{ind.detail}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            Evidence: {ind.evidence}
          </p>
        </li>
      ))}
    </ul>
  )
}

function reviewBadgeVariant(
  status: string,
): 'secondary' | 'success' | 'warning' {
  if (status === 'reviewed') return 'success'
  if (status === 'needs_further_investigation') return 'warning'
  return 'secondary'
}

function AnalysisCard({
  row,
  reviewing,
  onReview,
}: {
  row: AiAnalysisRecord
  reviewing: boolean
  onReview: (status: HumanReviewStatus) => void
}) {
  const { getName } = useUserLookup()
  const findings = parseAiAnalysisFindings(row.data.findings)
  const indicators = Array.isArray(row.data.indicators) ? row.data.indicators : []
  const creatorName =
    getName(row.data.createdById) || asText(row.data.createdByName) || 'Investigator'
  const reviewerName = row.data.reviewedById
    ? getName(row.data.reviewedById) || asText(row.data.reviewedByName) || 'Investigator'
    : null

  return (
    <article
      className="min-w-0 space-y-4 overflow-hidden rounded-lg border border-border bg-card/60 p-4"
      data-testid="ai-analysis-card"
      data-analysis-id={row.recordId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={reviewBadgeVariant(row.data.reviewStatus)}>
              {reviewStatusLabel(row.data.reviewStatus)}
            </Badge>
            <span className="break-all font-mono text-[11px] text-muted-foreground">
              {asText(row.data.modelId) || 'model unknown'}
            </span>
          </div>
          <p className="break-words text-xs text-muted-foreground">
            Generated {formatIncidentTime(row.createdAt)} by {creatorName}
          </p>
          {reviewerName && row.data.reviewedAt && (
            <p className="break-words text-xs text-muted-foreground">
              Reviewer {reviewerName} at {formatIncidentTime(row.data.reviewedAt)}
            </p>
          )}
        </div>
      </div>

      {findings ? (
        <FindingsBody findings={findings} />
      ) : (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Stored findings failed validation and cannot be displayed safely.
        </p>
      )}

      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Deterministic indicators
        </h5>
        <div className="mt-2">
          <IndicatorList indicators={indicators} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          loading={reviewing}
          disabled={reviewing}
          onClick={() => onReview('reviewed')}
          data-testid="ai-analysis-mark-reviewed"
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Mark reviewed
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={reviewing}
          disabled={reviewing}
          onClick={() => onReview('needs_further_investigation')}
          data-testid="ai-analysis-needs-investigation"
        >
          <Search className="size-4" aria-hidden />
          Needs further investigation
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Review labels describe investigator follow-up on the report. They do not confirm that AI
        hypotheses are true, and they do not change incident status or ownership.
      </p>
    </article>
  )
}

export function AiAnalysisPanel({ incidentId }: { incidentId: string }) {
  const { records, status, error } = useQuery<AiAnalysisRecordData>('ai-analyses', {
    where: { incidentId },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { user } = useUser()
  const { success, error: showError } = useToast()
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const analyses = useMemo(() => sortAnalysesNewestFirst(records), [records])

  async function runAnalysis() {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const result = await invokeAction<{ analysisId: string }>('analyzeIncident', {
        incidentId,
      })
      if (!result.success) {
        setAnalyzeError(result.error)
        showError('AI analysis failed', result.error)
        return
      }
      success('AI analysis saved', 'Report is pending human review.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setAnalyzeError(message)
      showError('AI analysis failed', message)
    } finally {
      setAnalyzing(false)
      inFlightRef.current = false
    }
  }

  async function reviewAnalysis(analysisId: string, reviewStatus: HumanReviewStatus) {
    setReviewingId(analysisId)
    try {
      const result = await invokeAction('reviewAiAnalysis', {
        analysisId,
        reviewStatus,
      })
      if (!result.success) {
        showError('Review update failed', result.error)
        return
      }
      success(
        'Review updated',
        reviewStatus === 'reviewed'
          ? 'Marked as reviewed.'
          : 'Marked as needing further investigation.',
      )
    } catch (err) {
      showError('Review update failed', err instanceof Error ? err.message : String(err))
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <section className="space-y-4" data-testid="ai-analysis-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI analysis
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Evidence-grounded triage via DeepSpace AI (billed to the app owner). Previous reports
            are kept for history.
            {user ? null : ' Sign in required.'}
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          loading={analyzing}
          disabled={analyzing || !user}
          onClick={() => void runAnalysis()}
          data-testid="analyze-with-ai-button"
        >
          {analyzing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <BrainCircuit className="size-4" aria-hidden />
          )}
          Analyze with AI
        </Button>
      </div>

      {analyzing && (
        <div
          className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-testid="ai-analysis-loading"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Generating structured triage report…
        </div>
      )}

      {analyzeError && (
        <div
          className="break-words rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="ai-analysis-error"
          role="alert"
        >
          {analyzeError}
        </div>
      )}

      {status === 'error' && (
        <p className="text-sm text-destructive">
          Could not load saved analyses{error ? `: ${error}` : '.'}
        </p>
      )}

      {status === 'loading' && analyses.length === 0 && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading AI analyses">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {status !== 'loading' && analyses.length === 0 && !analyzing && (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No AI analyses yet. Run Analyze with AI to generate a structured triage report from this
          incident and its notes.
        </p>
      )}

      <div className="space-y-4">
        {analyses.map((row) => (
          <AnalysisCard
            key={row.recordId}
            row={row}
            reviewing={reviewingId === row.recordId}
            onReview={(next) => void reviewAnalysis(row.recordId, next)}
          />
        ))}
      </div>
    </section>
  )
}
