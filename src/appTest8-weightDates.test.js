import test from 'node:test'
import assert from 'node:assert/strict'
import { parseInputNumber, calendarTime } from './athlete/kostNumbers.mjs'
import { coachBriefingPointKey } from './coachBriefingSeen.js'

test('APP-TEST8: vægt med komma og punktum giver samme endelige tal', () => {
  for (const [input, expected] of [['82,5', 82.5], [' 82,50 ', 82.5], ['82.5', 82.5], [82.5, 82.5], [',5', 0.5], ['+82,5', 82.5]]) {
    assert.equal(parseInputNumber(input), expected, String(input))
  }
})

test('APP-TEST8: ugyldig vægt bliver ikke delvist fortolket', () => {
  for (const input of ['82,5 kg', '82,5,0', '1.234,5', '1,234.5', '-82,5', 'NaN', 'Infinity', '1e999', {}, [], null, undefined]) {
    assert.equal(parseInputNumber(input), null, String(input))
  }
  assert.equal(parseInputNumber(''), null)
  assert.equal(parseInputNumber(' \t '), null)
  assert.equal(parseInputNumber('0,0'), 0) // Positivity is enforced by logWeight, outside this pure parser.
})

test('APP-TEST8: kalenderdatoer ved begge sommertidsskift er hele UTC-dage', () => {
  for (const [a, b] of [['2026-03-28', '2026-03-29'], ['2026-03-29', '2026-03-30'], ['2026-10-24', '2026-10-25'], ['2026-10-25', '2026-10-26']]) {
    assert.equal(calendarTime(b) - calendarTime(a), 86400000)
    assert.equal(calendarTime(a), Date.parse(`${a}T00:00:00Z`))
  }
  for (const value of ['2026-02-29', '2026-03-32', '2026-10-25T00:00:00Z', '', null]) assert.equal(calendarTime(value), null)
})

test('APP-TEST8: beskednøgle følger UTC-dato ved sommertidens spring og gentagne time', () => {
  const key = createdAt => coachBriefingPointKey({ kind: 'message', athlete: { id: 'synthetic1' }, track: 'besked', createdAt })
  for (const ts of ['2026-03-29T01:30:00+01:00', '2026-03-29T03:30:00+02:00']) assert.equal(key(ts), 'message-synthetic1-besked-2026-03-29')
  for (const ts of ['2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00']) assert.equal(key(ts), 'message-synthetic1-besked-2026-10-25')
  assert.equal(key('2026-03-29T00:30:00+01:00'), 'message-synthetic1-besked-2026-03-28')
  assert.equal(key('2026-10-25T00:30:00+02:00'), 'message-synthetic1-besked-2026-10-24')
})
