import { describe, expect, it } from 'vitest'
import { SYNTHETIC_INCIDENTS } from './incidents'
import { buildIncidentSourceText, extractIndicators } from './indicators'

describe('extractIndicators', () => {
  it('extracts failed auth count and success-after-failures from DEMO-INC-2402 text', () => {
    const demo = SYNTHETIC_INCIDENTS.find((row) => row.displayId === 'DEMO-INC-2402')
    expect(demo).toBeTruthy()
    const source = buildIncidentSourceText({
      title: demo!.title,
      description: demo!.description,
    })
    const { indicators } = extractIndicators(source)
    const ids = indicators.map((i) => i.id)
    expect(ids).toContain('failed_auth_attempts')
    expect(ids).toContain('success_after_failures')
    const failed = indicators.find((i) => i.id === 'failed_auth_attempts')
    expect(failed?.values).toContain(47)
  })

  it('extracts API volume, download size, and HTTP 429 from DEMO-INC-2406 text', () => {
    const demo = SYNTHETIC_INCIDENTS.find((row) => row.displayId === 'DEMO-INC-2406')
    expect(demo).toBeTruthy()
    const source = buildIncidentSourceText({
      title: demo!.title,
      description: demo!.description,
    })
    const { indicators } = extractIndicators(source)
    const byId = Object.fromEntries(indicators.map((i) => [i.id, i]))
    expect(byId.unusual_api_volume?.values).toContain(1200)
    expect(byId.large_data_download?.values).toContain(4.2)
    expect(byId.http_429_rate_limit).toBeTruthy()
  })

  it('does not invent numeric values when none are present', () => {
    const { indicators } = extractIndicators(
      'Users reported failed login attempts after a phishing wave. Rate limiting may be involved.',
    )
    for (const ind of indicators) {
      expect(ind.values).toEqual([])
    }
  })

  it('returns no indicators for sparse ambiguous text', () => {
    const { indicators } = extractIndicators(
      'Something odd happened on a workstation. Investigate further.',
    )
    expect(indicators).toEqual([])
  })
})
