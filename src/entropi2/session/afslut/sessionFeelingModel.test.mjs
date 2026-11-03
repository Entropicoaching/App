import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionFeeling, SESSION_NOTE_LIMIT } from './sessionFeelingModel.mjs'

test('missing answers stay incomplete; no default RPE or energy is inferred', () => {
  for (const input of [undefined, null, false, [], 1, '8', {}, { rpe: '', energy: ' ' }]) {
    const result = sessionFeeling(input)
    assert.equal(result.status, 'incomplete')
    assert.deepEqual(result.value, { rpe: null, energy: null, note: '' })
    assert.deepEqual(Object.keys(result.errors), ['rpe', 'energy'])
  }
  assert.equal(sessionFeeling({ rpe: 0 }).status, 'incomplete')
  assert.equal(sessionFeeling({ energy: 1 }).status, 'incomplete')
})

test('independent exhaustive scale oracle: all half-step RPE and energy pairs', () => {
  for (let half = 0; half <= 20; half++) for (let energy = 1; energy <= 5; energy++) {
    const result = sessionFeeling({ rpe: half / 2, energy })
    assert.equal(result.status, 'ready')
    assert.deepEqual(result.value, { rpe: half / 2, energy, note: '' })
    assert.deepEqual(result.errors, {})
  }
  assert.deepEqual(sessionFeeling({ rpe: ' 8,5 ', energy: '3', note: '  Roligt afsluttet  ' }).value,
    { rpe: 8.5, energy: 3, note: 'Roligt afsluttet' })
})

test('reject coercion, out-of-range values, fractions outside the scale and malformed strings', () => {
  const invalid = [true, false, [], {}, NaN, Infinity, -Infinity, 'Infinity', 'NaN', '0x8', '1e0', '8abc', '8,5,0', '-1']
  for (const rpe of [...invalid, -0.5, 10.5, 8.25]) {
    const result = sessionFeeling({ rpe, energy: 3 })
    assert.equal(result.status, 'invalid', String(rpe))
    assert.equal(result.value.rpe, null)
    assert.ok(result.errors.rpe)
  }
  for (const energy of [...invalid, 0, 6, 1.5]) {
    const result = sessionFeeling({ rpe: 8, energy })
    assert.equal(result.status, 'invalid', String(energy))
    assert.equal(result.value.energy, null)
    assert.ok(result.errors.energy)
  }
})

test('optional note has an explicit bound, remains plain text and never silently truncates', () => {
  for (const note of [undefined, null, '', '   ']) {
    assert.deepEqual(sessionFeeling({ rpe: 0, energy: 1, note }).value, { rpe: 0, energy: 1, note: '' })
  }
  assert.equal(SESSION_NOTE_LIMIT, 280)
  assert.equal(sessionFeeling({ rpe: 10, energy: 5, note: 'x'.repeat(280) }).status, 'ready')
  for (const note of ['x'.repeat(281), true, 1, [], {}]) {
    const result = sessionFeeling({ rpe: 8, energy: 4, note })
    assert.equal(result.status, 'invalid'); assert.ok(result.errors.note)
  }
  assert.equal(sessionFeeling({ rpe: 8, energy: 4, note: '<script>test</script>' }).value.note, '<script>test</script>')
})

test('frozen inputs, repeatability, fresh results and explicit fields only', () => {
  const input = Object.freeze({ rpe: 7.5, energy: 2, note: '  Tungt  ', highestRpe: 10, athleteId: 'synthetic' })
  const first = sessionFeeling(input), second = sessionFeeling(input)
  assert.deepEqual(first, second)
  first.value.note = 'ændret'
  assert.equal(second.value.note, 'Tungt')
  assert.equal(input.note, '  Tungt  ')
  assert.deepEqual(Object.keys(second.value), ['rpe', 'energy', 'note'])
})
