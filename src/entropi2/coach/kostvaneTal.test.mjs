import test from 'node:test'
import assert from 'node:assert/strict'
import { kostvaneTal, coachNutritionLines } from './coachNutrition.mjs'

const day = '2026-11-09', from = '2026-11-03', coachId = 'synthetic-coach'
const athletes = ['a1', 'a2', 'a3', 'a4'].map(id => ({ id, name: 'Syntetisk ' + id }))
const meal = (athlete_id, date, n = 1) => ({ id: `${athlete_id}-${date}-${n}`, athlete_id, date, meal: 'Syntetisk måltid', kcal: 500, protein: 30 })
function props(rows, extra = {}) {
  const athleteIds = athletes.map(a => a.id)
  return { session: { user: { id: coachId } }, readContext: { coachId, day, athleteIds },
    coachNutrition: { coachId, day, athleteIds, state: 'ready', complete: true, from, through: day, rows, targets: [], ...extra } }
}

test('coachens tal: atleter med mindst 4 kostdage de seneste 7 dage; dagkvitteringer tæller ikke', () => {
  const rows = [
    ...['2026-11-03', '2026-11-04', '2026-11-06', '2026-11-09'].map(d => meal('a1', d)), meal('a1', '2026-11-09', 2),
    ...['2026-11-05', '2026-11-06'].map(d => meal('a2', d)),
    ...['2026-11-03', '2026-11-04', '2026-11-05'].map(d => meal('a3', d)),
    { ...meal('a3', '2026-11-07'), meal: '[appData2-day-v1][]', kcal: 0, protein: 0 },
  ]
  assert.deepEqual(kostvaneTal(props(rows), day, athletes, true), { aktive: 4, maal: 4, medMaal: 1, lidt: 2, ingen: 1 })
  // Samme grundlag som de eksisterende kostlinjer: kun a1 har en linje.
  assert.deepEqual([...coachNutritionLines(props(rows), day, athletes, true).keys()], ['a1'])
})

test('coachens tal: ingen tal ved en ufuldstændig, fremmed eller forkert dateret læsning', () => {
  assert.equal(kostvaneTal(props([], { state: 'partial' }), day, athletes, true), null)
  assert.equal(kostvaneTal(props([], { complete: false }), day, athletes, true), null)
  assert.equal(kostvaneTal(props([meal('fremmed', day)]), day, athletes, true), null)
  assert.equal(kostvaneTal(props([meal('a1', '2026-11-01')]), day, athletes, true), null)
  assert.equal(kostvaneTal(props([]), day, athletes, false), null)
  assert.deepEqual(kostvaneTal(props([]), day, athletes, true), { aktive: 4, maal: 4, medMaal: 0, lidt: 0, ingen: 4 })
})
