import test from 'node:test'
import assert from 'node:assert/strict'
import { homeReadinessSuggestion } from './quickLogModel.mjs'
import { addCalendarDays } from '../../calendarDate.js'

const athlete = { id: 'synthetic-one-tap' }, today = '2026-11-04'
const row = (extra = {}) => ({ athlete_id: athlete.id, logged_date: '2026-11-03',
  energy: 2, motivation: 4, stress: 2, soreness_level: 1, sleep_hours: 8, ...extra })
const props = (rows = [row()], extra = {}) => ({ enabled: true, athlete, today,
  readinessInput: { sleep: '', energy: null, motivation: null, stress: null, soreness: null },
  trackingData: { status: 'ready', complete: true, athleteId: athlete.id, today, readinessRows: rows }, ...extra })

test('Home proposes only three scores; energy and sleep stay unanswered, caller data stay frozen', () => {
  const previous = Object.freeze(Object.defineProperties(row(), {
    notes: { get() { assert.fail('private notes') } }, sore_zones: { get() { assert.fail('private zones') } },
    sleep_hours: { get() { assert.fail('yesterday sleep') } },
  }))
  const input = props(Object.freeze([previous])); Object.freeze(input.readinessInput)
  const expected = { sleep_hours: '', energy: '', motivation: '4', stress: '2', soreness_level: '1' }
  assert.deepEqual(homeReadinessSuggestion(input), expected)
  assert.deepEqual(homeReadinessSuggestion(input), expected)
})

test('only complete confirmed yesterday from the current athlete is eligible', () => {
  for (const rows of [[], [row({ athlete_id: 'synthetic-other' })], [row({ _optimistic: true })],
    [row({ logged_date: '2026-11-02' })], [row({ logged_date: today })], [row(), row()],
    [row(), row({ logged_date: today })]]) assert.equal(homeReadinessSuggestion(props(rows)), null)
  for (const key of ['energy', 'motivation', 'stress', 'soreness_level'])
    for (const value of [null, '', ' ', 0, 6, -1, 2.5, NaN, Infinity, {}, true])
      assert.equal(homeReadinessSuggestion(props([row({ [key]: value })])), null, `${key}: ${String(value)}`)
  assert.equal(homeReadinessSuggestion(props([row()], { readinessLog: row({ logged_date: today }) })), null)
})

test('loading, failed, incomplete, foreign and invalid scopes never offer a quick suggestion', () => {
  const p = props()
  for (const change of [{ status: 'loading' }, { status: 'error' }, { complete: false },
    { athleteId: 'synthetic-other' }, { today: '2026-11-03' }, { readinessRows: null }])
    assert.equal(homeReadinessSuggestion({ ...p, trackingData: { ...p.trackingData, ...change } }), null)
  for (const today of [null, undefined, '', '2026-02-30', '2026-11-04T12:00:00Z'])
    assert.equal(homeReadinessSuggestion(props([], { today })), null)
  for (const key of ['sleep', 'energy', 'motivation', 'stress', 'soreness'])
    assert.equal(homeReadinessSuggestion(props([row()], { readinessInput: { [key]: '3' } })), null)
})

test('OFF and preview return before touching any athlete, history or draft', () => {
  const blocked = { get athlete() { assert.fail('athlete access') },
    get trackingData() { assert.fail('history access') }, get readinessInput() { assert.fail('draft access') } }
  for (const enabled of [false, undefined, 1, 'true'])
    assert.equal(homeReadinessSuggestion(Object.defineProperties({ enabled }, Object.getOwnPropertyDescriptors(blocked))), null)
  const p = Object.defineProperties({ enabled: true, sessionReadOnly: true }, Object.getOwnPropertyDescriptors(blocked))
  assert.equal(homeReadinessSuggestion(p), null)
})

test('calendar yesterday remains exact through year, leap day and Danish DST changes', () => {
  for (const day of ['2027-01-01', '2028-03-01', '2026-03-30', '2026-10-26']) {
    const p = props([row({ logged_date: addCalendarDays(day, -1) })], { today: day })
    p.trackingData.today = day
    assert.ok(homeReadinessSuggestion(p), day)
  }
})
