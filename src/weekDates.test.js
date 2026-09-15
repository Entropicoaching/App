// ORDRE 204, commit 1. Ren funktion for datoreglen: nextWeekStartDate.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextWeekStartDate } from './weekDates.js'

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
