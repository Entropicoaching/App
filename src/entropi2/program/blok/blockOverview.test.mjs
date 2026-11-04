import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { buildBlockOverview, plannedWeekSets } from './blockOverviewModel.mjs'

register('./viewLoader.mjs', import.meta.url)
const { default: BlockOverview } = await import('./BlockOverview.mjs')
const week = (n, block_name = 'Styrke', start_date = null, sets = 3) => ({
  id: `w${n}`, athlete_id: 'synthetic', week_number: n, block_name, start_date,
  sessions: [{ exercises: [{ sets }] }],
})
const plan = () => [week(5, 'Styrke', '2026-10-26'), week(6, 'Styrke', '2026-11-02', '4'),
  week(7, 'Styrke', '2026-11-09', 5), week(8, 'Deload', '2026-11-16', 2),
  week(9, 'Testuge', '2026-11-23', 1), week(10, 'Styrke', '2026-11-30')]
const options = (weeks = plan(), extra = {}) => ({ enabled: true, weeks, today: '2026-11-03', ...extra })
const nodes = value => value && typeof value === 'object'
  ? [value, ...(value.children || []).flatMap(nodes)] : []
const text = value => value == null ? '' : typeof value === 'object'
  ? (value.children || []).map(text).join(' ') : String(value)
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('strict default OFF does not inspect program input', () => {
  for (const enabled of [undefined, false, 0, 1, 'true', '1', null]) {
    const input = { enabled, weeks: new Proxy([], { get() { throw Error('OFF iterated input') } }) }
    assert.equal(buildBlockOverview(input), null)
    assert.equal(BlockOverview(input), null)
  }
})

test('current block has relative week, prescribed sets and nearest upcoming marker', () => {
  const result = buildBlockOverview(options())
  assert.equal(result.state, 'ready')
  assert.equal(result.name, 'Styrke')
  assert.equal(result.currentWeek, 2)
  assert.equal(result.totalWeeks, 3)
  assert.deepEqual(result.weeks.map(w => [w.weekNumber, w.plannedSets, w.current]),
    [[5, 3, false], [6, 4, true], [7, 5, false]])
  assert.equal(result.next, null)
})

test('input order and frozen data remain unchanged; repeated block names stay separate', () => {
  const weeks = freeze(plan().reverse())
  assert.deepEqual(buildBlockOverview(options(weeks)), buildBlockOverview(options()))
  const last = buildBlockOverview(options(weeks, { currentWeekId: 'w10' }))
  assert.equal(last.currentWeek, 1); assert.equal(last.totalWeeks, 1); assert.equal(last.next, null)
  assert.equal(weeks[0].id, 'w10')
})

test('explicit active week supports undated programs and never falls back from an unknown id', () => {
  const weeks = plan().map(w => ({ ...w, start_date: null }))
  assert.equal(buildBlockOverview(options(weeks)).state, 'unknown')
  const m = buildBlockOverview(options(weeks, { currentWeekId: 'w7', today: 'invalid' }))
  assert.equal(m.currentWeek, 3); assert.equal(m.next, null)
  assert.equal(buildBlockOverview(options(weeks, { currentWeekId: 'missing' })).state, 'unknown')
})

test('empty, malformed, duplicated, mixed-owner, incomplete and gapped program evidence', () => {
  assert.equal(buildBlockOverview(options([])).state, 'empty')
  const malformed = [null, {}, [null], [...plan(), plan()[0]],
    [{ ...week(1), week_number: '1' }],
    [{ ...week(1), block_name: {} }], [week(1), { ...week(2), athlete_id: 'other-synthetic' }],
    [{ ...week(1), readEvidence: { complete: false } }]]
  for (const weeks of malformed) assert.equal(buildBlockOverview(options(weeks, { currentWeekId: 'w1' })).state, 'unknown')
})

test('total prescribed sets sums sessions and exercises, including exact zero', () => {
  assert.equal(plannedWeekSets({ sessions: [{ exercises: [{ sets: '3' }, { sets: 2 }] },
    { exercises: [{ sets: 4 }] }] }), 9)
  assert.equal(plannedWeekSets({ sessions: [] }), 0)
  assert.equal(plannedWeekSets({ sessions: [{ exercises: [] }] }), 0)
  assert.equal(plannedWeekSets(week(1, null, null, 0)), 0)
})

test('missing nested relations and malformed or overflowing sets stay unknown', () => {
  for (const value of [null, undefined, '', ' ', '3x5', -1, 1.5, NaN, Infinity, true, {}, []]) {
    assert.equal(plannedWeekSets({ sessions: [{ exercises: [{ sets: value }] }] }), null)
  }
  for (const value of [null, {}, { sessions: null }, { sessions: [null] },
    { sessions: [{}] }, { sessions: [{ exercises: [null] }] },
    { sessions: [], readEvidence: { complete: false } },
    { sessions: [{ exercises: [{ sets: Number.MAX_SAFE_INTEGER }, { sets: 1 }] }] }]) {
    assert.equal(plannedWeekSets(value), null)
  }
  const weeks = plan(); delete weeks[0].sessions
  assert.equal(buildBlockOverview(options(weeks)).weeks[0].plannedSets, null)
})

