// Actual copied portal and handlers with synthetic hooks, never a React gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage } from './portal.fixture.mjs'
import { s } from '../../../dashboardShared.js'
import { FOODS } from '../foedevarer/index.mjs'

const root = new URL('../../../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: PortalPlan } = await import('./PortalPlan.mjs')
hooks.deregister()
const props = { enabled: true, athlete: { id: 'synthetic-a', protein_target: 150 },
  today: '2026-11-05', session: { user: { id: 'synthetic-coach' } } }
const named = (tree, name) => nodes(tree).find(n => n.props.name === name)
const button = (tree, title) => nodes(tree).find(n => n.type === 'button' && text(n) === title)
const change = (tree, name, value) => named(tree, name).props.onChange({ currentTarget: { value } })
function checkFields(tree) {
  const fields = nodes(tree).filter(n => ['input', 'select'].includes(n.type))
  assert.ok(fields.length)
  for (const field of fields) {
    assert.equal(field.props.style.background, s.fieldInput.background)
    assert.equal(field.props.style.color, s.fieldInput.color)
    assert.equal(field.props.style.border, s.fieldInput.border)
    assert.equal(field.props.style.colorScheme, 'dark')
    assert.notEqual(field.props.style.outline, 'none')
    assert.equal(field.props.style.minWidth, 0)
    assert.equal(field.props.style.maxWidth, '100%')
    assert.equal(field.props.style.boxSizing, 'border-box')
    assert.ok(nodes(tree).some(label => label.type === 'label' && nodes(label).includes(field)))
  }
  for (const target of nodes(tree).filter(n => ['input', 'select', 'button', 'summary'].includes(n.type)))
    assert.ok(target.props.style.minHeight >= 44)
}

test('opened manual and bounded templates style every field and add/remove/generate without implicit writes', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    for (const athlete of [props.athlete, { ...props.athlete, age: 30, bodyweight: 80, goal: 'maintain' }]) {
      const storage = memoryStorage()
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
      const screen = mount(PortalPlan, { ...props, athlete })
      let tree = screen.render()
      {
        // Source4: exact closed entry contract, before either catalogue is chosen.
        const closedEntry = tree
        assert.equal(text(closedEntry).trim(), 'Åbn kostplan med Frida-fødevarer Kostplan')
        const choices = nodes(closedEntry).filter(n => ['button', 'summary'].includes(n.type))
        assert.deepEqual(choices.map(n => [n.type, text(n)]), [
          ['button', 'Åbn kostplan med Frida-fødevarer'], ['summary', 'Kostplan'],
        ])
        assert.equal(choices[0].props.type, 'button')
        assert.equal(choices[0].props.disabled ?? false, false)
        assert.equal(choices[0].props.hidden ?? false, false)
        assert.equal(typeof choices[0].props.onClick, 'function')
        assert.ok(choices.every(n => n.props.style.minHeight >= 44))
        assert.equal(nodes(closedEntry).filter(n => ['form', 'input', 'select', 'textarea'].includes(n.type)).length, 0)
        assert.ok(nodes(closedEntry).filter(n => n.type === 'details').every(n => !n.props.open))
      }
      assert.equal(storage.calls.length, 0)
      nodes(tree).find(node => node.type === 'details').props.onToggle({ currentTarget: { open: true } }); tree = screen.render()
      checkFields(tree)
      assert.equal(nodes(tree).find(node => node.type === 'details').props.className, 'e2-portal-plan')
      const css = nodes(tree).find(n => n.type === 'style').props.dangerouslySetInnerHTML.__html
      assert.match(css, /:is\(\.e2-coach-plan, \.e2-portal-plan\).*:focus-visible/)
      assert.match(css, /outline: 3px solid #c8923a;[\s\S]*outline-offset: 3px/)
      assert.match(css, /:disabled[\s\S]*opacity: \.65/)
      const adds = nodes(tree).filter(n => n.type === 'button' && text(n) === 'Tilføj fødevare')
      assert.equal(adds.length, 3)
      assert.equal(adds[0].props.style.background, s.card.background)
      adds[0].props.onClick(); tree = screen.render(); checkFields(tree)
      assert.ok(named(tree, 'template-food-0-1'))
      button(tree, 'Fjern fødevare').props.onClick(); tree = screen.render()
      assert.equal(named(tree, 'template-food-0-1'), undefined)
      const gram = athlete.age !== undefined
      if (!gram) {
        change(tree, 'maintenanceKcal', '2400'); change(tree, 'fat', '70')
        for (let mi = 0; mi < 3; mi++) {
          change(tree, `template-food-${mi}-0`, FOODS[0].id)
          change(tree, `template-grams-${mi}-0`, '100')
        }
        tree = screen.render()
      }
      const generate = button(tree, gram ? 'Generér forslag' : 'Brug måltider og generér dagsplan')
      assert.equal(generate.props.style.background, s.btnPrimary.background)
      assert.equal(generate.props.style.color, s.btnPrimary.color)
      assert.equal(generate.props.style.width, '100%')
      nodes(tree).find(n => n.type === 'form' && nodes(n).includes(generate)).props.onSubmit({ preventDefault() {} })
      tree = screen.render(); checkFields(tree)
      assert.ok(named(tree, 'grams-0-0'))
      assert.match(text(tree), /Dagens plan og mål/)
      assert.equal(storage.calls.filter(c => c[0] === 'set').length, 0)
      assert.ok(nodes(tree).filter(n => n.type === 'details').every(n => n.props.open == null))
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('styling keeps strict OFF inert for every disabled value', () => {
  for (const enabled of [false, undefined, null, 1, 'true'])
    assert.equal(PortalPlan({ enabled, get athlete() { throw Error('OFF data') } }), null)
})
