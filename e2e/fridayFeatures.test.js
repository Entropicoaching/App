import assert from 'node:assert/strict'
import { buildSeed, ATHLETE_ID, ATHLETE_USER, COACH_USER, WEEK_ID, SESSION_ID } from './fixtures.mjs'
import { CASES, buildReleaseSeed, assertLocalUrl, readMockTable, waitRows, runReleaseWeek } from './releaseChecklist.test.js'

// Import er passiv. Runneren kraever --run-e2e. Kun eksisterende mock.
export const MESSAGE_ONE = 'Syntetisk fredag: foerste besked'
export const MESSAGE_TWO = 'Syntetisk fredag: teknikspoergsmaal'
export const COPY_TITLE = 'Fredagens kopierede pas'
export const COPY_NOTE = 'Syntetisk fredag: rolig progression'
export const FRIDAY_CASES = CASES

export function featureUrl(appUrl, enabled = true, extra = {}) {
  const url = assertLocalUrl(appUrl)
  url.search = ''
  if (enabled) {
    url.searchParams.set('appE2E2', '1')
    url.searchParams.set('analyseSamlet', '1')
  }
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value)
  return url.href
}

export function buildFridaySeed(c, scenario) {
  assert.ok(['mobility', 'analysis', 'copy', 'inbox', 'week', 'off'].includes(scenario))
  const seed = buildReleaseSeed(c)
  if (scenario === 'copy') {
    seed.tables.weeks = seed.tables.weeks.filter(row => row.id === WEEK_ID)
    seed.tables.sessions = seed.tables.sessions.filter(row => row.id === SESSION_ID)
    const sessionIds = new Set(seed.tables.sessions.map(row => row.id))
    seed.tables.exercises = seed.tables.exercises.filter(row => sessionIds.has(row.session_id))
  }
  if (scenario === 'inbox') {
    seed.tables.messages = [
      { id: 'f1000000-0000-4000-8000-000000000001', category: 'besked', content: MESSAGE_ONE, created_at: c.monday + 'T08:00:00Z' },
      { id: 'f1000000-0000-4000-8000-000000000002', category: 'teknik', content: MESSAGE_TWO, created_at: c.monday + 'T09:00:00Z' },
    ].map(row => ({ ...row, athlete_id: ATHLETE_ID, sender_role: 'athlete', read_by_coach: false, read_by_athlete: true }))
  }
  // buildSeed bruges af den pinnede mock; ingen ekstra RPC eller skema.
  assert.equal(seed.users.length, buildSeed().users.length)
  return seed
}

const visible = locator => locator.waitFor({ state: 'visible', timeout: 15000 })
async function login(page, url, user) {
  assertLocalUrl(url)
  await page.goto(url)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind', exact: true }).click()
}
async function profile(page) {
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()
}
const reader = opts => opts.read || (name => readMockTable(opts.mockUrl, name))
const programSnapshot = async read => Object.fromEntries(await Promise.all(
  ['weeks', 'sessions', 'exercises', 'exercise_logs', 'video_analyses'].map(async name => [name, await read(name)])))

export async function runFridayMobility(page, opts) {
  const read = reader(opts)
  const before = await programSnapshot(read)
  await login(page, featureUrl(opts.appUrl), ATHLETE_USER)
  await page.getByRole('button', { name: 'Åbn mobilitet', exact: true }).click()
  const focus = page.getByRole('region', { name: 'Mobilitet med fokus', exact: true })
  await visible(focus)
  await focus.getByRole('button', { name: 'Dødløft', exact: true }).click()
  await focus.getByRole('button', { name: 'Plads i sumostilling', exact: true }).click()
  assert.equal(await focus.getByRole('button', { name: 'Plads i sumostilling', exact: true }).getAttribute('aria-pressed'), 'true')
  await visible(focus.getByRole('heading', { name: '3 øvelser til dødløft', exact: true }))
  await focus.getByRole('button', { name: 'Start min rutine', exact: true }).click()
  await visible(focus.getByText('Dødløft · Plads i sumostilling · 1 af 3', { exact: true }))
  await focus.getByRole('button', { name: 'Næste øvelse', exact: true }).click()
  await visible(focus.getByText('Dødløft · Plads i sumostilling · 2 af 3', { exact: true }))
  await focus.getByRole('button', { name: 'Forrige øvelse', exact: true }).click()
  await visible(focus.getByText('Dødløft · Plads i sumostilling · 1 af 3', { exact: true }))
  await focus.getByRole('button', { name: 'Næste øvelse', exact: true }).click()
  await focus.getByRole('button', { name: 'Næste øvelse', exact: true }).click()
  await focus.getByRole('button', { name: 'Afslut rutinen', exact: true }).click()
  await visible(focus.getByRole('heading', { name: 'Klar til næste skridt', exact: true }))
  await focus.getByRole('button', { name: 'Vælg nyt fokus', exact: true }).click()
  await visible(focus.getByRole('button', { name: 'Start min rutine', exact: true }))
  await page.reload()
  await visible(page.getByRole('button', { name: 'Åbn mobilitet', exact: true }))
  assert.deepEqual(await programSnapshot(read), before, 'Mobilitet er lokal og skriver ikke program eller logs')
}

