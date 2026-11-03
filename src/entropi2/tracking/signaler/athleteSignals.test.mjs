import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAthleteSignalList } from './athleteSignals.mjs'

const athleteId = 'synthetic-athlete-a'
const basis = (patch = {}) => ({
  sufficient: true, sampleCount: 4, minimumSampleCount: 3,
  from: '2026-10-26', to: '2026-11-01', summary: '4 syntetiske observationer',
  ...patch,
})
const signal = (patch = {}) => ({
  key: 'recovery.review', subject: 'weekly', strength: 'obs',
  reason: 'Gennemgå den syntetiske uge', dataBasis: basis(), ...patch,
})
const output = (source = 'belastning', signals = [signal()], id = athleteId) => ({
  athleteId: id, source, signals,
})
const list = outputs => buildAthleteSignalList({ athleteId, enabled: true, outputs })

test('OFF is explicit, defaults to empty and does not inspect upstream outputs', () => {
  assert.deepEqual(buildAthleteSignalList(), [])
  assert.deepEqual(buildAthleteSignalList(null), [])
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    assert.deepEqual(buildAthleteSignalList({ athleteId, enabled,
      get outputs() { throw new Error('OFF inspected upstream data') },
    }), [])
  }
})

test('empty and invalid top-level data are quiet', () => {
  for (const outputs of [undefined, null, {}, 'bad', [], [null, false, {}]]) {
    assert.deepEqual(list(outputs), [])
  }
  for (const id of [undefined, null, '', ' ', 1, {}, ' synthetic-athlete-a']) {
    assert.deepEqual(buildAthleteSignalList({ athleteId: id, enabled: true,
      outputs: [output()] }), [])
  }
})

test('four sources produce one list ordered by strength then key and subject', () => {
  const result = list([
    output('vaegt', [signal({ key: 'weight.up', strength: 'info' })]),
    output('kost', [signal({ key: 'nutrition.review', strength: 'obs' })]),
    output('styrke', [signal({ key: 'strength.down', strength: 'vigtig' })]),
    output('belastning', [signal({ key: 'load.up', strength: 'vigtig' })]),
  ])
  assert.deepEqual(result.map(s => [s.key, s.strength]), [
    ['load.up', 'vigtig'], ['strength.down', 'vigtig'],
    ['nutrition.review', 'obs'], ['weight.up', 'info'],
  ])
  for (const row of result) {
    assert.equal(row.athleteId, athleteId)
    assert.deepEqual(row.reasons, ['Gennemgå den syntetiske uge'])
    assert.equal(row.dataBasis[0].sampleCount, 4)
    assert.equal(row.dataBasis[0].summary, '4 syntetiske observationer')
  }
})

test('athlete identity is isolated even for identical issue keys', () => {
  const outputs = [output('kost', [signal({ strength: 'vigtig' })], 'synthetic-athlete-b'),
    output('vaegt'), { user_id: athleteId, source: 'styrke', signals: [signal()] }]
  assert.deepEqual(list(outputs)[0].sources, ['vaegt'])
  const second = buildAthleteSignalList({ athleteId: 'synthetic-athlete-b', enabled: true, outputs })
  assert.equal(second.length, 1)
  assert.equal(second[0].athleteId, 'synthetic-athlete-b')
  assert.deepEqual(second[0].sources, ['kost'])
})

test('duplicates merge strongest strength with all distinct explanations and evidence', () => {
  const outputs = [output('belastning', [signal({ reason: 'Belastning steget' })]),
    output('styrke', [signal({ strength: 'vigtig', reason: 'Styrke faldet' })])]
  const result = list([...outputs, ...outputs])
  assert.equal(result.length, 1)
  assert.equal(result[0].strength, 'vigtig')
  assert.deepEqual(result[0].reasons, ['Belastning steget', 'Styrke faldet'])
  assert.deepEqual(result[0].sources, ['belastning', 'styrke'])
  assert.equal(result[0].dataBasis.length, 2)
  assert.deepEqual(result[0].dataBasis.map(b => b.sampleCount), [4, 4])
})

test('identical evidence and whitespace-normalized explanations appear once', () => {
  const row = list([output('kost', [signal(), signal({ reason: ' Gennemgå den syntetiske uge ',
    dataBasis: basis({ summary: ' 4 syntetiske observationer ' }) })])])[0]
  assert.equal(row.reasons.length, 1)
  assert.equal(row.dataBasis.length, 1)
})

test('different subjects, issues and opposite trends are not merged', () => {
  const result = list([output('styrke', [
    signal({ key: 'strength.down', subject: 'squat' }),
    signal({ key: 'strength.down', subject: 'bench' }),
    signal({ key: 'strength.up', subject: 'squat' }),
  ])])
  assert.deepEqual(result.map(s => [s.key, s.subject]), [
    ['strength.down', 'bench'], ['strength.down', 'squat'], ['strength.up', 'squat'],
  ])
})

test('composite identity cannot collide through delimiter characters', () => {
  assert.equal(list([output('kost', [signal({ key: 'a:b', subject: 'c' }),
    signal({ key: 'a', subject: 'b:c' })])]).length, 2)
})

