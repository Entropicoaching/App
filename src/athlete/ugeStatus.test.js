// ORDRE 268, commit 1. Egen lille weeks/logs-fixture, samme facon som
// src/volume/planlagt.test.js.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beregnUgeDage, beregnForloebUger } from './ugeStatus.js'

function ex(overrides) {
  return { id: 'ex-1', sets: 4, reps: '5', recommended_weight: 100, ...overrides }
}

test('en dag med planlagt session og fuldt loggede sæt: fuldtLogget=true, tonnage kendt', () => {
  const week = { sessions: [{ weekday: 0, title: 'Dag 1', exercises: [ex()] }] }
  const logs = [
    { exercise_id: 'ex-1', weight: 100, reps_completed: 5, skipped: false },
    { exercise_id: 'ex-1', weight: 100, reps_completed: 5, skipped: false },
    { exercise_id: 'ex-1', weight: 100, reps_completed: 5, skipped: false },
    { exercise_id: 'ex-1', weight: 100, reps_completed: 5, skipped: false },
  ]
  const { dage, flexSessioner } = beregnUgeDage(week, null, logs)
  assert.equal(flexSessioner, 0)
  const mandag = dage[0]
  assert.equal(mandag.harSession, true)
  assert.equal(mandag.planlagtSaet, 4)
  assert.equal(mandag.gennemfoertSaet, 4)
  assert.equal(mandag.planlagtTonnage, 2000) // 4 × 5 × 100
  assert.equal(mandag.gennemfoertTonnage, 2000)
  assert.equal(mandag.fuldtLogget, true)
  // dage uden session er tomme, ikke fejl
  assert.equal(dage[1].harSession, false)
  assert.equal(dage[1].planlagtSaet, 0)
})

test('sprunget-over sæt tæller aldrig som gennemført (samme regel som planlagt.js)', () => {
  const week = { sessions: [{ weekday: 2, exercises: [ex({ sets: 2 })] }] }
  const logs = [
    { exercise_id: 'ex-1', weight: 100, reps_completed: 5, skipped: false },
    { exercise_id: 'ex-1', weight: 100, reps_completed: 5, skipped: true },
  ]
  const { dage } = beregnUgeDage(week, null, logs)
  assert.equal(dage[2].gennemfoertSaet, 1)
  assert.equal(dage[2].gennemfoertTonnage, 500)
  assert.equal(dage[2].fuldtLogget, false)
})

test('manglende reps eller vægt gør planlagt tonnage ukendt (null), men sæt tælles stadig', () => {
  const week = { sessions: [{ weekday: 3, exercises: [ex({ recommended_weight: null })] }] }
  const { dage } = beregnUgeDage(week, null, [])
  assert.equal(dage[3].planlagtSaet, 4)
  assert.equal(dage[3].planlagtTonnage, null)
})

test('reps-interval bruger laveste ende, samme konvention som DagensPasCard', () => {
  const week = { sessions: [{ weekday: 4, exercises: [ex({ sets: 3, reps: '4-6', recommended_weight: 80 })] }] }
  const { dage } = beregnUgeDage(week, null, [])
  assert.equal(dage[4].planlagtTonnage, 960) // 3 × 4 × 80
})

test('dato udledes af weekStart + ugedag når kendt', () => {
  const mandag = new Date('2026-09-14T12:00:00Z')
  const week = { sessions: [{ weekday: 2, exercises: [] }] }
  const { dage } = beregnUgeDage(week, mandag, [])
  assert.equal(dage[2].date.getTime(), new Date('2026-09-16T12:00:00Z').getTime())
  assert.equal(dage[0].date.getTime(), mandag.getTime())
})

test('fleksibel session (ingen fast ugedag) tælles ikke på nogen dag, men i flexSessioner', () => {
  const week = { sessions: [{ weekday: null, exercises: [ex()] }] }
  const { dage, flexSessioner } = beregnUgeDage(week, null, [])
  assert.equal(flexSessioner, 1)
  assert.ok(dage.every(d => d.planlagtSaet === 0))
})

// ---- beregnForloebUger (commit 2) ----

test('hele forløbet: planlagt fra daterede programuger, gennemført fra logs samme kalenderuge', () => {
  const weeks = [
    { start_date: '2026-09-07', sessions: [{ exercises: [ex({ sets: 4, reps: '5', recommended_weight: 100 })] }] },
    { start_date: '2026-09-14', sessions: [{ exercises: [ex({ sets: 3, reps: '5', recommended_weight: 100 })] }] },
  ]
  const logs = [
    { weight: 100, reps_completed: 5, skipped: false, logged_at: '2026-09-08' }, // uge 1
    { weight: 100, reps_completed: 5, skipped: false, logged_at: '2026-09-08' },
    { weight: 100, reps_completed: 5, skipped: true, logged_at: '2026-09-08' }, // tæller ikke
    { weight: 100, reps_completed: 5, skipped: false, logged_at: '2026-08-01' }, // ingen dateret uge her — tæller ikke
  ]
  const { uger, ugerUdenDato } = beregnForloebUger(weeks, logs)
  assert.equal(ugerUdenDato, 0)
  assert.equal(uger.length, 2)
  assert.equal(uger[0].planlagt.saet, 4)
  assert.equal(uger[0].planlagt.tonnage, 2000)
  assert.equal(uger[0].gennemfoert.saet, 2)
  assert.equal(uger[0].gennemfoert.tonnage, 1000)
  assert.equal(uger[1].planlagt.saet, 3)
  assert.equal(uger[1].gennemfoert.saet, 0)
})

test('uge uden start_date tælles i ugerUdenDato, ikke i uger', () => {
  const weeks = [{ start_date: null, sessions: [{ exercises: [ex()] }] }]
  const { uger, ugerUdenDato } = beregnForloebUger(weeks, [])
  assert.equal(ugerUdenDato, 1)
  assert.equal(uger.length, 0)
})

test('planlagt tonnage ukendt for en uge smitter ikke andre ugers tonnage', () => {
  const weeks = [
    { start_date: '2026-09-07', sessions: [{ exercises: [ex({ recommended_weight: null })] }] },
    { start_date: '2026-09-14', sessions: [{ exercises: [ex({ recommended_weight: 100, reps: '5' })] }] },
  ]
  const { uger } = beregnForloebUger(weeks, [])
  assert.equal(uger[0].planlagt.tonnage, null)
  assert.equal(uger[1].planlagt.tonnage, 2000)
})