export async function runFridayAnalysis(page, opts) {
  const read = reader(opts)
  const before = await programSnapshot(read)
  await login(page, featureUrl(opts.appUrl), COACH_USER)
  await profile(page)
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Analyse$/ }).click()
  const panel = page.getByRole('region', { name: 'Samlet analyseprototype', exact: true })
  await visible(panel)
  for (const name of ['Videoanalyse', 'AI-rapport', 'Historik', 'Baseline', 'Målinger']) {
    await visible(panel.getByRole('region', { name, exact: true }))
  }
  await visible(panel.getByText('Syntetisk klip: demo-squat-2', { exact: true }))
  await visible(panel.getByText('Eksempelbaseline: 0,46 m/s. Kun samme løft og variation.', { exact: true }))
  await panel.getByRole('button', { name: '2026-10-16 · Squat · Godkendt', exact: true }).click()
  await visible(panel.getByText('Syntetisk klip: demo-squat-1', { exact: true }))
  await visible(panel.getByText('Utilstrækkeligt grundlag. Ingen sammenligning med baseline.', { exact: true }))
  await panel.getByLabel('Løft', { exact: true }).selectOption('bench')
  await visible(panel.getByText('Syntetisk klip: demo-bench-1', { exact: true }))
  await visible(panel.getByText('Ikke målt', { exact: true }))
  await panel.getByLabel('Løft', { exact: true }).selectOption('deadlift')
  await visible(panel.getByText('Ingen analyser for dette løft.', { exact: true }))
  assert.equal(await panel.getByRole('button').count(), 0, 'Tom historik har ingen gammel markering')
  await panel.getByLabel('Løft', { exact: true }).selectOption('squat')
  await visible(panel.getByText('Syntetisk klip: demo-squat-2', { exact: true }))
  assert.deepEqual(await programSnapshot(read), before, 'Prototype skriver ikke data')
}

export async function runFridayCopy(page, opts) {
  const read = reader(opts)
  await login(page, featureUrl(opts.appUrl), COACH_USER)
  await profile(page)
  await page.getByRole('button', { name: /Program$/ }).click()
  const panel = page.getByRole('region', { name: 'Kopiér til næste uge', exact: true })
  await visible(panel)
  const before = await programSnapshot(read)
  await panel.getByRole('button', { name: 'Kopiér til næste uge', exact: true }).click()
  await visible(panel.getByText(/Intet er sendt/))
  assert.equal(await panel.getByLabel('Startdato', { exact: true }).inputValue(), opts.c.next)
  await panel.getByLabel('Navn på pas', { exact: true }).fill(COPY_TITLE)
  await panel.getByLabel('Note til ugen', { exact: true }).fill(COPY_NOTE)
  assert.deepEqual(await programSnapshot(read), before, 'Redigering af kladde skriver intet')
  await panel.getByRole('button', { name: 'Annuller kladde', exact: true }).click()
  assert.deepEqual(await programSnapshot(read), before, 'Annullering skriver intet')
  await panel.getByRole('button', { name: 'Kopiér til næste uge', exact: true }).click()
  assert.notEqual(await panel.getByLabel('Navn på pas', { exact: true }).inputValue(), COPY_TITLE)
  // Konfliktvalidering foer den ene eksplicitte afsendelse.
  await panel.getByLabel('Ugenummer', { exact: true }).fill('1')
  assert.equal(await panel.getByRole('button', { name: 'Send til atleten', exact: true }).isDisabled(), true)
  await panel.getByLabel('Ugenummer', { exact: true }).fill('2')
  await panel.getByLabel('Navn på pas', { exact: true }).fill(COPY_TITLE)
  await panel.getByLabel('Note til ugen', { exact: true }).fill(COPY_NOTE)
  await panel.getByLabel('Vægt', { exact: true }).first().fill('82,5')
  await panel.getByRole('button', { name: 'Send til atleten', exact: true }).click()
  await waitRows(read, 'weeks', rows => rows.length === before.weeks.length + 1)
  await visible(page.getByText('Ugen er sendt til atleten', { exact: true }))
  const after = await programSnapshot(read)
  const added = after.weeks.filter(row => !before.weeks.some(old => old.id === row.id))
  assert.equal(added.length, 1)
  assert.equal(added[0].athlete_id, ATHLETE_ID)
  assert.equal(added[0].start_date, opts.c.next)
  assert.equal(added[0].week_number, 2)
  assert.equal(added[0].coach_note, COPY_NOTE)
  const sessions = after.sessions.filter(row => row.week_id === added[0].id)
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].title, COPY_TITLE)
  const exercises = after.exercises.filter(row => row.session_id === sessions[0].id)
  assert.equal(exercises.length, before.exercises.length)
  assert.equal(exercises[0].recommended_weight, 82.5)
  for (const name of ['weeks', 'sessions', 'exercises']) {
    for (const old of before[name]) assert.deepEqual(after[name].find(row => row.id === old.id), old, 'Kilden er bevaret')
  }
  assert.deepEqual(after.exercise_logs, before.exercise_logs)
  await page.reload()
  await profile(page)
  await page.getByRole('button', { name: /Program$/ }).click()
  await page.getByRole('button', { name: 'Gå til uge 2', exact: true }).click()
  await visible(page.getByText(COPY_TITLE, { exact: true }))
  assert.equal((await read('weeks')).length, after.weeks.length, 'Genindlaesning dublerer ikke')
}