test('same issue in multiple periods keeps both bases without adding counts', () => {
  const row = list([output('vaegt', [signal(), signal({ dataBasis: basis({
    from: '2026-10-19', to: '2026-10-25', sampleCount: 3,
  }) })])])[0]
  assert.equal(row.dataBasis.length, 2)
  assert.deepEqual(row.dataBasis.map(b => b.sampleCount).sort(), [3, 4])
})

test('insufficient data yields no signal at each source including severe candidates', () => {
  for (const source of ['belastning', 'styrke', 'kost', 'vaegt']) {
    for (const patch of [{ sufficient: false }, { sufficient: undefined },
      { sufficient: 'true' }, { sampleCount: 2 }, { sampleCount: 0 }]) {
      assert.deepEqual(list([output(source, [signal({ strength: 'vigtig', dataBasis: basis(patch) })])]), [])
    }
  }
  assert.equal(list([output('kost', [signal({ dataBasis: basis({ sampleCount: 3 }) })])]).length, 1)
})

test('invalid counts cannot pass the adequacy gate', () => {
  for (const field of ['sampleCount', 'minimumSampleCount']) {
    for (const value of [undefined, null, 0, -1, 1.5, '3', NaN, Infinity, 2 ** 53]) {
      assert.deepEqual(list([output('kost', [signal({ dataBasis: basis({ [field]: value }) })])]), [])
    }
  }
})

test('evidence requires real ordered calendar days and a readable basis', () => {
  for (const patch of [{ from: '2026-02-29' }, { to: '2026-11-31' },
    { from: '2026-11-02' }, { from: '2026-1-01' }, { to: 'bad' },
    { to: null }, { to: '2026-11-01T00:00:00Z' }, { summary: '' }, { summary: ' ' },
    { summary: 4 }]) {
    assert.deepEqual(list([output('vaegt', [signal({ dataBasis: basis(patch) })])]), [])
  }
  for (const [from, to] of [['2024-02-29', '2024-02-29'], ['2025-12-31', '2026-01-01']]) {
    assert.equal(list([output('vaegt', [signal({ dataBasis: basis({ from, to }) })])]).length, 1)
  }
})

test('malformed individual candidates do not suppress valid neighbors', () => {
  const invalid = [null, false, {}, signal({ key: '' }), signal({ key: ' x ' }),
    signal({ subject: '' }), signal({ subject: 5 }), signal({ reason: null }),
    signal({ reason: ' ' }), signal({ dataBasis: null }), signal({ strength: 'urgent' }),
    signal({ strength: '__proto__' })]
  for (const candidate of invalid) assert.deepEqual(list([output('kost', [candidate])]), [])
  assert.equal(list([output('kost', [...invalid, signal()])]).length, 1)
  assert.deepEqual(list([{ athleteId, source: 'other', signals: [signal()] },
    { athleteId, source: 'kost', signals: {} }]), [])
})

test('insufficient duplicates cannot raise severity or contribute evidence', () => {
  const row = list([output('kost', [signal({ strength: 'info' }), signal({
    strength: 'vigtig', reason: 'Må ikke vises', dataBasis: basis({ sufficient: false }),
  })])])[0]
  assert.equal(row.strength, 'info')
  assert.deepEqual(row.reasons, ['Gennemgå den syntetiske uge'])
  assert.equal(row.dataBasis.length, 1)
})

test('permutations produce identical complete output including nested evidence order', () => {
  const outputs = [output('vaegt', [signal({ reason: 'Z', strength: 'info' })]),
    output('kost', [signal({ key: 'a' }), signal({ reason: 'A' })]),
    output('belastning', [signal({ strength: 'vigtig' })])]
  const expected = list(outputs)
  for (let n = 0; n < outputs.length; n++) {
    const rotated = [...outputs.slice(n), ...outputs.slice(0, n)]
    assert.deepEqual(list(rotated), expected)
    assert.deepEqual(list(rotated.reverse().map(o => ({ ...o, signals: [...o.signals].reverse() }))), expected)
  }
})

test('input remains frozen and outputs are detached and restricted to the contract', () => {
  const candidate = signal({ internalNote: 'not part of contract',
    dataBasis: basis({ rawRows: [{ value: 'not part of contract' }] }) })
  const outputs = [output('kost', [candidate])]
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze)
      Object.freeze(value)
    }
    return value
  }
  freeze(outputs)
  const before = JSON.stringify(outputs)
  const first = list(outputs)
  assert.equal(JSON.stringify(first).includes('not part of contract'), false)
  first[0].dataBasis[0].sampleCount = 999
  first[0].reasons.push('changed')
  assert.equal(list(outputs)[0].dataBasis[0].sampleCount, 4)
  assert.equal(list(outputs)[0].reasons.length, 1)
  assert.equal(JSON.stringify(outputs), before)
})

test('prototype-shaped keys remain ordinary signal identities', () => {
  const result = list([output('kost', [signal({ key: '__proto__' }),
    signal({ key: 'constructor' })])])
  assert.deepEqual(result.map(s => s.key), ['__proto__', 'constructor'])
})
