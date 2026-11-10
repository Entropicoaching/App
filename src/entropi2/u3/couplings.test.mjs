// U3 commit 2: koblingerne K1 og K2. Fejler på commit 1, fordi couplings.mjs mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays } from '../../calendarDate.js'
import { dayReceipt } from '../../mealEvidence.mjs'
import { k1EnergyWeight, k2ProteinReadiness, excludedDays, athleteCouplingSentence, k1Sentence, k2Sentence } from './couplings.mjs'

const today = '2026-11-10'
const kcalTarget = 3000, proteinTarget = 160
const meal = (date, kcal, protein) => ({ id: `m-${date}`, date, meal: 'Aftensmad', kcal, protein, carb: 300, fat: 90 })
const day = n => addCalendarDays(today, -n)

// Par: kostdag d (brugbar, 2000 kcal) og readiness d+1.
function k2Fixture(groups) {
  const meals = [], readiness = []
  for (const [d, hit, score] of groups) {
    meals.push(meal(day(d), 2000, hit ? 170 : 120))
    readiness.push({ logged_date: day(d - 1), readiness_score: score })
  }
  return { meals, readiness }
}
// Første halvdel: dag 27..15 før i dag; anden halvdel: dag 13..2.
const firstHalf = (hit, miss) => [[27, true, hit], [25, true, hit], [23, true, hit], [21, true, hit], [19, false, miss], [17, false, miss], [15, false, miss]]
const secondHalf = (hit, miss) => [[13, true, hit], [11, true, hit], [9, true, hit], [7, false, miss], [5, false, miss], [3, false, miss], [2, false, miss]]

test('K2 giver null med 11 par og med 12 par, når én gruppe kun har 5', () => {
  const eleven = k2Fixture([...firstHalf(80, 60), ...secondHalf(80, 60)].slice(0, 11))
  assert.equal(k2ProteinReadiness({ ...eleven, today, kcalTarget, proteinTarget }), null)
  const twelve = [[27, true, 80], [25, true, 80], [23, true, 80], [21, true, 80], [19, true, 80], [17, true, 80], [15, true, 80],
    [13, false, 60], [11, false, 60], [9, false, 60], [7, false, 60], [5, false, 60]]
  assert.equal(twelve.length, 12)
  assert.equal(k2ProteinReadiness({ ...k2Fixture(twelve), today, kcalTarget, proteinTarget }), null)
  const ok = k2ProteinReadiness({ ...k2Fixture([...firstHalf(80, 60), ...secondHalf(78, 70)]), today, kcalTarget, proteinTarget })
  assert.ok(ok && ok.difference >= 5)
  assert.equal(ok.pairs, 14)
})

test('K2 giver null uden genfund: +6 i første halvdel og -2 i anden', () => {
  // Samlet forskel over 5 point, men retningen findes ikke i begge halvdele.
  const data = k2Fixture([...firstHalf(80, 60), ...secondHalf(70, 72)])
  assert.equal(k2ProteinReadiness({ ...data, today, kcalTarget, proteinTarget }), null)
  const sixMinusTwo = k2Fixture([...firstHalf(76, 70), ...secondHalf(70, 72)])
  assert.equal(k2ProteinReadiness({ ...sixMinusTwo, today, kcalTarget, proteinTarget }), null)
})

test('K2 bruger kun brugbare kostdage (R5)', () => {
  const data = k2Fixture([...firstHalf(80, 60), ...secondHalf(78, 70)])
  data.meals = data.meals.map(m => ({ ...m, kcal: 1200 }))
  assert.equal(k2ProteinReadiness({ ...data, today, kcalTarget, proteinTarget }), null)
})

