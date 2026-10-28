import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { install } from './frem3Loader.mjs'
import { mount, nodes } from './frem3Dom.mjs'
import { fixture } from './frem5Fixture.mjs'
install()
// Append a probe to actual imported modules; keep their source and imports intact.
registerHooks({ load(url, context, next) {
  const result = next(url, context)
  if (url === new URL('./FremgangTab.jsx', import.meta.url).href || url === new URL('./blokStyrke.mjs', import.meta.url).href)
    return { ...result, source: String(result.source) + '\nexport const rebaseProbe = specifier => import(specifier)\n' }
  return result
} })
const view = await import('./FremgangTab.jsx')
const strength = await view.rebaseProbe('./blokStyrke.mjs')
test('frem3Loader: actual new module and strict default OFF through actual component', () => {
  const f = fixture(new Date()); f.fremgangLogs = [f.row()]
  assert.equal(strength.blockStrength(f).lifts[0].weeks[0].best.e1rm, 110)
  const app = mount(view.default, f)
  for (const blokStyrke of [undefined, false, 'true', 1, null])
    assert.equal(nodes(app.render({ ...f, blokStyrke }), n => n.props['data-blok-styrke'] != null).length, 0)
  assert.equal(nodes(app.render({ ...f, blokStyrke: true }), n => n.props['data-blok-styrke'] != null).length, 1)
})
test('frem3Loader: unknown package, builtin, sibling, traversal and similar new-module imports remain forbidden', async () => {
  for (const specifier of ['unapproved-package', 'node:fs', './notApproved.mjs', '../athlete/blokStyrke.mjs', './blokStyrke.mjs?probe', './blokStyrke'])
    await assert.rejects(view.rebaseProbe(specifier), /Forbidden synthetic dependency/)
})
test('frem3Loader: new module only imports its three exact existing dependencies', async () => {
  for (const specifier of ['../exerciseProgress.js', '../calendarDate.js', '../inputValues.js'])
    assert.ok(await strength.rebaseProbe(specifier))
  for (const specifier of ['node:fs', './exerciseProgress.js', '../rekorder.js', '../notApproved.mjs', '../exerciseProgress', '../dataEvidence.mjs', '../athlete/../exerciseProgress.js'])
    await assert.rejects(strength.rebaseProbe(specifier), /Forbidden synthetic dependency/)
})
