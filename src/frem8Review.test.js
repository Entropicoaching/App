import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './fremgangLoader.mjs'
install()
const { compareBlocks, renderBlockComparison } = await import('./blokFremgang.mjs')
const { options } = await import('./fremgangFixtures.mjs')
const { createElement, mount, find } = await import('./fremgangSynthetic.mjs')
const copy = () => structuredClone(options)

test('counterexample: foreign athlete, variant, backoff and invalid set never populate empty current cells', () => {
  for (const patch of [{ athlete_id: 'foreign' }, { exercises: { name: 'Front squat' } },
    { exercises: { name: 'Squat backoff' } }, { skipped: true }, { weight: Infinity }, { reps_completed: 1.5 }]) {
    const o = copy(); o.logs = o.logs.map((l, i) => i >= 2 ? { ...l, ...patch } : l)
    assert.equal(compareBlocks(o).lifts[0].now, null)
    const tree = mount(renderBlockComparison(createElement, o))
    assert.equal(find(tree, 'data-blok-forskel')[0].textContent, '-')
    assert.doesNotMatch(tree.textContent, /NaN|Infinity/)
  }
})

test('counterexample: repeated names use immediate previous block, even if it is empty', () => {
  const o = copy()
  o.weeks[1].block_name = 'Mellemblok'
  o.weeks[2].block_name = o.weeks[3].block_name = 'Grundstyrke'
  const m = compareBlocks(o)
  assert.equal(m.previous, 'Mellemblok, uge 2 til 2')
  assert.equal(m.lifts[0].before, null)
  assert.equal(m.lifts[0].now.e1rm, 127)
})

test('counterexample: malformed program and absent current block fail closed', () => {
  for (const mutate of [o => { o.weeks[1].start_date = '2026-02-30' },
    o => { o.weeks[1].id = 'w1' }, o => { o.today = '2027-01-01' },
    o => { o.weeks[1].block_name = 'Deload' }]) {
    const o = copy(); mutate(o)
    assert.equal(compareBlocks(o).status, 'unknown')
  }
})

test('counterexample: future and cross block timestamps do not create estimates', () => {
  for (const date of ['2026-11-01T10:00:00Z', '2026-10-06T10:00:00Z']) {
    const o = copy(); o.logs[3].logged_at = date
    assert.equal(compareBlocks(o).lifts[0].now, null)
  }
})

test('counterexample: inputs remain unchanged and shuffled inputs give same values', () => {
  const o = copy(), before = JSON.stringify(o), m = compareBlocks(o)
  assert.equal(JSON.stringify(o), before)
  assert.deepEqual(compareBlocks({ ...o, weeks: [...o.weeks].reverse(), logs: [...o.logs].reverse() }), m)
})
