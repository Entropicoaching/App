import assert from 'node:assert/strict'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID, WEEK_ID, EXERCISE_ID } from './fixtures.mjs'

// Selvstændig udgivelsesprøve. Import starter ingen browser eller server.
export const CASES = [
  { name: 'soendag', now: '2026-10-18T10:00:00Z', monday: '2026-10-12', next: '2026-10-19', range: '19. okt. – 25. okt.' },
  { name: 'sommertid-foer', now: '2026-03-29T00:30:00Z', monday: '2026-03-23', next: '2026-03-30', range: '30. mar. – 5. apr.' },
  { name: 'sommertid-efter', now: '2026-03-29T01:30:00Z', monday: '2026-03-23', next: '2026-03-30', range: '30. mar. – 5. apr.' },
  { name: 'vintertid', now: '2026-10-25T01:30:00Z', monday: '2026-10-19', next: '2026-10-26', range: '26. okt. – 1. nov.' },
]
export const NEXT_WEEK_ID = '44444444-4444-4444-8444-444444444445'
export const NEXT_SESSION_ID = '55555555-5555-4555-8555-555555555556'
export const NEXT_EXERCISE_ID = '66666666-6666-4666-8666-666666666667'
export const BENCH_ID = '66666666-6666-4666-8666-666666666668'
export const NOTE = 'Syntetisk udgivelsestjek: ro i knæene, æøå.'

export function buildReleaseSeed(c) {
  assert.ok(CASES.includes(c), 'Brug en fast prøvedato')
  const seed = buildSeed()
  seed.tables.athletes[0].onboarding_completed_at = c.now
  seed.tables.athletes[0].notes = null
  seed.tables.weeks[0].start_date = c.monday
  seed.tables.weeks.push({ id: NEXT_WEEK_ID, athlete_id: ATHLETE_ID, week_number: 2,
    block_name: 'Næste testuge', start_date: c.next })
  seed.tables.sessions[0].weekday = 6
  seed.tables.sessions.push({ id: NEXT_SESSION_ID, week_id: NEXT_WEEK_ID,
    title: 'Næste testpas', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
  seed.tables.exercises.push(
    { ...seed.tables.exercises[0], id: BENCH_ID, name: 'Bænkpres', sets: 2, exercise_order: 2 },
    { ...seed.tables.exercises[0], id: NEXT_EXERCISE_ID, session_id: NEXT_SESSION_ID,
      name: 'Næste uges dødløft', sets: 3 },
  )
  return seed
}

export function assertLocalUrl(value) {
  const url = new URL(value)
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && !url.username && !url.password, 'Prøven kræver lokal HTTP-mock og lokal app')
  return url
}

export async function readMockTable(mockUrl, name) {
  const url = assertLocalUrl(mockUrl)
  url.pathname = '/__e2e/table'
  url.search = new URLSearchParams({ name }).toString()
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) })
  assert.ok(response.ok, `Mocktabel ${name}: HTTP ${response.status}`)
  const rows = await response.json()
  assert.ok(Array.isArray(rows), `Mocktabel ${name} skal være en liste`)
  return rows
}

// Node-polling: venter på udfaldet, også ved midlertidigt tomme tabeller.
export async function waitRows(read, table, predicate, { attempts = 100, pause = 100 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const rows = await read(table)
    if (predicate(rows)) return rows
    if (i + 1 < attempts) await new Promise(resolve => setTimeout(resolve, pause))
  }
  assert.fail(`Intet forventet udfald i ${table}`)
}

export function assertLogs(rows, expected) {
  const actual = rows.filter(r => r.athlete_id === ATHLETE_ID)
    .map(r => [r.exercise_id, r.set_number, r.weight, r.reps_completed, r.skipped])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  assert.deepEqual(actual, [...expected].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    'Præcise sæt, vægt, reps og skipstatus uden dubletter eller fremtidige sæt')
}

async function login(page, appUrl, user) {
  assertLocalUrl(appUrl)
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind', exact: true }).click()
}
const visible = locator => locator.waitFor({ state: 'visible', timeout: 15000 })