test('en deloaduge og en ferieuge udelades', () => {
  const now = new Date(`${today}T12:00:00Z`)
  const deload = { start_date: '2026-10-26', block_name: 'Deload', sessions: [] }
  const normal = { start_date: '2026-11-02', block_name: 'Styrke 2', sessions: [] }
  const athlete = { status: 'aktiv', vacation_until: '2026-10-14' }
  const excluded = excludedDays({ weeks: [deload, normal], logs: [], athlete, today, now })
  for (let i = 0; i < 7; i++) assert.ok(excluded.has(addCalendarDays('2026-10-26', i)), 'deloadugen')
  assert.ok(excluded.has('2026-10-14') && excluded.has('2026-10-13'), 'ferie til og med vacation_until')
  assert.ok(!excluded.has('2026-11-03') && !excluded.has('2026-10-15'))
  const data = k2Fixture([...firstHalf(80, 60), ...secondHalf(78, 70)])
  assert.ok(k2ProteinReadiness({ ...data, today, kcalTarget, proteinTarget }))
  // Med deloadugen og ferien udeladt er der for få par.
  assert.equal(k2ProteinReadiness({ ...data, today, kcalTarget, proteinTarget, excluded }), null)
  // En afsluttet uge med under 50 % gennemførte pas udelades også.
  const weak = { start_date: '2026-11-02', block_name: 'Styrke 2', sessions: [
    { id: 'a', exercises: [{ id: 'x1', sets: 1 }] }, { id: 'b', exercises: [{ id: 'x2', sets: 1 }] }, { id: 'c', exercises: [{ id: 'x3', sets: 1 }] }] }
  const weakExcluded = excludedDays({ weeks: [weak], logs: [{ exercise_id: 'x1', set_number: 1, logged_at: '2026-11-03T10:00:00Z' }], athlete: null, today, now })
  assert.ok(weakExcluded.has('2026-11-04'))
  const ferie = excludedDays({ weeks: [], logs: [], athlete: { status: 'ferie' }, today, now })
  assert.equal(ferie.size > 0, true)
})

function k1Fixture({ confirmed = true, days = 22 } = {}) {
  const meals = [], weights = []
  for (let i = 0; i < days; i++) {
    const date = addCalendarDays('2026-10-13', i)
    const rows = [meal(date, 2900, 165)]
    meals.push(...rows)
    if (confirmed) meals.push(dayReceipt(rows, date, today))
  }
  for (const [date, weight] of [['2026-10-13', 80], ['2026-10-14', 80], ['2026-10-15', 80], ['2026-11-01', 80.9], ['2026-11-02', 80.9], ['2026-11-03', 80.9]]) {
    weights.push({ logged_at: date, weight, created_at: `${date}T07:00:00Z` })
  }
  return { meals, weights }
}

test('K1 med 30 dage på 60 % af kcal-målet uden kvittering giver null', () => {
  const meals = Array.from({ length: 30 }, (_, i) => meal(addCalendarDays('2026-10-11', i), 1800, 120))
  const { weights } = k1Fixture()
  assert.equal(k1EnergyWeight({ meals, weights, today }), null)
})

test('K1 med 21 bekræftede dage og D48-vejninger giver et tal', () => {
  const k1 = k1EnergyWeight({ ...k1Fixture(), today })
  assert.ok(k1)
  assert.equal(k1.mealDays, 22)
  assert.equal(Math.round(k1.weeklyChangeKg * 10) / 10, 0.3)
  assert.ok(k1.maintenanceKcal < 2900)
  assert.equal(k1Sentence(k1), 'Din vægt stiger med 0,3 kg om ugen ved cirka 2.900 kcal om dagen.')
  assert.equal(k1EnergyWeight({ ...k1Fixture({ days: 20 }), today }), null)
})

test('højst én sætning, K1 vinder over K2, og teksten siger aldrig "fordi"', () => {
  const k1 = k1EnergyWeight({ ...k1Fixture(), today })
  const k2 = k2ProteinReadiness({ ...k2Fixture([...firstHalf(80, 60), ...secondHalf(78, 70)]), today, kcalTarget, proteinTarget })
  assert.equal(athleteCouplingSentence({ k1, k2 }), k1Sentence(k1))
  assert.equal(athleteCouplingSentence({ k1: null, k2 }), k2Sentence(k2))
  assert.equal(athleteCouplingSentence({}), null)
  assert.equal(k2Sentence({ ...k2, difference: -7 }), null)
  assert.match(k2Sentence(k2), /^De dage, du ramte protein, var din readiness næste dag i snit \d+ point højere\. Det er en sammenhæng, ikke et bevis\.$/)
  for (const text of [k1Sentence(k1), k2Sentence(k2), k1Sentence({ ...k1, weeklyChangeKg: -0.4 }), k1Sentence({ ...k1, weeklyChangeKg: 0.01 })]) {
    assert.doesNotMatch(text, /fordi/i)
  }
})
