import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionSetTotal, sessionLoggedCount, isSessionDone, nextSetInSession, findDagensPas, lastHeaviestSet } from './nextSet.js'

const ex1 = { id: 'e1', name: 'Squat', sets: 3 }
const ex2 = { id: 'e2', name: 'Bænkpres', sets: 2 }
const session = { id: 's1', title: 'Uge 1 · Mandag', exercises: [ex1, ex2] }
const emptySession = { id: 's2', title: 'Restitution', exercises: [] }

test('sessionSetTotal summer sæt på tværs af øvelser', () => {
  assert.equal(sessionSetTotal(session), 5)
  assert.equal(sessionSetTotal(emptySession), 0)
})

test('sessionLoggedCount tæller kun logs der hører til sessionens øvelser', () => {
  const logs = [{ exercise_id: 'e1', set_number: 1 }, { exercise_id: 'e1', set_number: 2 }, { exercise_id: 'other', set_number: 1 }]
  assert.equal(sessionLoggedCount(session, logs), 2)
})

test('isSessionDone kræver alle sæt logget, ikke bare at øvelsen er rørt', () => {
  const partial = [{ exercise_id: 'e1', set_number: 1 }]
  assert.equal(isSessionDone(session, partial), false)
  const full = [1, 2, 3].map(n => ({ exercise_id: 'e1', set_number: n }))
    .concat([1, 2].map(n => ({ exercise_id: 'e2', set_number: n })))
  assert.equal(isSessionDone(session, full), true)
})

test('isSessionDone på en tom session er altid false (intet at gøre klar)', () => {
  assert.equal(isSessionDone(emptySession, []), false)
})

test('nextSetInSession finder første øvelse og sæt uden log-række', () => {
  const logs = [{ exercise_id: 'e1', set_number: 1 }]
  const next = nextSetInSession(session, logs)
  assert.equal(next.exercise.id, 'e1')
  assert.equal(next.setNumber, 2)
  assert.equal(next.totalSets, 3)
})

test('nextSetInSession hopper videre til næste øvelse når den første er færdig', () => {
  const logs = [1, 2, 3].map(n => ({ exercise_id: 'e1', set_number: n }))
  const next = nextSetInSession(session, logs)
  assert.equal(next.exercise.id, 'e2')
  assert.equal(next.setNumber, 1)
})

test('nextSetInSession returnerer null når alle sæt er logget', () => {
  const logs = [1, 2, 3].map(n => ({ exercise_id: 'e1', set_number: n }))
    .concat([1, 2].map(n => ({ exercise_id: 'e2', set_number: n })))
  assert.equal(nextSetInSession(session, logs), null)
})

test('findDagensPas: session med resterende sæt giver status "open" + næste sæt', () => {
  const week = { id: 'w1', week_number: 1, sessions: [session] }
  const pas = findDagensPas([week], week, [])
  assert.equal(pas.status, 'open')
  assert.equal(pas.session.id, 's1')
  assert.equal(pas.next.exercise.id, 'e1')
})

test('findDagensPas: ugen er færdigt logget ("done") og peger fremad på næste session', () => {
  const week = { id: 'w1', week_number: 1, sessions: [session] }
  const nextWeekSession = { id: 's3', title: 'Uge 2 · Mandag', exercises: [ex1] }
  const nextWeek = { id: 'w2', week_number: 2, sessions: [nextWeekSession] }
  const full = [1, 2, 3].map(n => ({ exercise_id: 'e1', set_number: n }))
    .concat([1, 2].map(n => ({ exercise_id: 'e2', set_number: n })))
  const pas = findDagensPas([week, nextWeek], week, full)
  assert.equal(pas.status, 'done')
  assert.equal(pas.upcoming.session.id, 's3')
  assert.equal(pas.upcoming.week.id, 'w2')
})

test('findDagensPas: en tom uge uden noget logget giver "empty", ikke "done"', () => {
  const week = { id: 'w1', week_number: 1, sessions: [emptySession] }
  const nextWeek = { id: 'w2', week_number: 2, sessions: [session] }
  const pas = findDagensPas([week, nextWeek], week, [])
  assert.equal(pas.status, 'empty')
  assert.equal(pas.upcoming.session.id, 's1')
})

test('findDagensPas: intet program overhovedet giver null', () => {
  assert.equal(findDagensPas([], null, []), null)
})

test('findDagensPas: sidste uge i programmet, alt færdigt, intet fremad → upcoming er null', () => {
  const week = { id: 'w1', week_number: 1, sessions: [session] }
  const full = [1, 2, 3].map(n => ({ exercise_id: 'e1', set_number: n }))
    .concat([1, 2].map(n => ({ exercise_id: 'e2', set_number: n })))
  const pas = findDagensPas([week], week, full)
  assert.equal(pas.status, 'done')
  assert.equal(pas.upcoming, null)
})

test('lastHeaviestSet finder det tungeste sæt fra seneste (ikke-ekskluderede) dato', () => {
  const history = {
    squat: [
      { date: '2026-09-17', sets: [{ weight: 100, reps: 5 }] }, // i dag — ekskluderes
      { date: '2026-09-10', sets: [{ weight: 95, reps: 5 }, { weight: 97.5, reps: 3 }, { weight: 90, reps: 8 }] },
    ],
  }
  const best = lastHeaviestSet(history, 'Squat', '2026-09-17')
  assert.equal(best.weight, 97.5)
  assert.equal(best.reps, 3)
})

test('lastHeaviestSet er null når øvelsen ikke har nogen tidligere historik', () => {
  assert.equal(lastHeaviestSet({}, 'Squat', '2026-09-17'), null)
  assert.equal(lastHeaviestSet({ squat: [{ date: '2026-09-17', sets: [{ weight: 100, reps: 5 }] }] }, 'Squat', '2026-09-17'), null)
})
