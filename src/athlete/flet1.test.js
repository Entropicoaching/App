import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './kost2Loader.mjs'
import { athleteViewUrl } from './kost2Paths.mjs'
import { reset, begin, nodes } from './kost2Dom.mjs'

// Execute the actual final AthleteView and its actual navigation modules.
// React hooks and unrelated services are inert synthetic dependencies.
const hooks = install()
const { default: AthleteView } = await import(athleteViewUrl.href)
test.after(() => hooks.deregister())
const component = (tree, name) => nodes(tree, n => n.type?.name === name)[0]
const draft = Object.freeze({ sleep: '7,5', energy: 3, note: 'synthetic' })
const render = props => { begin(); return AthleteView(props) }
const home = tree => component(tree, 'LazyEnkelHjemTab') || component(tree, 'HjemTab')

test('Flet: actual final home keeps all Friday props and defers the simple module', () => {
  for (const simple of [false, true]) {
    reset({ readinessInput: draft })
    const tree = render({ enkelPrototype: simple, forenklinger: true })
    const node = home(tree)
    assert.ok(node)
    assert.strictEqual(node.props.readinessInput, draft)
    assert.equal(node.props.taskShortcuts, !simple)
    assert.equal(typeof node.props.setMsgTrack, 'function')
    assert.equal(typeof node.props.setTab, 'function')
    assert.ok(node.props.kostCompact)
    if (simple) {
      const boundary = node.type(node.props)
      assert.equal(boundary.props.label, 'Hjem')
      assert.strictEqual(boundary.props.componentProps, node.props)
      assert.equal(typeof boundary.props.factory, 'function')
    }
  }
})

test('Flet: actual final handlers close readiness, filter Kost and preserve draft in both modes', () => {
  for (const simple of [false, true]) {
    for (const destination of ['program', 'beskeder', 'fremgang', 'kost', 'hjem']) {
      reset({ readinessInput: draft, readinessOpen: true })
      const props = { enkelPrototype: simple, kostPerAtlet: true, kostValg: {} }
      home(render(props)).props.setTab(destination)
      const after = render(props)
      assert.equal(nodes(after, n => n.props?.label === 'Kost').length, 0)
      // Return through the actual final navigation after leaving Home.
      const nav = simple ? nodes(after, n => n.type === 'button')[0] : component(after, 'BundNav')
      assert.ok(nav)
      if (simple) {
        nodes(after, n => n.type === 'button' && n.props?.key === 'hjem')[0].props.onClick()
      } else nav.props.setTab('hjem')
      const back = home(render(props))
      assert.ok(back)
      assert.equal(back.props.readinessOpen, false)
      assert.strictEqual(back.props.readinessInput, draft)
    }
  }
})

test('Flet: truthy prototype values retain default home and Friday shortcut opt-in stays strict', () => {
  for (const value of [undefined, null, false, 0, 1, 'true']) {
    reset({ readinessInput: draft })
    const tree = render({ enkelPrototype: value, forenklinger: value })
    assert.ok(component(tree, 'HjemTab'))
    assert.equal(home(tree).props.taskShortcuts, false)
    assert.strictEqual(home(tree).props.readinessInput, draft)
  }
})
