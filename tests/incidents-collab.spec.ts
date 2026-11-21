/**
 * Phase 2 collaboration: assignment, notes, realtime sync, persistence.
 * Requires 2 usable DeepSpace test accounts on this machine.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

async function expectIncidentDetailTitle(page: Page, title: string) {
  await expect(
    page.getByTestId('incident-detail').getByRole('heading', { name: title, exact: true }),
  ).toBeVisible()
}

async function openIncidentFromList(page: Page, title: string) {
  const rowTitle = page.getByRole('cell', { name: title, exact: true })
  await expect(rowTitle).toBeVisible({ timeout: 20_000 })
  await rowTitle.click()
  await expect(page.getByTestId('incident-detail')).toBeVisible()
  await expectIncidentDetailTitle(page, title)
}

async function createLiveIncident(page: Page, title: string) {
  await page.goto('/incidents')
  await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'New incident' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('Phase 2 collab fixture')
  await page.getByRole('button', { name: 'Create incident' }).click()
  await expect(page.getByTestId('incident-detail')).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByTestId('incident-detail').getByRole('heading', { name: title, exact: true }),
  ).toBeVisible()
}

test('two users sync claim, status, and investigation notes', async ({ users }) => {
  const [alice, bob] = await users(2)
  const title = `__test-${Date.now()}__ collab claim`

  await createLiveIncident(alice.page, title)

  await bob.page.goto('/incidents')
  await expect(bob.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await openIncidentFromList(bob.page, title)

  // Alice claims - Bob should see the assignee update without refresh.
  await alice.page.getByTestId('claim-incident-button').click()
  await expect(alice.page.getByTestId('release-incident-button')).toBeVisible({
    timeout: 15_000,
  })
  await expect(bob.page.getByTestId('incident-assignee-name')).not.toHaveText('Unassigned', {
    timeout: 20_000,
  })

  // Alice changes status - Bob sees it via realtime records.
  await alice.page.getByTestId('incident-status-select').click()
  await alice.page.getByRole('option', { name: 'Investigating', exact: true }).click()
  await expect(alice.page.getByTestId('incident-status-select')).toContainText('Investigating')
  await expect(bob.page.getByTestId('incident-status-select')).toContainText('Investigating', {
    timeout: 20_000,
  })

  // Alice adds a note - Bob's timeline updates live.
  const note = `__test-note-${Date.now()}__ lateral movement check`
  await alice.page.getByTestId('investigation-note-input').fill(note)
  await alice.page.getByTestId('investigation-note-submit').click()
  await expect(alice.page.getByTestId('timeline-entry').filter({ hasText: note })).toBeVisible({
    timeout: 15_000,
  })
  await expect(bob.page.getByTestId('timeline-entry').filter({ hasText: note })).toBeVisible({
    timeout: 20_000,
  })

  // Persistence after refresh for Bob.
  await bob.page.reload()
  await expect(bob.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await openIncidentFromList(bob.page, title)
  await expect(bob.page.getByTestId('timeline-entry').filter({ hasText: note })).toBeVisible({
    timeout: 15_000,
  })
  await expect(bob.page.getByTestId('incident-assignee-name')).not.toHaveText('Unassigned')
})

test('concurrent claim: only one investigator wins', async ({ users }) => {
  test.setTimeout(60_000)
  const [alice, bob] = await users(2)
  const title = `__test-${Date.now()}__ race claim`

  await createLiveIncident(alice.page, title)
  await bob.page.goto('/incidents')
  await expect(bob.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await openIncidentFromList(bob.page, title)
  await expect(bob.page.getByTestId('claim-incident-button')).toBeVisible()
  await expect(alice.page.getByTestId('claim-incident-button')).toBeVisible()

  // Fire both claims as close together as possible. The DO's
  // unclaimed-or-own check makes the second write fail. The loser's Claim
  // button unmounts via realtime sync, so Playwright's default click retry
  // would hang - tolerate a short-lived detached button after the race.
  await Promise.all([
    alice.page.getByTestId('claim-incident-button').click({ timeout: 3_000 }).catch(() => undefined),
    bob.page.getByTestId('claim-incident-button').click({ timeout: 3_000 }).catch(() => undefined),
  ])

  // Wait until both clients converge on the same non-empty assignee.
  await expect
    .poll(async () => {
      const a = (await alice.page.getByTestId('incident-assignee-name').textContent())?.trim()
      const b = (await bob.page.getByTestId('incident-assignee-name').textContent())?.trim()
      return a && b && a === b && a !== 'Unassigned' ? a : null
    }, { timeout: 20_000 })
    .toBeTruthy()

  const winner = (await alice.page.getByTestId('incident-assignee-name').textContent())?.trim()
  expect(winner).toBeTruthy()
  await expect(bob.page.getByTestId('incident-assignee-name')).toHaveText(winner!)

  // Only the winner can release.
  const aliceCanRelease = await alice.page.getByTestId('release-incident-button').count()
  const bobCanRelease = await bob.page.getByTestId('release-incident-button').count()
  expect(aliceCanRelease + bobCanRelease).toBe(1)
})
