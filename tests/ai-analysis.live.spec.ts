/**
 * Live DeepSpace AI integration for Phase 3 triage.
 *
 * Skipped by default. Enable with:
 *   INCIDENTROOM_LIVE_AI=1 npx deepspace test run ai-analysis.live
 *
 * Consumes app-owner DeepSpace AI credits (analyzeIncident omits authToken so
 * createDeepSpaceAI bills via APP_OWNER_JWT). Uses claude-haiku-5-5. Keep runs rare.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

const liveEnabled = process.env.INCIDENTROOM_LIVE_AI === '1'
const usableTestAccounts = loadAllTestAccounts().length

test.skip(
  !liveEnabled,
  'Set INCIDENTROOM_LIVE_AI=1 to run the live AI analysis integration test (uses DeepSpace credits).',
)

test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}.`,
)

async function createLiveIncident(page: Page, title: string, description: string) {
  await page.goto('/incidents')
  await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'New incident' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill(description)
  await page.getByRole('button', { name: 'Create incident' }).click()
  await expect(page.getByTestId('incident-detail')).toBeVisible({ timeout: 15_000 })
}

async function openIncidentFromList(page: Page, title: string) {
  const rowTitle = page.getByRole('cell', { name: title, exact: true })
  await expect(rowTitle).toBeVisible({ timeout: 20_000 })
  await rowTitle.click()
  await expect(page.getByTestId('incident-detail')).toBeVisible()
}

test('live AI analysis persists and syncs to a second investigator', async ({ users }) => {
  const [alice, bob] = await users(2)
  const title = `__test-ai-${Date.now()}__ failed auth triage`
  const description =
    'Synthetic fixture: 12 failed authentication attempts from a shared jump box, then one successful authentication following failures. No source IP was captured in this note.'

  await createLiveIncident(alice.page, title, description)

  await bob.page.goto('/incidents')
  await expect(bob.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await openIncidentFromList(bob.page, title)

  await alice.page.getByTestId('analyze-with-ai-button').click()
  await expect(alice.page.getByTestId('ai-analysis-loading')).toBeVisible()
  await expect(alice.page.getByTestId('ai-analysis-card')).toBeVisible({ timeout: 90_000 })
  await expect(alice.page.getByTestId('ai-analysis-card')).toContainText('Pending review')

  await expect(bob.page.getByTestId('ai-analysis-card')).toBeVisible({ timeout: 30_000 })
  await expect(bob.page.getByTestId('ai-analysis-card')).toContainText('Pending review')

  await bob.page.getByTestId('ai-analysis-mark-reviewed').click()
  await expect(bob.page.getByTestId('ai-analysis-card')).toContainText('Reviewed', {
    timeout: 20_000,
  })
  await expect(alice.page.getByTestId('ai-analysis-card')).toContainText('Reviewed', {
    timeout: 20_000,
  })
  await expect(
    alice.page.getByTestId('timeline-entry').filter({ hasText: 'AI analysis marked as Reviewed' }),
  ).toBeVisible({ timeout: 20_000 })
})
