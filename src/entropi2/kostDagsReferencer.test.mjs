// Ordre 1380: coachens justeringsforslag og ugebrevet bruger de gemte dagsreferencer.
// Faktisk planAdapter, forbindelse og ugebrev; kun klienten og React er syntetiske.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { setImmediate } from 'node:timers'
import { historyFixture, athleteId, coachId, date, uuid } from './kostplan/dailyReference.fixture.mjs'
import { portalNutritionReport } from './kostplan/coach/connections.mjs'
import { createPlanAdapter } from './kostplan/planAdapter.mjs'
import { createWeeklyLetter } from './coach/ugebrev/weeklyLetterModel.mjs'
import { emptyFixture } from './coach/ugebrev/letterFixture.mjs'
import { activePlan, meal, coach, athleteId as oldAthlete, input } from './kostplan/rapport/reportFixture.mjs'

const root = new URL('./', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./kostplan/coach/portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { startKostDagsReferencer, kostMaalKvitteringMedDage } = await import('./kostMaalKobling.mjs')
hooks.deregister()

const flush = () => new Promise(resolve => setImmediate(resolve))
const log = (on, values = {}) => ({ id: on, athlete_id: athleteId, date: on, meal: 'Syntetisk maaltid', kcal: 500, protein: 40, carb: 50, fat: 15, ...values })
const seeded = () => { const f = historyFixture(); f.plan(); f.version(); f.approve(); return f }
const base = () => ({ coachId, athleteId, date, state: 'ready', complete: true, planHistory: 'unavailable',
  mealLogs: [log('2026-11-05'), log('2026-11-06')], weightLogs: [] })
const start = async (client, patch = {}) => {
  const out = []
  const stop = startKostDagsReferencer({ coachId, athleteId, date, client, ...patch }, value => out.push(value))
  await flush(); await flush()
  return { out, stop }
}

test('dagsreferencer hentes og giver et justeringsgrundlag med dateret plan', async () => {
  const { out } = await start(seeded().client)
  assert.equal(out.length, 1); assert.equal(out[0].state, 'ready')
  const receipt = kostMaalKvitteringMedDage(base(), out[0])
  assert.equal(receipt.planHistory, 'daily'); assert.equal(receipt.dailyReferences, out[0].refs)
  const result = portalNutritionReport({ enabled: true, coachId, athleteId, date, receipt })
  assert.equal(result.state, 'ready')
  assert.equal(result.report.week.loggedDays, 2); assert.ok(result.report.week.plannedDays > 0)
  assert.equal(result.report.days[4].targets.kcal, 100)
})

test('ingen raekker, laesefejl og annullering giver ingen referencer og beholder unavailable', async () => {
  const empty = await start(historyFixture().client)
  assert.equal(empty.out[0].state, 'unavailable'); assert.equal(empty.out[0].refs, null)
  const kept = kostMaalKvitteringMedDage(base(), empty.out[0])
  assert.equal(kept.planHistory, 'unavailable'); assert.equal('dailyReferences' in kept, false)
  assert.equal(portalNutritionReport({ enabled: true, coachId, athleteId, date, receipt: kept }), null)
  const broken = await start({ from() { throw Error('syntetisk fejl') } })
  assert.equal(broken.out[0].state, 'unavailable')
  const chain = { select: () => chain, eq: () => chain, lte: () => chain, in: () => chain, limit: () => Promise.reject(Error('syntetisk')) }
  const rejecting = await start({ from: () => chain })
  assert.equal(rejecting.out[0].state, 'unavailable')
  const cancelled = []
  const stop = startKostDagsReferencer({ coachId, athleteId, date, client: seeded().client }, value => cancelled.push(value))
  stop(); await flush(); await flush()
  assert.deepEqual(cancelled, [])
  assert.equal(startKostDagsReferencer({ coachId, athleteId, date, client: null }, () => assert.fail('uden klient')), undefined)
})

test('referencer for en anden atlet, coach eller dag bruges aldrig', async () => {
  const { out } = await start(seeded().client)
  for (const patch of [{ athleteId: 'andre' }, { coachId: 'andre' }, { date: '2026-11-06' }])
    assert.deepEqual(kostMaalKvitteringMedDage({ ...base(), ...patch }, out[0]), { ...base(), ...patch })
  assert.equal(kostMaalKvitteringMedDage(undefined, out[0]), undefined)
  assert.deepEqual(kostMaalKvitteringMedDage(base(), null), base())
  assert.deepEqual(kostMaalKvitteringMedDage(base(), { ...out[0], state: 'loading' }), base())
})

test('den gamle receipt.plans-vej virker uaendret og dagsreferencer er ikke paakraevet', () => {
  const read = { ...input(), coachId: coach.id, state: 'ready', complete: true }
  const result = portalNutritionReport({ enabled: true, coachId: coach.id, athleteId: oldAthlete, date: '2026-11-08', receipt: read })
  assert.equal(result.state, 'ready'); assert.equal(result.report.week.loggedDays, 2)
  assert.equal(portalNutritionReport({ enabled: true, coachId: coach.id, athleteId: oldAthlete, date: '2026-11-08',
    receipt: { ...read, planHistory: 'unavailable', plans: undefined } }), null)
})

test('ugebrevets plan-sammenligning bruger dagsreferencer, naar de findes, og den gamle vej ellers', async () => {
  const data = { ...emptyFixture(), asOf: date, coachId }
  const f = historyFixture(); f.plan(1, '2026-11-01', 'godkendt', data.athleteId); f.version(); f.approve(10, uuid(1), '2026-11-01T10:00:00.000001Z', data.athleteId)
  const refs = await createPlanAdapter({ enabled: true, client: f.client, athleteId: data.athleteId, date }).loadDailyReferences({ coachId })
  const logs = ['2026-11-05', '2026-11-06'].map(on => ({ ...log(on), athlete_id: data.athleteId }))
  data.nutritionRead = { state: 'ready', complete: true, athleteId: data.athleteId, coachId, date,
    planHistory: 'daily', dailyReferences: refs, mealLogs: logs, weightLogs: [] }
  const c = createWeeklyLetter({ enabled: true, data }).context.find(x => x.id === 'nutrition')
  assert.equal(c.sampleCount, 2); assert.deepEqual(c.metrics.map(m => [m.key, m.actual, m.target]), [['kcal', 1000, 200], ['protein', 80, 20]])
  const without = { ...data, nutritionRead: { ...data.nutritionRead, planHistory: 'unavailable', dailyReferences: undefined } }
  const plain = createWeeklyLetter({ enabled: true, data: without }).context.find(x => x.id === 'nutrition')
  assert.equal(plain.metrics[0].target, null)
  const old = { ...data, asOf: '2026-11-04', nutritionRead: { state: 'ready', complete: true, athleteId: data.athleteId, coachId,
    date: '2026-11-04', plans: [activePlan()], weightLogs: [], mealLogs: [meal('2026-11-02', 's1'), meal('2026-11-04', 's2')] } }
  assert.equal(createWeeklyLetter({ enabled: true, data: old }).context.find(x => x.id === 'nutrition').metrics[0].target, 4000)
})
