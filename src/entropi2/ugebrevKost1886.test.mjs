// Ordre 1886: coachens ugebrev i Samtale får kosten mod den godkendte kostplan.
// Faktisk indgang (createEntryFactory), læser, planAdapter, rapport og ugebrev; kun
// klienten og React er syntetiske. Syntetisk atlet, ingen rigtige data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { historyFixture, athleteId, coachId } from './kostplan/dailyReference.fixture.mjs'
import { readWeeklyLetter } from './coach/ugebrev/readWeeklyLetter.mjs'
import { readLetterNutrition } from './coach/ugebrev/readLetterNutrition.mjs'
import { coachNutritionLines } from './coach/coachNutrition.mjs'
import { weeklyReportModel } from './analysis/ugerapport/weeklyReportModel.mjs'
import { createPlanAdapter } from './kostplan/planAdapter.mjs'
import { calendarDay, addCalendarDays } from '../calendarDate.js'

const entryURL = new URL('./conversation/ConversationEntry.mjs', import.meta.url).href
const react = 'data:text/javascript,' + encodeURIComponent(`
  export const createElement = () => { throw Error('Unexpected React render') }
  export const useEffect = createElement, useRef = createElement,
    useMemo = createElement, useState = createElement
`)
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && [entryURL, new URL('./conversation/Conversation.mjs', import.meta.url).href].includes(context.parentURL))
    return { url: react, shortCircuit: true }
  return next(specifier, context)
} })
const { createEntryFactory } = await import('./conversation/ConversationEntry.mjs')
test.after(() => hooks.deregister())

// Søndag; ugen er mandag 2.–søndag 8. nov., så ugerapportens uge og ugebrevets 7 dage er de samme.
const asOf = '2026-11-08', now = () => new Date('2026-11-08T12:00:00Z')
// Indgangen bruger det rigtige ur, så dens prøver regner fra i dag (planen er godkendt 1. nov.).
const today = calendarDay(new Date())
const daysBefore = day => Array.from({ length: 6 }, (_, i) => addCalendarDays(day, i - 6))
const mealDays = daysBefore(asOf), todayMeals = daysBefore(today)
const meal = (date, kcal = 100, protein = 10) => ({ id: `m-${date}`, athlete_id: athleteId, date,
  meal: 'Syntetisk maaltid', kcal, protein, carb: 0, fat: 0 })
const source = (rows = todayMeals.map(day => meal(day)), day = today) => ({ coachId, day, athleteIds: [athleteId],
  from: addCalendarDays(day, -6), through: day, state: 'ready', complete: true, rows, targets: [] })
const seeded = (kcal = 100, protein = 10) => {
  const f = historyFixture(); f.plan(1, '2026-11-01'); f.version(10, undefined, '2026-11-01', 1, kcal, protein); f.approve(); return f
}
function database(kostplan, days = todayMeals) {
  const sleep = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, athlete_id: athleteId,
    logged_date: days[i], sleep_hours: 7 }))
  const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(method => [method, () => query]))
  query.range = async () => ({ data: sleep })
  return { from: table => table === 'readiness_logs' ? query : kostplan.from(table) }
}
function coachEntry(options) {
  const { client } = options, coachNutrition = 'coachNutrition' in options ? options.coachNutrition : source()
  return createEntryFactory({ enabled: true, role: 'coach', openFeedback: () => {}, getEntry: () => ({
    enabled: true, session: { user: { id: coachId } }, selectedAthlete: { id: athleteId },
    athletes: [{ id: athleteId, user_id: 'synthetic-athlete-user' }], hiddenAthleteIds: new Set(),
    inboxDatabase: client, storage: () => null, coachNutrition,
    openVideoAnalysisReview: () => {}, openAwaitingAnalysisVideo: () => {},
  }) })()
}
const letterFor = async options => {
  const controller = coachEntry(options)
  controller.snapshot = () => ({ available: true })
  return controller.weeklyLetter()
}

test('Samtale: ugebrevet med godkendt kostplan har kostafsnittet mod planen', async () => {
  const m = await letterFor({ client: database(seeded().client) })
  assert.equal(m.state, 'ready')
  const kost = m.context.find(c => c.id === 'nutrition')
  assert.ok(kost, 'kostafsnittet mangler i ugebrevet')
  assert.equal(kost.sampleCount, 6)
  assert.match(m.text, /Du har logget måltider på 6\/7 dage/)
  assert.match(m.text, /600 kcal mod 600 kcal i daterede planmål/)
  assert.equal(m.nutritionUnavailable, undefined)
})

