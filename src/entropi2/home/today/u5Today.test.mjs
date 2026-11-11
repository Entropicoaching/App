import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_U5_TODAY, u5TodayEnabled } from './flag.mjs'
import { formatKg, stepKg, latestWeight, weightDone, readinessSuggestion, readinessDone, mealsModel,
  firstSetPrefill, todayItems } from './todayModel.mjs'

const A = 'atlet-syntetisk'
const today = '2026-11-10'

test('U5 1/4: en eksplicit værdi vinder over standardværdien', () => {
  assert.equal(u5TodayEnabled(undefined), DEFAULT_U5_TODAY)
  assert.equal(u5TodayEnabled(true), true)
  assert.equal(u5TodayEnabled(false), false)
  assert.equal(u5TodayEnabled('true'), false)
})

test('U5 1/4: vægt foreslås fra seneste række før i dag, med ±0,1 kg', () => {
  const logs = [{ athlete_id: A, logged_at: '2026-11-07', weight: 82.4 }, { athlete_id: A, logged_at: '2026-11-09', weight: '82,5' },
    { athlete_id: 'anden', logged_at: '2026-11-09', weight: 99 }, { athlete_id: A, logged_at: '2026-11-11', weight: 70 }]
  assert.equal(latestWeight(logs, A, today), 82.5)
  assert.equal(latestWeight([], A, today), null)
  assert.equal(formatKg(82.5), '82,5')
  assert.equal(formatKg(82), '82')
  assert.equal(stepKg(82.5, 0.1), 82.6)
  assert.equal(stepKg(82.5, -0.1), 82.4)
  assert.equal(stepKg(0.1, -0.1), null)
  assert.equal(weightDone(logs, A, today), false)
  assert.equal(weightDone([...logs, { athlete_id: A, logged_at: today, weight: 82 }], A, today), true)
})

test('U5 1/4: dagsform bruger seneste række de sidste 7 dage, aldrig søvn og aldrig over et udkast', () => {
  const rows = [{ athlete_id: A, logged_date: '2026-11-06', energy: 2, motivation: 3, stress: 2, soreness_level: 4, sleep_hours: 6 },
    { athlete_id: A, logged_date: '2026-11-08', energy: 4, motivation: 4, stress: 1, soreness_level: 2, sleep_hours: 8 }]
  const trackingData = { status: 'ready', complete: true, athleteId: A, today, readinessRows: rows }
  assert.deepEqual(readinessSuggestion({ athleteId: A, today, trackingData }),
    { from: '2026-11-08', motivation: '4', stress: '1', soreness: '2' })
  assert.equal(readinessSuggestion({ athleteId: A, today, trackingData, readinessInput: { energy: '3' } }), null)
  // Værtens forudfyldning fra seneste række (ordre 267) er ikke atletens udkast; en rettelse er.
  const prefill = { sleep: '8', energy: 4, motivation: 4, stress: 1, soreness: 2, soreZones: [] }
  assert.equal(readinessSuggestion({ athleteId: A, today, trackingData, readinessInput: prefill })?.motivation, '4')
  assert.equal(readinessSuggestion({ athleteId: A, today, trackingData, readinessInput: { ...prefill, energy: '2' } }), null)
  assert.equal(readinessSuggestion({ athleteId: A, today, trackingData: { ...trackingData, readinessRows: [{ ...rows[0], logged_date: '2026-11-01' }] } }), null)
  assert.equal(readinessSuggestion({ athleteId: A, today, trackingData: { status: 'loading' } }), null)
  const logged = { athlete_id: A, logged_date: today, energy: 3 }
  assert.equal(readinessDone({ readinessLog: logged, athleteId: A, today }), true)
  assert.equal(readinessSuggestion({ athleteId: A, today, trackingData, readinessLog: logged }), null)
})

test('U5 1/4: måltider i dag og i går, uden dagskvitteringer', () => {
  const rows = [{ athlete_id: A, date: '2026-11-09', meal: 'Havregrød', kcal: 400, protein: 20, carb: 60, fat: 8, id: 'x' },
    { athlete_id: A, date: '2026-11-09', meal: 'Kylling og ris', kcal: '650', protein: 45, carb: 70, fat: 15 },
    { athlete_id: 'anden', date: '2026-11-09', meal: 'Fremmed', kcal: 1, protein: 1, carb: 1, fat: 1 }]
  const m = mealsModel(rows, A, today)
  assert.equal(m.status, 'ready')
  assert.equal(m.today, 0)
  assert.deepEqual(m.yesterday.map(r => r.meal), ['Havregrød', 'Kylling og ris'])
  assert.equal('id' in m.yesterday[0], false)
  assert.equal(mealsModel([...rows, { athlete_id: A, date: today, meal: 'Skyr', kcal: 1, protein: 1, carb: 1, fat: 1 }], A, today).today, 1)
  assert.equal(mealsModel(null, A, today).status, 'error')
})

test('U5 1/4: første sæt uden coachvægt får sidste pas, coachvægt og udfyldte felter bevares', () => {
  const exercises = [{ id: 'e1', name: 'Squat', reps: '5', recommended_weight: null },
    { id: 'e2', name: 'Bænkpres', reps: '8-10', recommended_weight: '' },
    { id: 'e3', name: 'Dødløft', reps: '3', recommended_weight: 160 },
    { id: 'e4', name: 'Ro', reps: '10' }]
  const last = { squat: { weight: 140, reps_completed: 5 }, 'bænkpres': { weight: 90, reps_completed: 9 }, 'dødløft': { weight: 150, reps_completed: 3 },
    ro: { weight: 60, reps_completed: 10 } }
  assert.deepEqual(firstSetPrefill(exercises, last, { e4_1: { weight: '62,5' } }), {
    e1_1: { weight: '140', reps: '5' }, e2_1: { weight: '90', reps: '9' } })
  // u8c: sidste pas med decimal står med dansk komma i feltet.
  assert.deepEqual(firstSetPrefill([{ id: 'e5', name: 'Squat', reps: '5' }], { squat: { weight: 87.5, reps_completed: 5 } }),
    { e5_1: { weight: '87,5', reps: '5' } })
  assert.equal(firstSetPrefill([{ id: 'e6', name: 'Curl', reps: '5' }], { curl: { weight: '11.25', reps_completed: 5 } }).e6_1.weight, '11,25')
})

test('U5 1/4: overskriften siger hvad der mangler, i fast rækkefølge', () => {
  const all = todayItems({ weight: { done: false }, readiness: { done: true }, training: { kind: 'today', logged: 0, total: 12 },
    meal: { status: 'ready', today: 0 } })
  assert.deepEqual(all.missing, ['weight', 'training', 'meal'])
  assert.equal(all.headline, 'Mangler i dag: vægt, træning og mad')
  assert.equal(all.doneLine, 'Klaret: dagsform')
  const none = todayItems({ weight: { done: true }, readiness: { done: true }, training: { kind: 'next' }, meal: { status: 'ready', today: 2 } })
  assert.equal(none.headline, 'Alt er logget i dag')
  assert.deepEqual(none.items.map(i => i.key), ['weight', 'readiness', 'meal'])
  assert.equal(todayItems({ meal: { status: 'error' } }).headline, null)
})
