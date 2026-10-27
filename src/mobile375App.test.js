import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './athlete/kost2Loader.mjs'
import { reset, begin, nodes } from './athlete/kost2Dom.mjs'
import { athleteViewUrl } from './athlete/kost2Paths.mjs'
const hooks = install()
const { default: AthleteView } = await import(athleteViewUrl.href)
test.after(() => hooks.deregister())
test('actual athlete OFF omits every hook; true enables root/page without losing navigation', () => {
  for (const flag of [undefined, false, null, 0, 1, 'true', true]) {
    reset({}); begin()
    const tree = AthleteView({ forenklinger: flag })
    const roots = nodes(tree, n => Object.hasOwn(n.props || {}, 'data-app-375'))
    const pages = nodes(tree, n => Object.hasOwn(n.props || {}, 'data-app-375-page'))
    assert.equal(roots.length, flag === true ? 1 : 0)
    assert.equal(pages.length, flag === true ? 1 : 0)
    const home = nodes(tree, n => n.type?.name === 'HjemTab')[0]
    assert.ok(home)
    home.props.setTab('program'); begin()
    const next = AthleteView({ forenklinger: flag })
    assert.equal(nodes(next, n => n.type?.name === 'BundNav')[0].props.tab, 'program')
  }
})
