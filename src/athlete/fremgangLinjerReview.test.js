// Fresh counterexamples against the final exported module and DOM renderer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fremgangLinjer, renderFremgangLinjer } from './fremgangLinjer.mjs'

const now = '2026-10-25T12:00:00Z'
const row = (weight, logged_at, name = 'Squat') => ({ weight, reps_completed: 3, logged_at, exercises: { name } })
const h = (tag, props, ...children) => ({ tag, props, children })
test('review: offset timestamps sort by instant, not lexical date', () => {
  const rows = [row(100, '2026-10-20T23:30:00-02:00'), row(200, '2026-10-21T00:00:00+02:00')]
  assert.equal(fremgangLinjer({ fremgangLogs: rows, now })[0].latest.weight, 100)
})
test('review: Copenhagen calendar date is used even around midnight', () => {
  const r = fremgangLinjer({ fremgangLogs: [row(100, '2026-10-20T23:30:00Z')], now })[0]
  assert.equal(r.latest.day, '2026-10-21')
})
test('review: absent metadata and a hundred historical days cannot invent block start', () => {
  const logs = Array.from({ length: 100 }, (_, i) => row(100 + i, new Date(Date.UTC(2026, 5, 1 + i)).toISOString()))
  const r = fremgangLinjer({ fremgangLogs: logs, now })[0]
  assert.equal(r.mode, 'raw'); assert.equal(r.latest.weight, 199)
})
test('review: new flag cannot be enabled by truthy strings or numbers', () => {
  for (const enabled of ['1', 'true', 1, {}, []]) assert.equal(renderFremgangLinjer(h, { enabled }), null)
})
test('review: unknown exercises and variants cannot create main-lift DOM rows', () => {
  const dom = renderFremgangLinjer(h, { enabled: true, now,
    fremgangLogs: ['Front squat', 'Pause bænkpres', 'Rumænsk dødløft', 'Unknown'].map(n => row(500, '2026-10-20', n)) })
  assert.equal(dom.children.length, 1)
  assert.equal(dom.children[0].children[0], 'Du har ikke logget et hovedløft endnu.')
})
test('review: comma decimal values are raw facts without fabricated estimates', () => {
  const dom = renderFremgangLinjer(h, { enabled: true, now, fremgangLogs: [row('102,5', '2026-10-20')] })
  assert.equal(dom.children[0].children[0], 'Squat: seneste sæt 102,5 kg × 3 (2026-10-20)')
})
test('review: the actual renderer has no interactive controls or writes', () => {
  const logs = [row(100, '2026-10-20')], before = structuredClone(logs)
  const dom = renderFremgangLinjer(h, { enabled: true, now, fremgangLogs: logs })
  const visit = n => {
    if (typeof n !== 'object') return
    assert.ok(['section', 'p'].includes(n.tag))
    assert.ok(Object.keys(n.props || {}).every(k => !k.startsWith('on')))
    n.children.forEach(visit)
  }
  visit(dom); assert.deepEqual(logs, before)
})
