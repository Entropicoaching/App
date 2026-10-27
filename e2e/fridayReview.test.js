import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './fridayHermeticLoader.mjs'
install()
const { syntheticFeaturePage } = await import('./fridaySyntheticPage.mjs')
const { runFridayMobility, runFridayAnalysis, buildFridaySeed, FRIDAY_CASES } = await import('./fridayFeatures.test.js')
const { fridayTestEnabled } = await import('../src/e2eTestFlags.mjs')
const { pendingCoachNotes } = await import('../src/coachNoteSignal.js')
const { sendCopyDraft, createCopyDraft } = await import('../src/dashboard/coachPlanCopy.mjs')
const { runFridaySuite } = await import('./fridayFeatures-run.mjs')

test('frisk DOM-modproeve: selve mobilitetsflowet rammer rigtig komponent', async () => {
  const library = { 'Dødløft — Sumo': [{ options: ['ds-mob-2', 'ds-mob-1', 'ds-mov-1'].map(id => ({ id, name: id, desc: 'Syntetisk', label: '5 reps' })) }] }
  const seed = buildFridaySeed(FRIDAY_CASES[0], 'mobility')
  await runFridayMobility(syntheticFeaturePage('mobility', library), { appUrl: 'http://localhost:5185', read: async name => structuredClone(seed.tables[name]) })
})

test('frisk DOM-modproeve: selve analyseflowet bruger rigtig renderer', async () => {
  const seed = buildFridaySeed(FRIDAY_CASES[0], 'analysis')
  await runFridayAnalysis(syntheticFeaturePage('analysis'), { appUrl: 'http://localhost:5185', read: async name => structuredClone(seed.tables[name]) })
})

test('modproeve: kodede og falske testflag aabner ikke produktionsmode', () => {
  for (const href of ['http://localhost/?appE2E2=%31', 'http://127.0.0.1/?appE2E2=1', 'http://[::1]/?appE2E2=1']) assert.equal(fridayTestEnabled('production', href), false)
  assert.equal(fridayTestEnabled('e2e', 'http://localhost/?appE2E2=1&%61ppE2E2=1'), false)
})

test('modproeve: svar paa anden atlet eller samme tidspunkt lukker ikke note', () => {
  const note = { id: 'n', athlete_id: 'a', category: 'teknik', sender_role: 'athlete', content: 'Syntetisk', created_at: '2026-10-25T10:00:00Z', read_by_coach: true }
  const reply = { ...note, id: 'r', sender_role: 'coach' }
  assert.equal(pendingCoachNotes([note, reply]).a.teknik.count, 1)
  assert.equal(pendingCoachNotes([note, { ...reply, athlete_id: 'b', created_at: '2026-10-26T10:00:00Z' }]).a.teknik.count, 1)
})

test('modproeve: ugyldigt kopimaal afvises foer databaseadgang', async () => {
  const draft = createCopyDraft({ id: 'w', athlete_id: 'a', week_number: 1, start_date: '2026-10-19', sessions: [{ title: 'Pas', weekday: 0, exercises: [] }] }, 'a')
  let calls = 0
  const db = { from() { calls++; throw new Error('Maa ikke kaldes') } }
  await assert.rejects(sendCopyDraft(db, { ...draft, start_date: '2026-02-30' }, [], 'a'), /startdato/)
  await assert.rejects(sendCopyDraft(db, { ...draft, sessions: [] }, [], 'a'), /mindst ét pas/)
  assert.equal(calls, 0)
})

test('modproeve: ekstern runtimeadresse afvises foer opstart', async () => {
  let started = false
  await assert.rejects(runFridaySuite({ APP_URL: 'https://example.invalid/', MOCK_PORT: 8991, startVite() { started = true } }))
  assert.equal(started, false)
})
