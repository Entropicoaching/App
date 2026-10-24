import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDay } from './calendarDate.js'
import { inputInteger } from './inputValues.js'
import { fillMissingWeekDates, nextWeekStartDate } from './weekDates.js'

test('R1 blanktegn skjuler ikke en ugyldig kalenderdato', () => {
  assert.equal(calendarDay(' 2026-02-30 12:00:00Z'), null)
  assert.equal(calendarDay(' \t2026-12-31T23:30:00Z\n'), '2027-01-01')
  for (const pad of [' ', '\t', '\n', '\u00a0', '\ufeff']) {
    for (const day of ['2026-02-30', '2025-02-29', '2026-04-31']) {
      for (const sep of ['T', 't', ' ']) assert.equal(calendarDay(`${pad}${day}${sep}12:00:00Z${pad}`), null)
    }
  }
})

test('R2 udfyldning bruger den godkendte heltalsvaerdi', () => {
  assert.equal(inputInteger('2,0'), 2)
  assert.deepEqual(fillMissingWeekDates([
    { id: 'anchor', week_number: '2,0', start_date: '2026-12-28' },
    { id: 'next', week_number: 3 },
  ]), [{ id: 'next', week_number: 3, start_date: '2027-01-04' }])
  for (const anchorNumber of ['2,0', ' 2,0 ', '2.0', 2]) {
    for (const targetNumber of ['3,0', ' 3,0 ', '3.0', 3]) {
      const rows = [
        { id: 'anchor', week_number: anchorNumber, start_date: '2026-12-28' },
        { id: 'next', week_number: targetNumber },
        { id: 'prev', week_number: '1,0' },
      ]
      const snapshot = JSON.stringify(rows)
      assert.deepEqual(fillMissingWeekDates(rows), [
        { id: 'next', week_number: targetNumber, start_date: '2027-01-04' },
        { id: 'prev', week_number: '1,0', start_date: '2026-12-21' },
      ])
      assert.equal(JSON.stringify(rows), snapshot)
    }
  }
})

test('R2 sortering bruger den godkendte heltalsvaerdi', () => {
  for (const rows of [
    [{ week_number: 1, start_date: '2026-12-14' }, { week_number: '2,0', start_date: '2026-12-28' }],
    [{ week_number: '2,0', start_date: '2026-12-28' }, { week_number: 1, start_date: '2026-12-14' }],
  ]) {
    const snapshot = JSON.stringify(rows)
    assert.equal(nextWeekStartDate(rows), '2027-01-04')
    assert.equal(JSON.stringify(rows), snapshot)
  }
})

test('R1 og R2 bevarer gyldige datoer og afviser ugyldige ugenumre', () => {
  assert.equal(calendarDay(' 2024-02-29 12:00:00Z '), '2024-02-29')
  assert.equal(calendarDay('2026-12-31T23:30:00Z'), '2027-01-01')
  assert.equal(calendarDay(new Date('invalid')), null)
  for (const week_number of [null, undefined, '', ' ', true, [], {}, NaN, Infinity, '2,5', '2kg']) {
    const bad = { id: 'bad', week_number, start_date: '2026-12-28' }
    assert.deepEqual(fillMissingWeekDates([bad, { id: 'next', week_number: 3 }]), [])
    assert.equal(nextWeekStartDate([bad], '2026-10-24'), '2026-10-26')
  }
})
