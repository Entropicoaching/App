import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './frem5Loader.mjs'
import { mount, nodes, button, io } from './frem5Dom.mjs'
import { fixture } from './frem5Fixture.mjs'
install()
const { default: Full } = await import('./FremgangTab.jsx')
const { default: Simple } = await import('./EnkelFremgangTab.jsx')
const { default: Focus } = await import('./fremgangFokus.mjs')
const count = tree => nodes(tree, n => n.props['data-blok-styrke'] != null).length
// Handlers are recreated on render; compare their source, then exercise handlers below.
const snapshot = tree => JSON.stringify(tree, (_key, value) => typeof value === 'function' ? value.toString() : value)
const falseFlags = [undefined, false, null, 0, 1, 'true', {}, []]
for (const Component of [Full, Simple, Focus]) {
  test(Component.name + ': both flags coexist and OFF preserves exact synthetic tree', () => {
    const f = fixture(new Date())
    const p = { ...f, fremgangLogs: [f.row()], weightLogs: [], repRecords: true }
    const app = mount(Component, p)
    const baseline = snapshot(app.render())
    for (const blokStyrke of falseFlags) assert.equal(snapshot(app.render({ ...p, blokStyrke })), baseline)
    assert.equal(count(app.render({ ...p, blokStyrke: true })), 1)
    assert.equal(io.rpc, 0)
  })
}
test('focus detail handler keeps records and never duplicates block chart', () => {
  const f = fixture(new Date())
  const app = mount(Focus, { ...f, fremgangLogs: [f.row()], weightLogs: [], blokStyrke: true, repRecords: true })
  button(app.render(), 'Se alle detaljer').props.onClick()
  const tree = app.render()
  assert.equal(count(tree), 1)
  assert.equal(nodes(tree, n => n.type === 'table').length, 4)
})
test('all four actual AthleteView lazy-prop objects forward strict flags and retain base props', () => {
  const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  const objects = source.match(/\{ blokStyrke: blokStyrke === true[^{}]*currentWeek \}/g)
  assert.equal(objects.length, 4)
  const values = { personalRecords: true, fremgangLinjer: true, athlete: { id: 'synthetic' }, enkelOn: true,
    weightLogs: [], route: 'styrke', fremgangLogs: [], fremgangLoading: false, allWeeks: [], exerciseLogs: [], currentWeek: {} }
  for (const expression of objects) {
    for (const blokStyrke of [...falseFlags, true]) {
      const scope = { ...values, blokStyrke, repRecords: true, blokFremgang: true }
      const result = Function(...Object.keys(scope), 'return (' + expression + ')')(...Object.values(scope))
      assert.equal(result.blokStyrke, blokStyrke === true)
      assert.equal(result.blokFremgang, true)
      assert.equal(result.personalRecords, true)
      assert.equal(result.enkelDel, 'styrke')
      assert.equal(result.currentWeek, values.currentWeek)
      if (expression.includes('repRecords:')) assert.equal(result.repRecords, true)
    }
  }
  assert.match(source, /programNaesteUge = false/)
  assert.match(source, /videoSetSelection = VIDEO_SET_SELECTION_ENABLED/)
  assert.match(source, /programIntensityHelp = false/)
})