test('uden godkendt plan er ugebrevet som før: ingen kost og ingen fejl', async () => {
  const m = await letterFor({ client: database(historyFixture().client) })
  assert.equal(m.state, 'ready'); assert.equal(m.context.some(c => c.id === 'nutrition'), false)
  assert.equal(m.nutritionUnavailable, undefined)
  const f = seeded(); f.data.kostplan_v1_approvals.length = 0; f.data.kostplan_v1_plans[0].status = 'arkiveret'
  const archived = await letterFor({ client: database(f.client) })
  assert.equal(archived.context.some(c => c.id === 'nutrition'), false)
})

test('fejlet kostlæsning: brevet åbnes stadig med søvn og siger, at kosten ikke kunne hentes', async () => {
  for (const options of [
    { client: database(historyFixture({ error: 'XX000' }).client) },
    { client: database(seeded().client), coachNutrition: { ...source(), state: 'error', complete: false } },
    { client: database(seeded().client), coachNutrition: undefined },
  ]) {
    const m = await letterFor(options)
    assert.equal(m.state, 'ready'); assert.equal(m.nutritionUnavailable, true)
    assert.match(m.text, /søvn/); assert.doesNotMatch(m.text, /kcal/)
  }
})

test('ubrugelig kostkvittering kaster ikke hele brevet væk', async () => {
  let scope = { role: 'coach', ownerId: coachId, athleteId }
  const m = await readWeeklyLetter({ enabled: true, getScope: () => scope, now,
    database: database(seeded().client, mealDays), getNutritionRead: async () => ({ state: 'error' }) })
  assert.equal(m.state, 'ready'); assert.equal(m.nutritionUnavailable, true); assert.doesNotMatch(m.text, /kcal/)
})

test('samme uge: ugebrev, coachens kostlinje og ugerapporten regner de samme dage og mål', async () => {
  // Hver dag spises præcis planens mål, 6 dage før i dag.
  const f = seeded(2000, 150)
  const rows = mealDays.map(day => meal(day, 2000, 150))
  const receipt = await readLetterNutrition({ coachId, athleteId, asOf, source: source(rows, asOf), client: f.client })
  const letter = await readWeeklyLetter({ enabled: true, now, database: database(f.client, mealDays),
    getScope: () => ({ role: 'coach', ownerId: coachId, athleteId }), getNutritionRead: async () => receipt })
  const kost = letter.context.find(c => c.id === 'nutrition')
  // Coachens kostlinje får de samme godkendte dagsreferencer som planDays.
  const refs = await createPlanAdapter({ enabled: true, client: f.client, athleteId, date: asOf }).loadDailyReferences({ coachId })
  const plan = { from: '2026-10-25', through: '2026-11-07', athletes: [{ athlete_id: athleteId, days: refs.days }], meals: rows }
  const line = coachNutritionLines({ session: { user: { id: coachId } }, readContext: { coachId, day: asOf, athleteIds: [athleteId] },
    coachNutrition: { ...source(rows, asOf), plan } }, asOf, [{ id: athleteId }], true).get(athleteId)
  const report = weeklyReportModel({ athlete: { id: athleteId }, historicalMealLogs: rows }, '2026-11-08T12:00:00Z')
  assert.equal(report.start, '2026-11-02'); assert.equal(report.mealDays, 6)
  assert.equal(line.mod, 'plan'); assert.equal(line.days, 6); assert.equal(line.hit, 6)
  assert.equal(kost.sampleCount, 6)
  assert.equal(kost.sampleCount, report.mealDays); assert.equal(kost.sampleCount, line.days)
  const kcal = kost.metrics.find(m => m.key === 'kcal'), protein = kost.metrics.find(m => m.key === 'protein')
  assert.equal(kcal.target, 6 * 2000); assert.equal(kcal.actual, 6 * 2000); assert.equal(kcal.percent, 100)
  assert.equal(protein.target, 6 * 150); assert.equal(protein.percent, 100)
})
