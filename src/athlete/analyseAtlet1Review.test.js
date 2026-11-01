import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load, mount, nodes, text } from './analyseAtlet1Harness.mjs'
const RealDate = Date
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-01T12:00:00Z'])) } }
const entryNames = ['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'fremgangFokus.mjs']
const r = (day, weight, more = {}) => ({ logged_at: day, weight, reps_completed: 5, exercises: { name: 'Squat' }, ...more })
const good = [r('2026-10-04', 80), r('2026-10-11', 85), r('2026-10-18', 90), r('2026-10-25', 95)]
const metrics = tree => nodes(tree, n => n.props['data-analyse-metric'])
for (const name of entryNames) {
  const Component = (await load(name)).default
  test(name + ': DOM counterexamples for threshold and isolated series', () => {
    for (const rows of [good.slice(1), good.map((v, i) => i ? v : r('2026-10-05', 80)),
      good.map((v, i) => i ? v : { ...v, reps_completed: 6 }),
      good.map((v, i) => i ? v : { ...v, exercises: { name: 'Front squat' } }),
      [good[0], good[1], ...Array(12).fill(good[2])], good.map(v => ({ ...v, weight: 90 }))]) {
      const tree = mount(Component, { rel1101: true, fremgangLogs: rows }).render()
      assert.equal(metrics(tree).filter(n => n.props['data-analyse-metric'] === 'good').length, 0)
      assert.match(text(tree), /Log tunge sæt|ingen stigning/)
    }
    assert.equal(metrics(mount(Component, { rel1101: true, fremgangLogs: good }).render()).filter(n => n.props['data-analyse-metric'] === 'good').length, 1)
  })
  test(name + ': focus DOM counts only actual dated current-week positions', () => {
    const week = { start_date: '2026-10-26', block_name: 'Teknik', sessions: [{ exercises: [{ id: 'e', name: 'Squat' }] }] }
    const base = { rel1101: true, fremgangLogs: [], currentWeek: week }
    for (const exerciseLogs of [undefined, [], [r('2026-10-30', 100, { exercise_id: 'e', set_number: 1, skipped: true })],
      [r('2026-10-25', 100, { exercise_id: 'e', set_number: 1 })],
      [r('2026-10-30', Infinity, { exercise_id: 'e', set_number: 1 })]]) {
      const tree = mount(Component, { ...base, exerciseLogs }).render()
      const focus = nodes(tree, n => n.props['aria-labelledby'] === 'analyse-atlet1-focus')[0]
      assert.equal(metrics(focus).length, 0)
      assert.match(text(focus), /Teknik/); assert.match(text(focus), /log vægt og gentagelser/)
    }
  })
  test(name + ': DOM rejects invalid arrays, stale/future measurements and all nonfinite inputs', () => {
    for (const hs of [undefined, {}, [null], [r('2026-10-31', Infinity)], [r('2026-10-31', 'Infinity')],
      [r('2026-10-31', 100, { reps_completed: NaN })], [r('2026-10-31', 100, { deload: true })],
      [r('2026-11-02', 100)], [r('2026-09-01', 100)], [r('2026-02-30', 100)]]) {
      const tree = mount(Component, { rel1101: true, fremgangLogs: hs, exerciseLogs: 'bad', currentWeek: { sessions: {} } }).render()
      assert.equal(metrics(tree).length, 0)
      assert.doesNotMatch(text(tree), /NaN|Infinity|undefined/)
      assert.match(text(tree), /Log|logge/)
    }
  })
}
test('frozen input remains untouched across actual component renders', async () => {
  function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) } return v }
  const props = freeze({ rel1101: true, fremgangLogs: good, allWeeks: [], exerciseLogs: [] })
  const before = JSON.stringify(props)
  for (const name of entryNames) mount((await load(name)).default, props).render()
  assert.equal(JSON.stringify(props), before)
})
test('static scope, source identity, strict helper and no added I/O', () => {
  const helper = readFileSync(new URL('./analyseAtlet1.mjs', import.meta.url), 'utf8')
  assert.match(helper, /import \{ rel1101Enabled \} from '\.\.\/rel1101.mjs'/)
  assert.doesNotMatch(helper, /fetch\(|supabase|localStorage|sessionStorage|process\.env|XMLHttpRequest/)
})
