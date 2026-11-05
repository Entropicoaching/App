import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './Analysis.mjs'
import { renderTree } from './testDom.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const log = (name = 'Squat', extra = {}) => ({
  exercise_id: 'synthetic', logged_at: '2026-11-03T10:00:00Z',
  weight: '12,5', reps_completed: 12, exercises: { name }, ...extra,
})
const props = logs => ({ entropi2: true, now, fremgangLogs: logs })
const model = async (logs, extra = {}) => (await import('./muscleVolume.mjs')).muscleVolume({ ...props(logs), ...extra }, extra.now ?? now)
const group = (result, name = 'Ben', week = 3) => result.weeks[week].groups.find(g => g.group === name)
const dom = p => renderTree(Analysis(p))
const treeNodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(treeNodes)]

test('volume: empty data has four Monday weeks with zero counts and tonnage', async () => {
  const result = await model([])
  assert.deepEqual(result.weeks.map(w => w.start), ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
  assert.equal(result.weeks.at(-1).end, '2026-11-08')
  assert.ok(result.weeks.every(w => w.groups.length === 7 && w.groups.every(g => g.sets === 0 && g.tonnage === 0)))
})

test('volume: gaps stay zero; decimals, light and deload sets contribute without a heavy-set gate', async () => {
  const logs = [log('Squat', { logged_at: '2026-10-12', weight: '0,1', reps_completed: 3 }),
    log('Squat', { weight: '0.2', reps_completed: 3 }),
    log('Bænkpres', { exercise_id: 'bench', weight: '12,5', reps_completed: 12,
      exercises: { name: 'Bænkpres', sessions: { weeks: { block_name: 'Deload' } } } })]
  const result = await model(logs)
  assert.deepEqual(group(result, 'Bryst'), { group: 'Bryst', sets: 1, tonnage: 150 })
  assert.equal(group(result).tonnage, 0.6000000000000001)
  assert.equal(group(result, 'Ben', 0).sets, 1)
  assert.ok(result.weeks.slice(1, 3).every(w => w.groups.every(g => g.sets === 0)))
  assert.deepEqual(result, await model([...logs].reverse()))
  assert.equal((await import('./muscleVolume.mjs')).formatVolume(0.1 * 3 + 0.2 * 3), '0,9')
})

test('volume: exact fixed mapping, no substring guessing or prototype names', async () => {
  const { muscleGroup } = await import('./muscleVolume.mjs')
  for (const [name, expected] of [[' BACK SQUAT ', 'Ben'], ['bench press', 'Bryst'], ['deadlift', 'Ryg'],
    ['overhead press', 'Skuldre'], ['biceps curl', 'Arme'], ['crunch', 'Mave'],
    ['Squat special', 'Øvrigt'], ['__proto__', 'Øvrigt'], [null, 'Øvrigt']]) assert.equal(muscleGroup(name), expected)
  const result = await model([log('Ukendt syntetisk øvelse'), log(undefined, { exercise_id: 'unnamed', exercises: {} })])
  assert.deepEqual(group(result, 'Øvrigt'), { group: 'Øvrigt', sets: 2, tonnage: 300 })
})

test('volume: excludes future, invalid, outside-window, skipped and optimistic logs', async () => {
  const logs = [log(), ...[
    { logged_at: '2026-10-11' }, { logged_at: '2026-11-05' }, { logged_at: '2026-11-04T12:00:01Z' },
    { logged_at: '2026-02-30' }, { logged_at: '2026-11-03T24:00:00Z' },
    { logged_at: 'yesterday' }, { skipped: true }, { _optimistic: true },
  ].map((extra, i) => log('Squat', { id: `bad-${i}`, ...extra }))]
  assert.deepEqual(group(await model(logs)), { group: 'Ben', sets: 1, tonnage: 150 })
})

test('volume: Danish Monday boundaries, DST and year rollover', async () => {
  for (const [instant, previous, current, start] of [
    ['2026-11-01T23:30:00Z', '2026-11-01T22:59:59Z', '2026-11-01T23:00:00Z', '2026-11-02'],
    ['2026-07-05T22:30:00Z', '2026-07-05T21:59:59Z', '2026-07-05T22:00:00Z', '2026-07-06'],
    ['2026-01-04T23:30:00Z', '2026-01-04T22:59:59Z', '2026-01-04T23:00:00Z', '2026-01-05'],
  ]) {
    const result = await model([log('Squat', { id: 'a', logged_at: previous }), log('Squat', { id: 'b', logged_at: current })], { now: new Date(instant) })
    assert.equal(result.weeks[3].start, start)
    assert.equal(group(result, 'Ben', 2).sets, 1)
    assert.equal(group(result).sets, 1)
  }
})

test('volume: duplicates count once, ambiguous confirmations are excluded', async () => {
  const saved = log('Squat', { id: 'saved' })
  assert.equal(group(await model([saved, { ...saved }])).sets, 1)
  assert.equal(group(await model([saved, { ...saved, weight: 20 }])).sets, 0)
  const noId = log()
  assert.equal(group(await model([noId, { ...noId }])).sets, 1)
})

test('volume: local edits and undo replace history and obtain name from the program', async () => {
  const currentWeek = { start_date: '2026-11-02', sessions: [{ exercises: [{ id: 'synthetic', name: 'Bænkpres' }] }] }
  assert.equal(group(await model([log()], { currentWeek, exerciseLogs: [] })).sets, 0)
  const result = await model([log()], { currentWeek, exerciseLogs: [log('Wrong', { set_number: 1, weight: '20,5' })] })
  assert.equal(group(result).sets, 0)
  assert.deepEqual(group(result, 'Bryst'), { group: 'Bryst', sets: 1, tonnage: 246 })
  assert.equal(group(await model([log()], { currentWeek, exerciseLogs: [log('Squat', { logged_at: '2026-10-28' })] })).sets, 0)
})

test('volume: missing history, loading and invalid date do not fabricate zero weeks', async () => {
  for (const extra of [{ fremgangLogs: undefined }, { fremgangLoading: true }, { now: new Date('invalid') }]) {
    const result = await model([log()], extra)
    assert.deepEqual(result.weeks, [])
    assert.match(result.message, /mangler|ikke klar/)
  }
})

test('volume: incomplete or overflowing tonnage remains explicit; zero weight is valid', async () => {
  for (const extra of [{ weight: '' }, { weight: -1 }, { reps_completed: 1.5 }, { weight: Number.MAX_VALUE }]) {
    assert.deepEqual(group(await model([log('Squat', extra)])), { group: 'Ben', sets: 1, tonnage: null })
  }
  const result = await model([log(), log('Squat', { id: 'missing', weight: null })])
  assert.equal(group(result).tonnage, null)
  assert.equal(group(result).sets, 2)
  assert.equal(group(await model([log('Squat', { weight: 0 })])).tonnage, 0)
})

test('volume render: accessible tables show only observed weeks and muscle groups', () => {
  const section = dom(props([log('Unknown')])).querySelectorAll('[data-analysis-volume]')[0]
  assert.ok(section)
  assert.equal(section.querySelectorAll('table').length, 1)
  assert.equal(section.querySelectorAll('caption').length, 1)
  assert.equal(section.querySelectorAll('tbody').length, 1)
  assert.equal(section.querySelectorAll('td').length, 2)
  const latest = section.querySelectorAll('tbody')[0]
  assert.equal(latest.querySelectorAll('tr')[0].textContent, 'Øvrigt1150')
  assert.ok(section.querySelectorAll('th').every(n => ['col', 'row'].includes(n.getAttribute('scope'))))
  assert.match(section.textContent, /02.11.2026 til 08.11.2026/)
  assert.match(section.textContent, /kg × gentagelser/)
  assert.equal(section.querySelectorAll('button').length, 0)
})

test('volume render: OFF is lazy, frozen inputs remain untouched and missing data has no tables', () => {
  for (const entropi2 of [false, undefined, 'true', 1]) {
    assert.equal(Analysis({ entropi2, get fremgangLogs() { throw Error('OFF'); } }), null)
  }
  const p = props([log()]); const before = JSON.stringify(p)
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } }
  freeze(p); dom(p); assert.equal(JSON.stringify(p), before)
  for (const extra of [{ fremgangLogs: undefined }, { fremgangLoading: true }]) {
    const section = dom({ ...p, ...extra }).querySelectorAll('[data-analysis-volume]')[0]
    assert.equal(section, undefined)
  }
})

test('volume render: 390px structure uses fixed fluid tables, wrap and no added navigation', () => {
  const tree = Analysis(props([log()]))
  const section = treeNodes(tree).find(n => n.props?.['data-analysis-volume'])
  assert.ok(section)
  assert.equal(tree.props.style.width, '100%')
  assert.equal(tree.props.style.boxSizing, 'border-box')
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.equal(section.props.style.minWidth, 0)
  for (const table of treeNodes(section).filter(n => n.type === 'table')) {
    assert.equal(table.props.style.width, '100%')
    assert.equal(table.props.style.tableLayout, 'fixed')
    const headers = treeNodes(table).filter(n => n.props?.scope === 'col')
    assert.deepEqual(headers.map(n => n.props.style.width), ['40%', '15%', '45%'])
  }
})