export async function runReleaseAthlete(page, { appUrl, mockUrl, read = name => readMockTable(mockUrl, name) }) {
  assertLocalUrl(mockUrl)
  await login(page, appUrl, ATHLETE_USER)
  await visible(page.getByLabel('Vægt, sæt 1', { exact: true }))
  await page.getByLabel('Vægt, sæt 1', { exact: true }).fill('82,5')
  await page.getByLabel('Reps, sæt 1', { exact: true }).fill('5')
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  const first = [EXERCISE_ID, 1, 82.5, 5, false]
  await waitRows(read, 'exercise_logs', rows => rows.some(r => r.exercise_id === EXERCISE_ID && r.set_number === 1))
  assertLogs(await read('exercise_logs'), [first])
  await visible(page.getByLabel('Vægt, sæt 2', { exact: true }))
  // Den eksisterende setTapGuard kræver 500 ms mellem skrivetryk.
  await page.waitForTimeout(600)
  await page.getByLabel('Vægt, sæt 2', { exact: true }).fill('85')
  await page.getByLabel('Reps, sæt 2', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await waitRows(read, 'exercise_logs', rows => rows.some(r => r.exercise_id === EXERCISE_ID && r.set_number === 2))
  assertLogs(await read('exercise_logs'), [first, [EXERCISE_ID, 2, 85, 4, false]])
  await page.getByRole('button', { name: /Fortryd sidste sæt/ }).click()
  await waitRows(read, 'exercise_logs', rows => !rows.some(r => r.exercise_id === EXERCISE_ID && r.set_number === 2))
  await page.reload()
  await visible(page.getByLabel('Vægt, sæt 2', { exact: true }))
  assertLogs(await read('exercise_logs'), [first])

  await page.getByRole('button', { name: /Hele passet/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Dagens pas', exact: true })
  await visible(dialog)
  assert.equal(await dialog.getByRole('progressbar', { name: 'Afsluttede sæt' }).getAttribute('aria-valuenow'), '17')
  await visible(dialog.getByText('1 af 6 sæt', { exact: true }))
  await visible(dialog.getByText('Squat', { exact: true }))
  await visible(dialog.getByText('Bænkpres', { exact: true }))
  await dialog.getByRole('button', { name: 'Luk overblik', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assertLogs(await read('exercise_logs'), [first])
  assert.equal(await page.getByLabel('Vægt, sæt 2', { exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Spring over', exact: true }).click()
  await waitRows(read, 'exercise_logs', rows => rows.some(r => r.exercise_id === EXERCISE_ID && r.set_number === 2 && r.skipped))
  const expected = [first, [EXERCISE_ID, 2, 0, 0, true]]
  assertLogs(await read('exercise_logs'), expected)
  await page.reload()
  await visible(page.getByLabel('Vægt, sæt 3', { exact: true }))
  assertLogs(await read('exercise_logs'), expected)
  await page.getByRole('button', { name: /Hele passet/i }).click()
  await visible(dialog)
  await visible(dialog.getByText('2 af 6 sæt', { exact: true }))
  assert.equal(await dialog.locator('[data-status="Sprunget over"]').count(), 1)
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
}

export async function runReleaseWeek(page, { appUrl, mockUrl, c, read = name => readMockTable(mockUrl, name) }) {
  assertLocalUrl(mockUrl)
  await login(page, appUrl, ATHLETE_USER)
  await page.getByRole('button', { name: 'Program', exact: true }).click()
  const previous = page.getByRole('button', { name: '← Forrige uge', exact: true })
  await visible(previous)
  assert.equal(await previous.isDisabled(), true, `${c.name}: søndag tilhører uge 1`)
  await visible(page.getByText(/Du er her · uge 1/))
  const before = await read('exercise_logs')
  await page.getByRole('button', { name: 'Næste uge →', exact: true }).click()
  await visible(page.getByText('Næste testuge', { exact: true }).first())
  await visible(page.getByText(/Planlagt · uge 2/))
  const rangePattern = c.range.replaceAll('.', '\\.').replaceAll(' ', '\\s*')
  await visible(page.getByText(new RegExp(`^Uge 2\\s*·\\s*${rangePattern}\\s*·\\s*planlagt$`)))
  assert.equal(await page.getByRole('button', { name: 'Næste uge →', exact: true }).isDisabled(), true)
  assert.equal(await previous.isDisabled(), false)
  await previous.click()
  await visible(page.getByText(/Du er her · uge 1/))
  assert.deepEqual(await read('exercise_logs'), before, 'Ugevisning må ikke skrive sæt')
  const weeks = await read('weeks')
  assert.equal(weeks.find(w => w.id === WEEK_ID).start_date, c.monday)
  assert.equal(weeks.find(w => w.id === NEXT_WEEK_ID).start_date, c.next)
}

export async function runReleaseCoach(page, { appUrl, mockUrl, read = name => readMockTable(mockUrl, name) }) {
  assertLocalUrl(mockUrl)
  await login(page, appUrl, COACH_USER)
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()
  await page.getByRole('button', { name: /Log$/ }).click()
  await visible(page.getByText(/^1\/4 sæt/).first())
  await visible(page.getByText('82.5kg', { exact: true }).first())
  assertLogs(await read('exercise_logs'), [[EXERCISE_ID, 1, 82.5, 5, false], [EXERCISE_ID, 2, 0, 0, true]])
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Noter$/ }).click()
  await visible(page.getByText('Ingen noter endnu.', { exact: true }))
  await page.getByRole('button', { name: 'Rediger', exact: true }).click()
  await page.getByRole('textbox').fill(NOTE)
  await page.getByRole('button', { name: 'Gem', exact: true }).click()
  await waitRows(read, 'athletes', rows => rows.some(r => r.id === ATHLETE_ID && r.notes === NOTE))
  await visible(page.getByText(NOTE, { exact: true }))
  await page.reload()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Noter$/ }).click()
  await visible(page.getByText(NOTE, { exact: true }))
  assert.equal((await read('athletes')).filter(r => r.id === ATHLETE_ID && r.notes === NOTE).length, 1)
}
