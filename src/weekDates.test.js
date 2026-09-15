// ORDRE 204, commit 1. Ren funktion for datoreglen: nextWeekStartDate.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextWeekStartDate, fillMissingWeekDates } from './weekDates.js'

test('ingen uger overhovedet → førstkommende mandag fra referencedatoen', () => {
  const dato = nextWeekStartDate([], new Date('2026-09-16T10:00:00')) // onsdag
  assert.equal(dato, '2026-09-21') // næste mandag
})

test('referencedatoen ER en mandag → den dag selv, ikke en uge frem', () => {
  const dato = nextWeekStartDate([], new Date('2026-09-14T10:00:00')) // mandag
  assert.equal(dato, '2026-09-14')
})

test('ingen daterede uger blandt eksisterende → falder tilbage til mandag-reglen', () => {
  const uger = [{ week_number: 1, start_date: null }, { week_number: 2, start_date: null }]
  const dato = nextWeekStartDate(uger, new Date('2026-09-16T10:00:00'))
  assert.equal(dato, '2026-09-21')
})

test('forrige uges dato + 7 dage', () => {
  const uger = [{ week_number: 1, start_date: '2026-09-07' }, { week_number: 2, start_date: '2026-09-14' }]
  assert.equal(nextWeekStartDate(uger), '2026-09-21')
})

test('bruger den højeste ugenummer med dato, ikke listens rækkefølge', () => {
  const uger = [{ week_number: 2, start_date: '2026-09-14' }, { week_number: 1, start_date: '2026-09-07' }]
  assert.equal(nextWeekStartDate(uger), '2026-09-21')
})

test('månedsskift', () => {
  const uger = [{ week_number: 1, start_date: '2026-09-28' }]
  assert.equal(nextWeekStartDate(uger), '2026-10-05')
})

test('årsskift', () => {
  const uger = [{ week_number: 1, start_date: '2026-12-28' }]
  assert.equal(nextWeekStartDate(uger), '2027-01-04')
})

test('årsskift ved mandag-reglen (ingen daterede uger, i dag er sidst på året)', () => {
  const dato = nextWeekStartDate([], new Date('2026-12-30T10:00:00')) // onsdag
  assert.equal(dato, '2027-01-04')
})

test('fillMissingWeekDates: udfylder frem og tilbage fra ankeret, rører ikke daterede uger', () => {
  const uger = [
    { id: 'w1', week_number: 1, start_date: null },
    { id: 'w2', week_number: 2, start_date: '2026-09-14' },
    { id: 'w3', week_number: 3, start_date: null },
    { id: 'w4', week_number: 4, start_date: null },
  ]
  const resultat = fillMissingWeekDates(uger)
  assert.deepEqual(resultat, [
    { id: 'w1', week_number: 1, start_date: '2026-09-07' },
    { id: 'w3', week_number: 3, start_date: '2026-09-21' },
    { id: 'w4', week_number: 4, start_date: '2026-09-28' },
  ])
})

test('fillMissingWeekDates: bruger den første daterede uge i rækkefølgen som anker', () => {
  const uger = [
    { id: 'w1', week_number: 1, start_date: null },
    { id: 'w2', week_number: 2, start_date: '2026-09-14' },
    { id: 'w3', week_number: 3, start_date: '2026-09-28' }, // afvigende — ignoreres som anker
  ]
  const resultat = fillMissingWeekDates(uger)
  assert.deepEqual(resultat, [{ id: 'w1', week_number: 1, start_date: '2026-09-07' }])
})

test('fillMissingWeekDates: ingen daterede uger overhovedet → tom liste (ingen anker at regne fra)', () => {
  const uger = [{ id: 'w1', week_number: 1, start_date: null }, { id: 'w2', week_number: 2, start_date: null }]
  assert.deepEqual(fillMissingWeekDates(uger), [])
})

test('fillMissingWeekDates: alle uger allerede daterede → tom liste, ingen ændres', () => {
  const uger = [{ id: 'w1', week_number: 1, start_date: '2026-09-07' }, { id: 'w2', week_number: 2, start_date: '2026-09-14' }]
  assert.deepEqual(fillMissingWeekDates(uger), [])
})

test('fillMissingWeekDates: månedsskift ved tilbageregning', () => {
  const uger = [
    { id: 'w1', week_number: 1, start_date: null },
    { id: 'w2', week_number: 2, start_date: '2026-10-05' },
  ]
  assert.deepEqual(fillMissingWeekDates(uger), [{ id: 'w1', week_number: 1, start_date: '2026-09-28' }])
})
