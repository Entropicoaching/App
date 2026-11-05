import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

export async function checkLoader(loaderName, domName) {
  const { install } = await import('./' + loaderName)
  const { mount, nodes, text } = await import('./' + domName)
  install()
  const entries = ['FremgangTab.jsx', 'EnkelFremgangTab.jsx']
  const targets = [...entries, 'analyseAtlet1.mjs', '../rel1101.mjs'].map(n => new URL(n, import.meta.url).href)
  registerHooks({ load(url, context, next) {
    const result = next(url, context)
    return targets.includes(url) ? { ...result, source: String(result.source) + '\nexport const analysisProbe = specifier => import(specifier)\n' } : result
  } })
  const views = await Promise.all(entries.map(n => import('./' + n)))
  const helper = await views[0].analysisProbe('./analyseAtlet1.mjs')
  const release = await helper.analysisProbe('../rel1101.mjs')
  const props = { fremgangLogs: [], exerciseLogs: [], allWeeks: [], currentWeek: { sessions: [] } }
  test(loaderName + ': actual exports, model and release contract', () => {
    for (const view of views) assert.equal(typeof view.default, 'function')
    for (const name of ['analyseAtlet1Enabled', 'analyseAtlet1Model', 'renderAnalyseAtlet1']) assert.equal(typeof helper[name], 'function')
    assert.deepEqual(helper.analyseAtlet1Model(props).map(a => a.key), ['status', 'good', 'focus'])
    assert.equal(release.DEFAULT_REL1101, false)
  })
  test(loaderName + ': actual components default OFF and strict nonboolean gates', () => {
    for (const view of views) for (const rel1101 of [undefined, false, 'true', '1', 1, null, {}]) {
      const tree = mount(view.default, { ...props, rel1101 }).render()
      assert.equal(nodes(tree, n => n.props['data-analyse-atlet1']).length, 0)
    }
  })
  test(loaderName + ': real helper renders the three analysis questions through both components', () => {
    for (const view of views) {
      const tree = mount(view.default, { ...props, rel1101: true }).render()
      assert.equal(nodes(tree, n => n.props['data-analyse-atlet1']).length, 1)
      assert.equal(nodes(tree, n => n.type === 'h2').length, 3)
      assert.match(text(tree), /Hvor står jeg\?/)
      assert.match(text(tree), /Hvad går godt\?/)
      assert.match(text(tree), /Hvad arbejder vi med nu\?/)
      assert.equal(nodes(tree, n => n.props['data-analyse-metric']).length, 0)
    }
  })
  test(loaderName + ': entry rejects unknown and alternate analysis spellings', async () => {
    for (const specifier of ['node:fs', 'unapproved-package', './notApproved.mjs', './analyseAtlet1', '../athlete/analyseAtlet1.mjs', './analyseAtlet1.mjs?probe'])
      await assert.rejects(views[0].analysisProbe(specifier), /Forbidden|Closed/)
  })
  test(loaderName + ': helper admits its four original dependencies and the pure count helper', async () => {
    for (const name of ['rel1101.mjs', 'calendarDate.js', 'inputValues.js', 'exerciseProgress.js', 'entropi2/antalOrd.mjs']) assert.ok(await helper.analysisProbe('../' + name))
    for (const specifier of ['node:fs', 'react', './calendarDate.js', '../calendarDate', '../athlete/../calendarDate.js', '../calendarDate.js?probe', '../rekorder.js'])
      await assert.rejects(helper.analysisProbe(specifier), /Forbidden analysis dependency/)
  })
  test(loaderName + ': leaf release module has no fallback for new imports', async () => {
    for (const specifier of ['node:fs', '../calendarDate.js', './inputValues.js', 'react'])
      await assert.rejects(release.analysisProbe(specifier), /Forbidden release dependency/)
  })
}
