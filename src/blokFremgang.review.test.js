import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './fremgangLoader.mjs'
install()
const { compareBlocks, renderBlockComparison } = await import('./blokFremgang.mjs')
const { mount, createElement } = await import('./fremgangSynthetic.mjs')
const { options, logs } = await import('./fremgangFixtures.mjs')
const copy = () => structuredClone(options)

test('modproeve 1: Danish midnight counts the actual Danish training day', () => {
  const o = copy()
  o.logs[2].logged_at = '2026-10-25T23:30:00Z'
  o.logs[3].logged_at = '2026-10-26T23:30:00Z'
  assert.deepEqual(compareBlocks(o).lifts[0].counts, [2, 2])
  o.logs[3].logged_at = '2026-10-26T21:30:00Z'
  assert.deepEqual(compareBlocks(o).lifts[0].counts, [2, 1])
})

test('modproeve 2: future blocks never displace the actual current block', () => {
  const o = copy(), future = structuredClone(o.weeks[3])
  future.id = 'w5'; future.week_number = 5; future.start_date = '2026-11-02'; future.block_name = 'Peak'
  o.weeks.push(future)
  assert.equal(compareBlocks(o).current, 'Intensificering, uge 3 til 4')
})

test('modproeve 3: a stale complete foreign response supplies no maxima', () => {
  const o = copy(); o.logs.forEach(l => { l.athlete_id = 'foreign' })
  assert.equal(compareBlocks(o).lifts.some(l => l.status === 'ready'), false)
  assert.doesNotMatch(mount(renderBlockComparison(createElement, o)).textContent, /115 kg/)
})

test('modproeve 4: unsupported or unselected current week never falls back to newest logs', () => {
  const o = copy(); o.today = '2026-11-03'
  assert.equal(compareBlocks(o).status, 'unknown')
  o.today = '2026-10-27'; o.weeks[3].block_name = 7
  assert.equal(compareBlocks(o).status, 'unknown')
})

test('modproeve 5: same day duplicate maxima cannot satisfy the evidence threshold', () => {
  const o = copy(); o.logs = [logs[0], logs[1], logs[2], { ...logs[2], weight: 200 }]
  assert.equal(compareBlocks(o).lifts[0].status, 'insufficient')
})

test('modproeve 6: numeric strings follow existing input parsing and no rounded +0 gain', () => {
  const o = copy(); o.logs.forEach((l, i) => { l.weight = i < 2 ? '100' : '100,1'; l.reps_completed = '3' })
  const m = compareBlocks(o)
  assert.equal(m.lifts[0].status, 'ready'); assert.equal(m.lifts[0].delta, 0)
  assert.doesNotMatch(mount(renderBlockComparison(createElement, o)).textContent, /\+0 kg/)
})

test('modproeve 7: no data, no scope and no block guesses are presented as measurements', () => {
  for (const patch of [{ logs: null }, { weeks: [] }, { weeks: [null] }, { today: 'bad' }]) {
    const m = compareBlocks({ ...copy(), ...patch })
    assert.equal(m.status, 'unknown'); assert.deepEqual(m.lifts, [])
  }
})