export async function runFridayInbox(page, opts) {
  const read = reader(opts)
  await login(page, featureUrl(opts.appUrl, true, { coach: 'inbox' }), COACH_USER)
  await visible(page.getByText('Vigtigst nu', { exact: true }))
  await visible(page.getByText('Næste opgave', { exact: true }))
  await visible(page.getByText('1 øvrige opgave', { exact: true }))
  await visible(page.getByText('Vis alle samtaler', { exact: true }))
  // Foerste opgave er den aeldste ubesvarede besked. Samtalelisten er lukket paa mobil.
  const first = page.getByRole('button').filter({ hasText: MESSAGE_ONE })
  await first.click()
  await visible(page.getByText(MESSAGE_ONE, { exact: true }))
  await waitRows(read, 'messages', rows => rows.find(row => row.content === MESSAGE_ONE)?.read_by_coach === true)
  assert.equal((await read('messages')).find(row => row.content === MESSAGE_TWO).read_by_coach, false)
  await page.getByRole('button', { name: /Tilbage til indbakke/ }).click()
  // APP-COACH4: laest er ikke besvaret. Opgaven bliver i dagslisten.
  await visible(page.getByText('1 øvrige opgave', { exact: true }))
  await page.getByRole('button').filter({ hasText: MESSAGE_ONE }).click()
  await page.getByPlaceholder('Skriv en besked...', { exact: true }).fill('Fredag: svar paa besked')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await waitRows(read, 'messages', rows => rows.some(row => row.sender_role === 'coach' && row.category === 'besked'))
  await page.getByRole('button', { name: /Tilbage til indbakke/ }).click()
  await visible(page.getByText('Næste opgave', { exact: true }))
  await page.getByRole('button').filter({ hasText: MESSAGE_TWO }).click()
  await visible(page.getByText(MESSAGE_TWO, { exact: true }))
  await waitRows(read, 'messages', rows => rows.filter(row => row.sender_role === 'athlete').every(row => row.read_by_coach === true))
  await page.getByPlaceholder('Teknik-cue eller formsnak…', { exact: true }).fill('Fredag: svar paa teknik')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await waitRows(read, 'messages', rows => rows.some(row => row.sender_role === 'coach' && row.category === 'teknik'))
  await page.getByRole('button', { name: /Tilbage til indbakke/ }).click()
  await page.getByRole('button', { name: /Opdater$/ }).click()
  await visible(page.getByText('Coach Briefing er ryddet', { exact: true }))
  await page.reload()
  await visible(page.getByText('Coach Briefing er ryddet', { exact: true }))
  assert.equal((await read('messages')).length, 4)
}

export async function runFridayOff(page, opts) {
  await login(page, featureUrl(opts.appUrl, false), ATHLETE_USER)
  await visible(page.getByRole('button', { name: 'Program', exact: true }))
  assert.equal(await page.getByRole('button', { name: 'Åbn mobilitet', exact: true }).count(), 0)
}
export async function runFridayCoachOff(page, opts) {
  await login(page, featureUrl(opts.appUrl, false), COACH_USER)
  await profile(page)
  await page.getByRole('button', { name: /Program$/ }).click()
  await visible(page.getByRole('button', { name: /Kopiér seneste uge/ }))
  assert.equal(await page.getByRole('region', { name: 'Kopiér til næste uge', exact: true }).count(), 0)
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Analyse$/ }).click()
  await visible(page.getByRole('button', { name: 'AI Rapport', exact: true }))
  assert.equal(await page.getByRole('region', { name: 'Samlet analyseprototype', exact: true }).count(), 0)
}
export async function runFridayWeek(page, opts) {
  return runReleaseWeek(page, { ...opts, appUrl: featureUrl(opts.appUrl) })
}
