import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTempo, parsePlannedRest } from './tempoParser.mjs'

test('tempo: four named phases, normalization, zero and explosive timing', () => {
  const result = parseTempo(' 3 - 1 - x - 0 ')
  assert.equal(result.notation, '3-1-X-0')
  assert.deepEqual(result.phases.map(p => [p.key, p.seconds, p.explosive]), [
    ['eccentric', 3, false], ['bottom', 1, false], ['concentric', null, true], ['top', 0, false],
  ])
  assert.equal(parseTempo('0-0-0-0').status, 'valid')
  assert.equal(parseTempo('9-9-9-9').phases[3].seconds, 9)
})

test('tempo: missing differs from malformed; no coercion or partial matches', () => {
  for (const input of [null, undefined, '', '  ']) assert.equal(parseTempo(input).status, 'missing')
  for (const input of [3110, false, {}, [], '3110', '3-1-1', '3-1-1-0-0', '10-1-1-0', '-1-1-1-0',
    '3.5-1-1-0', '3-1-1-0 note', '<b>3-1-1-0</b>', '3/1/1/0', '3-1-Z-0', ' '.repeat(65) + '3-1-1-0']) {
    assert.equal(parseTempo(input).status, 'invalid', String(input))
  }
  const hostile = { toString() { throw new Error('must not coerce') } }
  assert.equal(parseTempo(hostile).status, 'invalid')
  assert.equal(parsePlannedRest(hostile).status, 'invalid')
})

test('planned rest: explicit units, Danish decimals, clock, bounds and zero', () => {
  for (const [input, seconds, label] of [[0, 0, 'Ingen planlagt pause (0 sek.)'], ['45', 45, '45 sek.'],
    ['90 sek', 90, '1 min. 30 sek.'], ['60s', 60, '1 min.'], ['120 SEC', 120, '2 min.'],
    ['1,5 min', 90, '1 min. 30 sek.'], ['1.25 min', 75, '1 min. 15 sek.'],
    ['1:09', 69, '1 min. 9 sek.'], ['1440 min', 86400, '1440 min.']]) {
    assert.deepEqual(parsePlannedRest(input), { status: 'valid', seconds, label })
  }
  for (const input of [null, undefined, '', ' ']) assert.equal(parsePlannedRest(input).status, 'missing')
  for (const input of [NaN, Infinity, -1, 1.5, 86401, true, {}, [], '1:60', '1:5', '1:30:00', '1e2', '0x60',
    'Pause 90 sek', '90 sek ekstra', '2 min 30 sek', '1.01 min', '90.5', '-0', '9'.repeat(100)]) {
    assert.equal(parsePlannedRest(input).status, 'invalid', String(input))
  }
})

test('independent exhaustive numeric oracle: all 10,000 four-digit tempos and 3,601 rest values', () => {
  for (let n = 0; n < 10000; n++) {
    const digits = String(n).padStart(4, '0').split('').map(Number)
    assert.deepEqual(parseTempo(digits.join('-')).phases.map(p => p.seconds), digits)
  }
  for (let seconds = 0; seconds <= 3600; seconds++) {
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    assert.equal(parsePlannedRest(clock).seconds, seconds)
  }
  const a = parseTempo('3-1-1-0'); a.phases[0].seconds = 99
  assert.equal(parseTempo('3-1-1-0').phases[0].seconds, 3)
})
