// ORDRE 439 · blok 2: "din uge" (dinUge.js). node --test src/athlete/dinUge.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dinUge, tonnageTekst, ugeBesked, erUgeLinjeSendt, markerUgeLinjeSendt } from './dinUge.js'

const week = {
  id: 'u4', week_number: 4, sessions: [
    { id: 's1', title: 'Dag 1', athlete_rating: null, exercises: [{ id: 'sq', name: 'Squat', sets: 2 }] },
    { id: 's2', title: 'Dag 2', athlete_rating: 3, exercises: [{ id: 'bp', name: 'Bænkpres', sets: 1 }] },
    { id: 's3', title: 'Hvile', exercises: [] },
  ],
}
const log = (exercise_id, set_number, weight, reps, skipped = false) => ({ exercise_id, set_number, weight, reps_completed: reps, skipped, logged_at: '2026-09-21T10:00:00Z' })
const fremgang = [{ exercise_id: 'gl', weight: 97.5, reps_completed: 5, logged_at: '2026-09-14T10:00:00Z', exercises: { name: 'Squat' } }]

test('vises først, når alle pas med øvelser har alle sæt', () => {
  assert.equal(dinUge({ week, allWeeks: [week], exerciseLogs: [log('sq', 1, 100, 5), log('sq', 2, 100, 5)], fremgangLogs: [] }), null)
})

test('antal pas, tonnage, ugens rekorder og vurderinger', () => {
  const logs = [log('sq', 1, 100, 5), log('sq', 2, 100, 5), log('bp', 1, 80, 8)]
  const allWeeks = [{ ...week, sessions: week.sessions.map(s => s.id === 's1' ? { ...s, athlete_rating: 4 } : s) }]
  const u = dinUge({ week, allWeeks, exerciseLogs: logs, fremgangLogs: fremgang })
  assert.equal(u.ugeNr, 4)
  assert.deepEqual([u.pasKlaret, u.pasIalt], [2, 2])
  assert.equal(u.tonnage, 100 * 5 * 2 + 80 * 8)
  assert.equal(u.rekorder.length, 1) // squat 100×5 slår 97,5×5; bænk har ingen historik
  assert.equal(u.rekorder[0].navn, 'Squat')
  assert.deepEqual(u.vurderinger.map(v => v.rating), [4, 3])
})

test('sprungne sæt: tæller hverken i tonnage eller som klaret pas', () => {
  const logs = [log('sq', 1, 100, 5), log('sq', 2, 0, 0, true), log('bp', 1, 0, 0, true)]
  const u = dinUge({ week, allWeeks: [week], exerciseLogs: logs, fremgangLogs: fremgang })
  assert.deepEqual([u.pasKlaret, u.pasIalt, u.tonnage], [1, 2, 500])
})

test('kun sprunget over hele ugen: intet kort', () => {
  const logs = [log('sq', 1, 0, 0, true), log('sq', 2, 0, 0, true), log('bp', 1, 0, 0, true)]
  assert.equal(dinUge({ week, allWeeks: [week], exerciseLogs: logs, fremgangLogs: [] }), null)
})

test('historikken ikke hentet: rekorder ukendt (null), ikke 0', () => {
  const logs = [log('sq', 1, 100, 5), log('sq', 2, 100, 5), log('bp', 1, 80, 8)]
  assert.equal(dinUge({ week, allWeeks: [week], exerciseLogs: logs, fremgangLogs: null }).rekorder, null)
})

test('tekster: tonnage med tusindtalsskilletegn, beskeden bærer ugen', () => {
  assert.equal(tonnageTekst(12450), '12.450 kg')
  assert.equal(ugeBesked(4, '  Knæet var fint  '), 'Om uge 4: Knæet var fint')
  assert.equal(ugeBesked(4, '   '), '')
})

test('"sendt" huskes pr. atlet og uge, og en utilgængelig storage vælter intet', () => {
  const mem = new Map()
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
  assert.equal(erUgeLinjeSendt('a1', 'u4', storage), false)
  markerUgeLinjeSendt('a1', 'u4', storage)
  assert.equal(erUgeLinjeSendt('a1', 'u4', storage), true)
  assert.equal(erUgeLinjeSendt('a1', 'u5', storage), false)
  const kaster = { getItem() { throw new Error('nej') }, setItem() { throw new Error('nej') } }
  assert.equal(erUgeLinjeSendt('a1', 'u4', kaster), false)
  markerUgeLinjeSendt('a1', 'u4', kaster)
})
