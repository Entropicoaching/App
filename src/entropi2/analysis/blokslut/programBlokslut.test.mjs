import test from 'node:test'
import assert from 'node:assert/strict'
import { selectProgramBlock, confirmProgramBlock, readBlokslutLogs, programBlokslutModel,
  renderProgramBlokslut, blokslutSeenKey, wasBlokslutSeen, markBlokslutSeen } from './programBlokslut.mjs'
import { snapshot } from './blokslutFixture.mjs'
const weeks = () => snapshot().block.weeks.map((w, i) => ({ ...w, id: `week-${i}` }))
const block = () => selectProgramBlock(weeks(), '2026-11-04')
const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(x => x !== false && x != null) })
const text = x => typeof x === 'object' ? x.children.map(text).join(' ') : String(x)
const nodes = x => typeof x === 'object' ? [x, ...x.children.flatMap(nodes)] : []

test('calendar window: exact Danish boundaries, final week and entire following week only', () => {
  for (const now of ['2026-10-19', '2026-11-01', '2026-11-15T23:00:00Z', '2026-11-16'])
    assert.equal(selectProgramBlock(weeks(), now), null, now)
  for (const now of ['2026-11-01T23:00:00Z', '2026-11-02', '2026-11-08', '2026-11-09', '2026-11-15T22:59:59Z']) {
    assert.equal(selectProgramBlock(weeks(), now).end_date, '2026-11-08', now)
  }
})
test('calendar selection ignores navigation, distinguishes repeated phases and rejects incomplete dates', () => {
  const all = [...weeks(), { ...weeks()[0], id: 'next', start_date: '2026-11-09', block_name: 'Basis' }]
  assert.equal(selectProgramBlock(all, '2026-11-10').start_date, '2026-10-19')
  assert.equal(selectProgramBlock(all, '2026-11-16').start_date, '2026-11-09')
  for (const change of [w => { w[1].start_date = null }, w => { w[1].start_date = '2026-10-27' },
    w => { w[1].id = w[0].id }, w => w.reverse(), w => { w[0].block_name = w[1].block_name = w[2].block_name = '' }]) {
    const w = weeks(); change(w); assert.equal(selectProgramBlock(w, '2026-11-04'), null)
  }
})
test('authoritative reader chunks IDs and paginates past 500 without losing or merging rows', async () => {
  const b = { weeks: [{ sessions: [{ exercises: Array.from({ length: 101 }, (_, i) => ({ id: `e${i}` })) }] }] }
  const calls = [], batch = Array.from({ length: 500 }, () => ({ exercise_id: 'e0' }))
  const rows = await readBlokslutLogs('synthetic-athlete', b, async (ids, from, to) => {
    calls.push([ids.length, from, to]); return { data: from === 0 && ids.length === 100 ? batch : [] }
  })
  assert.equal(rows.length, 500); assert.deepEqual(calls, [[100, 0, 499], [100, 500, 999], [1, 0, 499]])
  await assert.rejects(readBlokslutLogs('', b, () => { throw Error('no read') }))
  await assert.rejects(readBlokslutLogs('synthetic', b, () => ({ data: [], error: true })))
  await assert.rejects(readBlokslutLogs('synthetic', b, () => ({ data: null })))
})
test('actual model: full block strength, completed sessions, empty and failed read', async () => {
  const options = { athleteId: 'synthetic', block: block(), now: '2026-11-10', readPage: () => ({ data: snapshot().exerciseLogs }) }
  const m = await programBlokslutModel(options)
  assert.equal(m.status, 'ready'); assert.equal(m.completed, 3); assert.equal(m.lifts[0].delta, 11)
  const empty = await programBlokslutModel({ ...options, readPage: () => ({ data: [] }) })
  assert.equal(empty.completed, 0); assert.equal(empty.confirmed, 0)
  for (const extra of [{ programError: true }, { readPage: () => { throw Error('raw synthetic detail') } },
    { block: { ...block(), weeks: [] } }]) {
    const failed = await programBlokslutModel({ ...options, ...extra })
    assert.equal(failed.status, 'error'); assert.doesNotMatch(failed.message, /raw synthetic/)
  }
})
test('compact card: strengths, sessions and one focus; calculations folded; honest empty/error', async () => {
  const m = await programBlokslutModel({ athleteId: 'synthetic', block: block(), now: '2026-11-10', readPage: () => ({ data: snapshot().exerciseLogs }) })
  const card = renderProgramBlokslut(h, m, { open: true })
  assert.equal(card.type, 'details'); assert.equal(card.props.open, true)
  assert.match(text(card), /Din blok.*Gennemførte pas: 3 af 3.*Squat: \+11 kg.*Ét fokuspunkt:/)
  assert.equal(nodes(card).filter(n => n.type === 'details')[1].props.open, undefined)
  const empty = renderProgramBlokslut(h, { ...m, completed: 0, confirmed: 0 }, { open: false })
  assert.match(text(empty), /Ingen bekræftede/); assert.doesNotMatch(text(empty), /\+11/)
  const failed = renderProgramBlokslut(h, { status: 'error', message: 'Kunne ikke hentes' }, { open: true, onRetry() {} })
  assert.equal(nodes(failed).filter(n => n.props.role === 'alert').length, 1)
  assert.equal(nodes(failed).filter(n => n.type === 'button').length, 1)
  assert.doesNotMatch(text(failed), /Gennemførte pas|Ét fokuspunkt|e1RM/)
})
test('seen state is isolated by athlete and block; blocked storage remains optional', () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
  const key = blokslutSeenKey('synthetic-a', block())
  assert.equal(wasBlokslutSeen(storage, key), false); markBlokslutSeen(storage, key)
  assert.equal(wasBlokslutSeen(storage, key), true)
  assert.equal(wasBlokslutSeen(storage, blokslutSeenKey('synthetic-b', block())), false)
  assert.equal(wasBlokslutSeen({ getItem() { throw Error() } }, key), false)
  assert.doesNotThrow(() => markBlokslutSeen({ setItem() { throw Error() } }, key))
  assert.ok([...data.keys()].every(key => key.startsWith('entropi2:blokslut:v1:')))
})

test('offline one-week snapshot cannot invent block end; authoritative plan confirms boundaries', async () => {
  const all = weeks(), known = [all[1]]
  let reads = 0
  const read = () => { reads++; return { data: all } }
  assert.equal(await confirmProgramBlock('synthetic', known, '2026-10-28', read), null)
  assert.equal(reads, 1)
  assert.equal(await confirmProgramBlock('synthetic', all, '2026-10-28', read), null)
  assert.equal(reads, 1) // a known middle week does not initiate a boundary query
  const confirmed = await confirmProgramBlock('synthetic', all, '2026-11-04', read)
  assert.deepEqual(confirmed.weeks, all)
  await assert.rejects(confirmProgramBlock('synthetic', all, '2026-11-04', () => ({ error: true })))
})
