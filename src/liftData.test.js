import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exerciseSetView, mainLiftName } from './exerciseSetView.js'
import { bestEstimatedSetPerWeek, HOVEDLOEFT_FAMILIER } from './exerciseProgress.js'
import { bygGrundlag, findRekord, rekordListe } from './athlete/rekorder.js'
import { loadRekordIndeks, grundlagFoer, flet } from './athlete/rekordIndeks.js'
import { normaliserRekorder, bedsteRekorder } from './personalRecords.js'
import { liftOf } from './coachBriefingRules.js'

const names = ['Baenkpres Top set', 'Back-off Bænkpres', 'Bænkpres']
const sets = names.map((navn, i) => ({ navn, weight: [100, 90, 95][i], reps: [3, 10, 5][i], dato: `2026-09-${21+i}T12:00:00Z` }))

test('three historical set names share record baseline, estimates and rep records', () => {
  const source = structuredClone(sets)
  const g = bygGrundlag(sets)
  assert.deepEqual(Object.keys(g), ['baenkpres'])
  assert.equal(Math.round(g.baenkpres.e1rm), 120)
  assert.equal(findRekord(g, { navn: 'Bench press', weight: 100, reps: 3 }), null)
  assert.equal(findRekord(g, { navn: 'Bænkpres - backoff', weight: 90, reps: 11 }).navn, 'Bænkpres')
  const list = rekordListe(sets)
  assert.equal(list.length, 1)
  assert.equal(list[0].e1rm, 120)
  assert.equal(list[0].navn, 'Bænkpres')
  assert.deepEqual(sets, source)
})

test('uge-estimatet (ikke kurven) kan stadig vinde paa et let saet; skipped og 0 reps vinder aldrig', () => {
  const logs = sets.map(s => ({ weight: s.weight, reps_completed: s.reps, logged_at: s.dato }))
  logs.push({ weight: 500, reps_completed: 1, logged_at: sets[0].dato, skipped: true }, { weight: 500, reps_completed: 0, logged_at: sets[0].dato })
  assert.deepEqual(bestEstimatedSetPerWeek(logs), [{ uge: '2026-W39', weight: 90, reps: 10, e1rm: 120 }])
})

test('exact four main lifts: set types combine; sumo, conventional and all variants remain separate', () => {
  for (const [name, expected] of [['Squat top', 'Squat'], ['Bench press', 'Bænkpres'], ['Konventionel doedloeft - backoff', 'Dødløft'], ['Sumo deadlift Top set', 'Sumo dødløft']]) {
    assert.equal(mainLiftName(name), expected)
    assert.equal(HOVEDLOEFT_FAMILIER.filter(f => f.match(name)).length, 1)
    assert.ok(liftOf(name))
  }
  for (const name of ['Front squat', 'Pause squat', 'Close-grip bænkpres', 'RDL', 'Rumænsk dødløft', 'Goblet squat', 'Trap bar deadlift']) {
    assert.equal(mainLiftName(name), null)
    assert.equal(HOVEDLOEFT_FAMILIER.filter(f => f.match(name)).length, 0)
    assert.equal(liftOf(name), null)
  }
  const g = bygGrundlag(['Dødløft', 'Sumo dødløft', 'Pause squat'].map(navn => ({ navn, weight: 100, reps: 5 })))
  assert.equal(Object.keys(g).length, 3)
})

test('existing v2 cache is normalized on read with all weight/reps maxima preserved', () => {
  const base = Object.fromEntries(sets.map(s => [s.navn.toLowerCase(), { e1rm: s.weight * (1+s.reps/30), vaegte: { [s.weight]: s.reps } }]))
  const raw = JSON.stringify({ v: 2, athleteId: 'synthetic', bygget: true, base, uger: { old: { 'bench press': { e1rm: 110, vaegte: { 100: 4 } } } }, til: '2026-09-23' })
  const storage = { getItem: () => raw }
  const ix = loadRekordIndeks('synthetic-user', 'synthetic', storage)
  const g = grundlagFoer(ix, { id: 'active' })
  assert.deepEqual(g, { baenkpres: { e1rm: 120, vaegte: { 90: 10, 95: 5, 100: 4 } } })
  assert.equal(findRekord(base, { navn: 'Bænkpres', weight: 100, reps: 3 }), null)
  assert.deepEqual(flet(base, ix.uger.old), g)
  assert.equal(storage.getItem(), raw)
})

test('coach personal record views share one lift without losing dates or variants', () => {
  const rows = names.map((exercise_name, i) => ({ id: i, exercise_name, weight: 100, reps: 3, created_at: `2026-09-${21+i}` }))
  rows.push({ id: 3, exercise_name: 'Pause bænkpres', weight: 120, reps: 3 })
  const copy = structuredClone(rows)
  assert.equal(normaliserRekorder(rows).length, 2)
  assert.deepEqual(bedsteRekorder(rows).map(r => r.exercise_name), ['Bænkpres', 'Pause bænkpres'])
  assert.deepEqual(rows, copy)
  assert.equal(exerciseSetView('Back-off Baenkpres').key, 'baenkpres')
})
