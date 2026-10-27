import assert from 'node:assert/strict'
import { buildSeed, ATHLETE_ID, ATHLETE_USER, COACH_USER, WEEK_ID, SESSION_ID, EXERCISE_ID } from './fixtures.mjs'

// Flowdefinitioner, ikke node:test-registrering eller automatisk opstart.
export const CASES = [
  { name: 'hverdag', now: '2026-10-27T11:00:00Z', day: '2026-10-27', monday: '2026-10-26', next: '2026-10-29', weekday: 3 },
  { name: 'vintertid', now: '2026-10-25T01:30:00Z', day: '2026-10-25', monday: '2026-10-19', next: '2026-10-26', weekday: 0 },
]
export const QUESTION = 'Syntetisk REL3: klar til naeste pas?'
export const REPLY = 'Hej Testatlet. Roligt tempo i naeste pas.'
export const TEMPLATE = 'Hej {atlet}. Roligt tempo i naeste pas.'
export const NEXT_WEEK = '44444444-4444-4444-8444-444444444445'
export const NEXT_SESSION = '55555555-5555-4555-8555-555555555556'

export function localUrl(value) {
  const url = new URL(value)
  assert.ok(url.protocol === 'http:' && !url.username && !url.password &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Kun lokal HTTP-app og mock')
  return url
}
export function releaseUrl(appUrl, enabled = true, coach = false) {
  const url = localUrl(appUrl)
  url.search = ''
  url.hash = ''
  if (enabled) url.searchParams.set('appRel3', '1')
  if (enabled && coach) url.searchParams.set('coachRyd', '1')
  return url.href
}
export function buildRelease3Seed(c, scenario) {
  assert.ok(CASES.includes(c), 'Brug en fast REL3-dato')
  assert.ok(['progress', 'meet', 'home', 'coach', 'templates', 'off'].includes(scenario))
  const seed = buildSeed()
  seed.tables.athletes[0].onboarding_completed_at = c.now
  seed.tables.athletes[0].notes = null
  seed.tables.weeks[0].start_date = c.monday
  seed.tables.sessions[0].weekday = 0
  seed.tables.sessions[0].title = 'REL3 Squat'
  if (scenario === 'home') {
    const sunday = c.name === 'vintertid'
    if (sunday) seed.tables.weeks.push({ ...seed.tables.weeks[0], id: NEXT_WEEK, week_number: 2, start_date: c.next })
    seed.tables.sessions = [{ ...seed.tables.sessions[0], id: NEXT_SESSION,
      week_id: sunday ? NEXT_WEEK : WEEK_ID, weekday: c.weekday, title: 'REL3 naeste pas' }]
    seed.tables.exercises[0].session_id = NEXT_SESSION
  }
  if (scenario === 'progress') seed.tables.exercise_logs = [{
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', athlete_id: ATHLETE_ID, exercise_id: EXERCISE_ID,
    set_number: 1, weight: 80, reps_completed: 5, skipped: false, logged_at: c.monday + 'T10:00:00Z',
  }]
  if (scenario === 'meet') {
    seed.tables.athletes[0].competition_date = c.day
    seed.tables.meet_plans = [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', athlete_id: ATHLETE_ID,
      meet_type: 'sbd', squat1: 100, bench1: 60, dead1: 120, notes: 'REL3 coachnote' }]
  }
  if (['coach', 'templates'].includes(scenario)) seed.tables.messages = [{
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', athlete_id: ATHLETE_ID, sender_role: 'athlete',
    category: 'besked', content: QUESTION, read_by_coach: false, read_by_athlete: true,
    created_at: c.day + 'T00:00:00Z',
  }]
  return seed
}
const visible = locator => locator.waitFor({ state: 'visible', timeout: 15000 })
const absent = async locator => assert.equal(await locator.count(), 0)
export async function snapshot(read) {
  return Object.fromEntries(await Promise.all(['athletes', 'weeks', 'sessions', 'exercises',
    'exercise_logs', 'messages', 'meet_plans'].map(async name => [name, structuredClone(await read(name))])))
}
async function login(page, opts, coach = false, enabled = true) {
  localUrl(opts.mockUrl)
  const user = coach ? COACH_USER : ATHLETE_USER
  await page.goto(releaseUrl(opts.appUrl, enabled, coach))
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind', exact: true }).click()
}
export async function runProgress(page, opts) {
  const before = await snapshot(opts.read)
  await login(page, opts)
  await page.getByRole('button', { name: 'Fremgang', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Dit fremgangsoverblik', exact: true })
  await visible(panel)
  await visible(panel.getByText('1 sæt gennemført i programuge 1.', { exact: true }))
  await visible(panel.getByText(/Første måling\. Flere træningsdage/))
  await absent(panel.getByRole('region', { name: 'Kropsvægt', exact: true }))
  await panel.getByLabel('Vis kropsvægt i overblikket', { exact: true }).check()
  await visible(panel.getByText('Ingen vejninger endnu.', { exact: true }))
  await panel.getByRole('button', { name: 'Se alle detaljer', exact: true }).click()
  await visible(panel.getByRole('region', { name: 'Alle fremgangsdetaljer', exact: true }))
  await panel.getByRole('button', { name: 'Skjul detaljer', exact: true }).click()
  await absent(panel.getByRole('region', { name: 'Alle fremgangsdetaljer', exact: true }))
  await page.reload()
  await page.getByRole('button', { name: 'Fremgang', exact: true }).click()
  await visible(panel)
  await absent(panel.getByRole('region', { name: 'Kropsvægt', exact: true }))
  assert.deepEqual(await snapshot(opts.read), before, 'Fremgang er laesning')
}
export async function runMeet(page, opts) {
  const before = await snapshot(opts.read)
  await login(page, opts)
  await page.getByRole('button', { name: 'Stævne', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Det vigtigste på stævnedagen', exact: true })
  await visible(panel)
  await visible(panel.getByRole('heading', { name: 'Stævnedag i dag', exact: true }))
  await visible(panel.getByText('Squat: 100 kg', { exact: true }))
  const plan = panel.getByRole('region', { name: 'Opvarmningsplan og tidspunkter', exact: true })
  const squat = plan.getByRole('group', { name: 'Squat: åbner 100 kg', exact: true })
  await squat.getByLabel('Forventet åbner, lokal tid', { exact: true }).fill('14:00')
  await squat.getByRole('button', { name: 'Rediger med coach', exact: true }).click()
  await squat.getByLabel('Vægt i kg, sæt 1', { exact: true }).fill('22.5')
  await squat.getByRole('button', { name: 'Brug i denne visning', exact: true }).click()
  await visible(squat.getByText(/22,?\.?5 kg/))
  await page.getByText('Forsøg, coachnoter og tidligere stævner', { exact: true }).click()
  await visible(page.getByText('REL3 coachnote', { exact: true }))
  await page.reload()
  await page.getByRole('button', { name: 'Stævne', exact: true }).click()
  await visible(panel)
  assert.equal(await squat.getByLabel('Forventet åbner, lokal tid', { exact: true }).inputValue(), '')
  await absent(squat.getByText(/22,?\.?5 kg/))
  assert.deepEqual(await snapshot(opts.read), before, 'Lokale forslag maa ikke aendre atlet eller plan')
}
export async function runHome(page, opts) {
  const before = await snapshot(opts.read)
  await login(page, opts)
  const panel = page.getByRole('region', { name: 'Næste træning', exact: true })
  await visible(panel)
  await visible(panel.getByRole('heading', { name: 'REL3 naeste pas', exact: true }))
  const [year, month, day] = opts.c.next.split('-')
  await visible(panel.getByText(new RegExp(`${Number(day)}\\.${Number(month)}\\.${year}`)))
  await visible(panel.getByText('Squat · 4 sæt', { exact: true }))
  await absent(page.getByLabel('Vægt, sæt 1', { exact: true }))
  await panel.getByRole('button', { name: 'Se Program', exact: true }).click()
  await visible(page.getByText(/Du er her · uge 1/))
  await page.reload()
  await visible(panel)
  assert.deepEqual(await snapshot(opts.read), before, 'Hviledag opretter ingen saet')
}
export async function runCoach(page, opts) {
  const before = await snapshot(opts.read)
  await login(page, opts, true)
  await visible(page.getByRole('region', { name: 'Hvem skal jeg hjælpe i dag', exact: true }))
  // Den pinnede sidebar har tekstnavigation, ikke role=button.
  await page.getByText('Arbejdsindbakke', { exact: true }).first().click()
  // Samtalelisten er foldet paa baade mobil og desktop med coachRyd.
  const conversations = page.locator('details').filter({ hasText: 'Vis alle samtaler' })
  await conversations.getByText('Vis alle samtaler', { exact: true }).click()
  await conversations.getByRole('button').filter({ hasText: QUESTION }).click()
  const actions = page.getByRole('navigation', { name: 'Plan, log og svar', exact: true })
  await visible(actions)
  for (const name of ['Plan', 'Log', 'Svar']) {
    await actions.getByRole('button', { name, exact: true }).click()
    assert.equal(await actions.getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), 'true')
  }
  await visible(page.getByText(QUESTION, { exact: true }))
  await page.reload()
  await visible(page.getByText('Arbejdsindbakke', { exact: true }).first())
  const after = await snapshot(opts.read)
  for (const name of Object.keys(before).filter(name => name !== 'messages')) assert.deepEqual(after[name], before[name])
  assert.equal(after.messages.length, 1)
  assert.equal(after.messages[0].content, QUESTION)
  assert.equal(after.messages[0].read_by_coach, true)
}
export async function waitReply(read, before) {
  for (let n = 0; n < 100; n++) {
    const rows = await read('messages')
    if (rows.length > before.length) {
      const added = rows.filter(row => !before.some(old => old.id === row.id))
      assert.equal(added.length, 1, 'Præcis en afsendelse')
      assert.equal(added[0].athlete_id, ATHLETE_ID)
      assert.equal(added[0].sender_role, 'coach')
      assert.equal(added[0].category, 'besked')
      assert.equal(added[0].content, REPLY)
      return rows
    }
    if (n < 99) await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.fail('Ingen skabelonbesked i mocken')
}
export async function runTemplates(page, opts) {
  const before = await snapshot(opts.read)
  await login(page, opts, true)
  const list = page.getByRole('region', { name: 'Hvem skal jeg hjælpe i dag', exact: true })
  await list.getByRole('button', { name: 'Skabelonbesked til Testatlet', exact: true }).click()
  const panel = list.getByRole('region', { name: 'Skabelonbesked til Testatlet', exact: true })
  await panel.getByText('Gem en ny tekstskabelon', { exact: true }).click()
  await panel.getByLabel('Skabelonnavn', { exact: true }).fill('REL3 tempo')
  await panel.getByLabel('Skabelontekst', { exact: true }).fill(TEMPLATE)
  await panel.getByRole('button', { name: 'Gem skabelon', exact: true }).click()
  await panel.getByRole('button', { name: 'Brug REL3 tempo', exact: true }).click()
  assert.equal(await panel.getByLabel('Beskedkladde', { exact: true }).inputValue(), REPLY)
  await panel.getByLabel('Beskedkladde', { exact: true }).fill('Kasseret lokal kladde')
  await panel.getByRole('button', { name: 'Kasser kladde', exact: true }).click()
  assert.deepEqual(await snapshot(opts.read), before, 'Gem og kasser er lokale')
  await page.reload()
  await list.getByRole('button', { name: 'Skabelonbesked til Testatlet', exact: true }).click()
  await panel.getByRole('button', { name: 'Brug REL3 tempo', exact: true }).click()
  assert.equal(await panel.getByLabel('Beskedkladde', { exact: true }).inputValue(), REPLY)
  await panel.getByRole('button', { name: 'Send', exact: true }).click()
  await waitReply(opts.read, before.messages)
  await visible(panel.getByText('Beskeden er sendt.', { exact: true }))
  await page.reload()
  await visible(list)
  assert.equal((await opts.read('messages')).length, before.messages.length + 1)
  const after = await snapshot(opts.read)
  for (const name of Object.keys(before).filter(name => name !== 'messages')) assert.deepEqual(after[name], before[name])
}
export async function runOff(page, opts) {
  await login(page, opts, false, false)
  await page.getByRole('button', { name: 'Fremgang', exact: true }).click()
  await visible(page.getByText('Fremgang', { exact: true }).first())
  await absent(page.getByRole('region', { name: 'Dit fremgangsoverblik', exact: true }))
}
export const FLOWS = [
  ['off', runOff, 390], ['progress', runProgress, 390], ['meet', runMeet, 390],
  ['home', runHome, 390], ['coach', runCoach, 1280], ['templates', runTemplates, 1280],
]
