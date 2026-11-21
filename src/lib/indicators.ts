/**
 * Deterministic indicator extraction for synthetic / text incident bodies.
 * Extracts only values that appear in the input text - never invents numbers,
 * IPs, or timestamps. Facts are for the LLM to interpret; this layer does not
 * change severity, assignment, or incident status.
 */

export type ExtractedIndicator = {
  id: string
  label: string
  /** Observable fact grounded in the source text. */
  detail: string
  /** Numeric values found in the matched span, if any. */
  values: number[]
  evidence: string
}

export type IndicatorExtractionResult = {
  indicators: ExtractedIndicator[]
  sourceLength: number
}

type Detector = {
  id: string
  label: string
  pattern: RegExp
  detail: (match: RegExpMatchArray, values: number[]) => string
}

const NUMBER = String.raw`(\d+(?:\.\d+)?)`

const DETECTORS: Detector[] = [
  {
    id: 'failed_auth_attempts',
    label: 'Repeated failed authentication attempts',
    pattern: new RegExp(
      `${NUMBER}\\s*(?:failed|unsuccessful)\\s+(?:login|sign[- ]?in|authentication|auth)\\s+attempts?`,
      'i',
    ),
    detail: (_m, values) =>
      values[0] !== undefined
        ? `Observed ${values[0]} failed authentication attempts in the incident text.`
        : 'Failed authentication attempts are described in the incident text.',
  },
  {
    id: 'success_after_failures',
    label: 'Successful authentication following failures',
    pattern:
      /(?:successful|succeeded)\s+(?:login|sign[- ]?in|authentication|auth).{0,80}(?:after|following).{0,40}fail/i,
    detail: () =>
      'A successful authentication is described after prior failures in the incident text.',
  },
  {
    id: 'unusual_api_volume',
    label: 'Unusual API request volume',
    pattern: new RegExp(
      `${NUMBER}\\s*(?:api\\s+)?(?:requests?|calls?)\\s*(?:per\\s*(?:minute|min|second|sec|hour|hr)|(?:in|/)\\s*\\d+\\s*(?:s|sec|seconds|m|min|minutes|h|hr|hours))?`,
      'i',
    ),
    detail: (_m, values) =>
      values[0] !== undefined
        ? `Observed API request volume of ${values[0]} in the incident text.`
        : 'Unusual API request volume is described in the incident text.',
  },
  {
    id: 'large_data_download',
    label: 'Large data download',
    pattern: new RegExp(
      `(?:downloaded?|exfiltrat(?:e|ed|ion)|transfer(?:red)?)\\s+${NUMBER}\\s*(GB|MB|TB|GiB|MiB|TiB|bytes?)`,
      'i',
    ),
    detail: (_m, values) =>
      values[0] !== undefined
        ? `A data transfer of ${values[0]} (unit from source text) is described.`
        : 'A large data download/transfer is described in the incident text.',
  },
  {
    id: 'http_429_rate_limit',
    label: 'HTTP 429 rate-limit responses',
    pattern: /(?:HTTP\s*)?429(?:\s+(?:responses?|status(?:es)?|errors?))?|(?:rate[- ]?limit(?:ed|ing)?)\s+(?:responses?|errors?)/i,
    detail: (match) =>
      /429/i.test(match[0])
        ? 'HTTP 429 / rate-limit responses are mentioned in the incident text.'
        : 'Rate limiting is mentioned in the incident text.',
  },
]

function extractNumbers(span: string): number[] {
  const values: number[] = []
  for (const part of span.matchAll(/\d+(?:\.\d+)?/g)) {
    const n = Number(part[0])
    if (Number.isFinite(n)) values.push(n)
  }
  return values
}

/** Run all detectors over concatenated incident text. */
export function extractIndicators(sourceText: string): IndicatorExtractionResult {
  const text = sourceText ?? ''
  const indicators: ExtractedIndicator[] = []
  const seen = new Set<string>()

  for (const detector of DETECTORS) {
    const match = text.match(detector.pattern)
    if (!match || match.index === undefined) continue
    if (seen.has(detector.id)) continue
    seen.add(detector.id)
    const evidence = match[0].slice(0, 240)
    const values = extractNumbers(evidence)
    indicators.push({
      id: detector.id,
      label: detector.label,
      detail: detector.detail(match, values),
      values,
      evidence,
    })
  }

  return { indicators, sourceLength: text.length }
}

export function buildIncidentSourceText(input: {
  title?: string
  description?: string
  notes?: string[]
}): string {
  const parts = [
    input.title?.trim() && `Title: ${input.title.trim()}`,
    input.description?.trim() && `Description: ${input.description.trim()}`,
    ...(input.notes ?? [])
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n, i) => `Note ${i + 1}: ${n}`),
  ].filter(Boolean)
  return parts.join('\n\n')
}
