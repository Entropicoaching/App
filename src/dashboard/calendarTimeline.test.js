import test from 'node:test'
import assert from 'node:assert/strict'
import { createWeekDate, createTimelineScale } from './calendarWeekDate.mjs'

const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const weeks = dates => dates.map((start_date, i) => ({ week_number: i + 1, start_date }))
const row = wks => ({ wks, weekDate: createWeekDate(wks) })

test('K2: efteraarsskift giver mandagskolonner ved lokal midnat', () => {
  assert.notEqual(new Date('2026-10-19T12:00:00').getTimezoneOffset(), new Date('2026-11-02T12:00:00').getTimezoneOffset(), 'Proeven kraever faktisk tidsskift')
  const wks = weeks(['2026-10-19', '2026-11-02'])
  const before = structuredClone(wks)
  const scale = createTimelineScale([row(wks)], new Date('2026-10-19T12:00:00'), 48)
  assert.deepEqual(scale.cols.map(isoLocal), ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'])
  scale.cols.forEach((d, i) => {
    assert.equal(d.getDay(), 1)
    assert.equal(d.getHours(), 0)
    assert.equal(scale.colOf(d), i)
  })
  assert.equal(scale.todayCol, 1)
  assert.equal(scale.trackW, 240)
  assert.deepEqual(wks, before)
})

test('K2: polstring over begge tidsskift er lokal mandag', () => {
  for (const [today, expected] of [
    ['2026-10-19', ['2026-10-12', '2026-10-19', '2026-10-26']],
    ['2026-10-26', ['2026-10-19', '2026-10-26', '2026-11-02']],
    ['2026-03-23', ['2026-03-16', '2026-03-23', '2026-03-30']],
    ['2026-03-30', ['2026-03-23', '2026-03-30', '2026-04-06']],
  ]) {
    const scale = createTimelineScale([], new Date(today + 'T12:00:00'), 40)
    assert.deepEqual(scale.cols.map(isoLocal), expected)
    scale.cols.forEach(d => { assert.equal(d.getDay(), 1); assert.equal(d.getHours(), 0) })
    assert.equal(scale.trackW, 120)
  }
})

test('K2: flere atleter, ugeindeks og 60 kolonners graense bevares', () => {
  const rows = [row(weeks(['2026-12-28', '2027-01-11'])), row(weeks(['2026-10-19', '2026-11-02']))]
  const scale = createTimelineScale(rows, new Date('2026-10-19T12:00:00'), 48)
  scale.cols.forEach((d, i) => {
    assert.equal(d.getDay(), 1)
    assert.equal(d.getHours(), 0)
    assert.equal(scale.colOf(d), i)
    assert.equal(scale.colOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6, 23, 59)), i)
  })
  assert.equal(createTimelineScale([row(weeks(['2026-01-05', '2028-01-03']))], new Date('2026-10-19T12:00:00'), 48).nCols, 60)
})
