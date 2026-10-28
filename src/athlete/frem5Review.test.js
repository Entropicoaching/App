import { install } from './frem5Loader.mjs'
install()
import test from 'node:test'
import assert from 'node:assert/strict'
const { blockStrength, renderBlockStrength } = await import('./blokStyrke.mjs')
const { fixture } = await import('./frem5Fixture.mjs')
import { createElement as h, nodes, text } from './frem5Dom.mjs'

test('counterexample: selecting an older Program week does not change the current dated block', () => {
  const f = fixture()
  f.currentWeek = f.allWeeks[0]
  f.fremgangLogs = [f.row(), f.row(0, 0, { weight: 999 })]
  const m = blockStrength(f)
  assert.equal(m.name, 'Styrke')
  assert.deepEqual(m.lifts[0].weeks.map(w => w.number), [4, 5, 6, 7])
  assert.equal(m.lifts[0].weeks[0].best.e1rm, 110)
})

test('counterexample: deload and missing date evidence are holes, not positive strength', () => {
  const f = fixture()
  f.allWeeks.slice(3, 7).forEach(w => { w.block_name = 'Deload' })
  f.fremgangLogs = [f.row()]
  let m = blockStrength(f)
  assert(m.lifts.every(l => l.weeks.every(w => w.best === null)))
  const missing = fixture(); missing.allWeeks[3].start_date = null
  assert.equal(blockStrength(missing).status, 'unknown')
})

test('counterexample: a one-week block and constant values still draw finite isolated points', () => {
  const f = fixture()
  f.allWeeks[5].block_name = 'Single'
  f.fremgangLogs = [f.row(5)]
  const dom = renderBlockStrength(h, { ...f, enabled: true })
  assert.equal(nodes(dom, n => n.type === 'circle').length, 1)
  assert.equal(nodes(dom, n => n.type === 'polyline').length, 0)
  for (const n of nodes(dom, n => n.type === 'circle')) assert(Number.isFinite(n.props.cx) && Number.isFinite(n.props.cy))
  assert.match(text(dom), /Uge 6: estimeret 1RM 110 kg/)
})

test('counterexample: a local skip and a timestamp in the wrong program week never resurrect history', () => {
  const f = fixture()
  f.fremgangLogs = [f.row(5, 0, { weight: 999 })]
  f.exerciseLogs = [f.row(5, 0, { skipped: true }), f.row(3, 0, { weight: 999 })]
  assert(blockStrength(f).lifts[0].weeks.every(w => w.best === null))
  f.exerciseLogs = [f.row(5, 0, { logged_at: f.allWeeks[4].start_date })]
  assert(blockStrength(f).lifts[0].weeks.every(w => w.best === null))
})

test('counterexample: full SVG labels provide values when the curve has gaps', () => {
  const f = fixture(); f.fremgangLogs = [f.row(), f.row(5)]
  const dom = renderBlockStrength(h, { ...f, enabled: true })
  const svg = nodes(dom, n => n.type === 'svg')[0]
  assert.equal(svg.props.role, 'img')
  assert.match(svg.props['aria-label'], /Squat.*estimeret 1RM/)
  assert.equal(nodes(svg, n => n.type === 'text').length, 4)
  assert.equal(nodes(svg, n => n.type === 'polyline').length, 0)
  assert.match(text(dom), /Uge 7: ingen måling/)
})
