// Ordre 1485 (Fase B): coachens "Primaere loeft"-kurver foelger samme tunge-saet-regel som atletens Fremgang,
// og sumo har sin egen serie. Syntetisk historik. node --test src/dashboardLiftSeries.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLiftSeries } from './dashboardShared.js'
import { bestHeavySetPerDay } from './exerciseProgress.js'

const log = (name, weight, reps, dag, blok = 'Base') => ({
  weight, reps_completed: reps, skipped: false, logged_at: `${dag}T10:00:00Z`,
  exercises: { name, recommended_weight: null, sessions: { weeks: { block_name: blok } } },
})
const LOGS = [
  log('Bænkpres top set', 100, 3, '2026-09-01'), log('Bænkpres volumen', 85, 15, '2026-09-01'),
  log('Bænkpres - backoff', 90, 8, '2026-09-05'),                       // kun backoff den dag: intet punkt
  log('Bænkpres top set', 70, 5, '2026-09-10', 'Deload'),                // deload: intet punkt
  log('Bænkpres top set', 105, 3, '2026-09-15'), log('baenk teknik single', 60, 1, '2026-09-15'),
  log('Sumo dødløft topsæt', 200, 3, '2026-09-16'), log('Dødløft topsæt', 170, 3, '2026-09-16'),
  log('Deficit sumo dødløft', 210, 5, '2026-09-17'),
]

test('baenk: kun tunge dage, lette saet og deload traekker ikke ned', () => {
  const s = buildLiftSeries(LOGS, 'bænk', {}, 'Bænkpres')
  assert.deepEqual(s.actualData.map(p => p.y), [100, 105])
})

test('sumo og doedloeft er hver sin serie; variant (Deficit sumo) er ingen af dem', () => {
  const sumo = buildLiftSeries(LOGS, 'sumo', {}, 'Sumo dødløft')
  const dl = buildLiftSeries(LOGS, 'dødl', {}, 'Dødløft')
  assert.deepEqual(sumo.actualData.map(p => p.y), [200])
  assert.deepEqual(dl.actualData.map(p => p.y), [170])
})

// Ordre 1492 (fund 3): coachens hovedloeft-kurve har samme tal som atletens (e1RM pr. tungt dag), ikke kg.
test('e1rmData = atletens bestHeavySetPerDay (samme tal), kg ligger separat', () => {
  const s = buildLiftSeries(LOGS, 'bænk', {}, 'Bænkpres')
  const atlet = bestHeavySetPerDay(LOGS.filter(l => /nkpres|baenk/i.test(l.exercises.name)))
  assert.equal(s.e1rmData.length, 2)
  assert.deepEqual(s.e1rmData.map(p => p.y), atlet.map(p => p.e1rm))
  assert.ok(s.e1rmData.every(p => p.y > 100), 'e1RM, ikke kg-tal')
  assert.deepEqual(s.actualData.map(p => p.y), [100, 105])
})
