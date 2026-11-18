// Ordre 1683: coachens readiness-læsning tager atletens seneste dagstjek med (kun læst), så
// Parathed i dag kan vise dagens smerte. Fejl i dagstjekket ændrer intet ved readiness-rækkerne.
import test from 'node:test'
import assert from 'node:assert/strict'
import { installCoachTabsFixture, service } from './coachTabsFixture.mjs'
installCoachTabsFixture()
const { lavLaesninger } = await import('./laesninger.js')
const noop = () => {}
function fixture() {
  service.responses.length = 0; service.calls.length = 0
  const values = {}
  const reader = lavLaesninger({ setAthleteReadiness: update => { values.r = typeof update === 'function' ? update(values.r) : update },
    coachTabCleanup: true, currentProgramAthleteRef: { current: 'synthetic-a' }, entropi2CalendarRead: noop })
  return { reader, values }
}
const readinessRow = { athlete_id: 'synthetic-a', logged_date: '2026-11-18', soreness_level: 3, readiness_score: 58 }

test('dagens dagstjek følger med readiness-rækkerne, og rækkerne er uændrede', async () => {
  const f = fixture()
  const day = { athlete_id: 'synthetic-a', logged_date: '2026-11-18', pain: 6, pain_location: 'venstre knæ' }
  service.responses.push({ data: [readinessRow], error: null }, { data: [day], error: null })
  await f.reader.fetchAthleteReadiness('synthetic-a')
  assert.equal(f.values.r.coachRead.state, 'ready')
  assert.deepEqual([...f.values.r], [readinessRow])
  assert.deepEqual(f.values.r.dayPain, day)
  const daily = service.calls.find(call => call.table === 'tracking_daily_v1')
  assert.ok(daily.steps.some(step => step[0] === 'eq' && step[1] === 'athlete_id' && step[2] === 'synthetic-a'))
  assert.ok(!daily.steps.some(step => ['insert', 'update', 'upsert', 'delete'].includes(step[0])))
})

test('fejl, manglende tabel eller anden atlet i dagstjekket giver ingen dagssmerte', async () => {
  for (const reply of [{ data: null, error: { code: '42P01' } }, new Error('netværk'), { data: [{ athlete_id: 'synthetic-b', logged_date: '2026-11-18', pain: 6 }], error: null }]) {
    const f = fixture()
    service.responses.push({ data: [readinessRow], error: null }, reply)
    await f.reader.fetchAthleteReadiness('synthetic-a')
    assert.equal(f.values.r.coachRead.state, 'ready')
    assert.deepEqual([...f.values.r], [readinessRow])
    assert.equal(f.values.r.dayPain, undefined)
  }
})