test('today uses Copenhagen midnight, DST and year boundaries with seven civil days', () => {
  for (const [first, second, before, after] of [
    ['2026-10-19', '2026-10-26', '2026-10-25T22:59:59Z', '2026-10-25T23:00:00Z'],
    ['2026-03-23', '2026-03-30', '2026-03-29T21:59:59Z', '2026-03-29T22:00:00Z'],
    ['2026-12-28', '2027-01-04', '2027-01-03T22:59:59Z', '2027-01-03T23:00:00Z'],
  ]) {
    const weeks = [week(1, 'A', first), week(2, 'A', second)]
    assert.equal(buildBlockOverview(options(weeks, { today: before })).currentWeek, 1)
    assert.equal(buildBlockOverview(options(weeks, { today: new Date(after) })).currentWeek, 2)
  }
})

test('dates must be valid and unambiguous; before, after and overlapping plans stay unknown', () => {
  for (const today of ['2026-02-30', 'bad', '2026-11-03T12:00:00', null, new Date(NaN), '2026-01-01', '2027-01-01']) {
    assert.equal(buildBlockOverview(options(plan(), { today })).state, 'unknown')
  }
  for (const start of ['2026-02-30', 'bad', '2026-11-02T00:00:00Z']) {
    assert.equal(buildBlockOverview(options([week(1, 'A', start)])).state, 'unknown')
  }
  const weeks = [week(1, 'A', '2026-11-02'), week(2, 'B', '2026-11-03')]
  assert.equal(buildBlockOverview(options(weeks)).state, 'unknown')
})

test('test and deload markers are existing block names, ordered by program week', () => {
  const cases = [['Test', ['test']], ['TESTUGE', ['test']], ['Test week', ['test']],
    ['Test / deload', ['test', 'deload']], ['Aflastning', ['deload']], ['Taper', ['deload']]]
  for (const [name, kinds] of cases) {
    const m = buildBlockOverview(options([week(1, name), week(2, name)], { currentWeekId: 'w1' }))
    assert.deepEqual(m.next.kinds, kinds)
  }
  const m = buildBlockOverview(options([week(1, 'Test'), week(2, 'Contest'), week(3, 'Styrke')], { currentWeekId: 'w1' }))
  assert.equal(m.next, null, 'current marker and arbitrary names do not predict a future test')
})

test('unnamed contiguous blocks still have an honest title and relative count', () => {
  const m = buildBlockOverview(options([week(1, null), week(2, '')], { currentWeekId: 'w2' }))
  assert.equal(m.name, 'Din aktuelle blok'); assert.equal(m.currentWeek, 2); assert.equal(m.totalWeeks, 2)
})

test('actual view renders semantic weekly list and only one current step', () => {
  const tree = BlockOverview(options())
  assert.equal(tree.type, 'section'); assert.equal(tree.props['aria-label'], 'Din aktuelle blok')
  assert.match(text(tree), /Uge 2 af 3/)
  assert.match(text(tree), /programuge 6.*4 planlagte sæt/)
  assert.doesNotMatch(text(tree), /Næste test eller deload|Deload i programuge 8/)
  assert.equal(nodes(tree).filter(n => n.type === 'li').length, 3)
  assert.equal(nodes(tree).filter(n => n.props['aria-current'] === 'step').length, 1)
  assert.equal(nodes(tree).filter(n => n.type === 'button').length, 0)
})

test('actual view distinguishes missing volume, zero, undated marker and no marker', () => {
  const weeks = [week(1), week(2, 'Styrke', null, 0), week(3, 'Test')]
  delete weeks[0].sessions
  const tree = BlockOverview(options(weeks, { currentWeekId: 'w1' }))
  assert.match(text(tree), /Planlagt volumen ukendt/)
  assert.match(text(tree), /0 planlagte sæt/)
  assert.doesNotMatch(text(tree), /Næste test eller deload|Test i programuge 3/)
  assert.doesNotMatch(text(BlockOverview(options([week(1)], { currentWeekId: 'w1' }))), /Næste test eller deload|Ingen kommende test/)
})

test('actual view empty and unknown states explain missing evidence without fabricated totals', () => {
  for (const input of [options([]), options(plan(), { currentWeekId: 'missing' })]) {
    const tree = BlockOverview(input)
    assert.equal(nodes(tree).filter(n => n.props.role === 'status').length, 1)
    assert.doesNotMatch(text(tree), /Uge \d+ af|planlagte sæt/)
  }
})
