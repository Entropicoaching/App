import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Import the delivered module; only React host-element creation is synthetic.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./SessionFeelingView.mjs', import.meta.url).href) {
    return { url: new URL('../../analysis/reactElementFixture.mjs', import.meta.url).href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { default: SessionFeeling } = await import('./SessionFeelingView.mjs')
hooks.deregister()
const children = node => [node?.props?.children].flat().filter(x => x != null && x !== false)
const all = node => typeof node === 'object' && node ? [node, ...children(node).flatMap(all)] : []
const find = (tree, type) => all(tree).filter(node => node.type === type)
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : children(node).map(text).join(' ')
const scope = JSON.stringify(['synthetic-athlete', 'plan-a', 'session-a'])

test('OFF does not read input; absent scope is inert; disabled and read-only handlers cannot emit', () => {
  const poison = { enabled: false, get scope() { assert.fail('OFF scope read') }, get value() { assert.fail('OFF value read') } }
  assert.equal(SessionFeeling(), null); assert.equal(SessionFeeling(poison), null)
  for (const enabled of [undefined, 0, 1, 'true']) assert.equal(SessionFeeling({ enabled, scope }), null)
  for (const bad of ['', ' ', undefined, 12]) assert.equal(SessionFeeling({ enabled: true, scope: bad }), null)
  let calls = 0
  for (const props of [{ disabled: true, onChange: () => calls++ }, {}]) {
    const tree = SessionFeeling({ enabled: true, scope, value: { rpe: 8, energy: 3 }, onComplete: () => calls++, ...props })
    assert.equal(tree.props.disabled, true)
    for (const field of [...find(tree, 'select'), ...find(tree, 'textarea')]) {
      assert.equal(field.props.disabled, true); field.props.onChange({ target: { value: '1' } })
    }
    find(tree, 'button')[0].props.onClick()
  }
  assert.equal(calls, 0)
})

test('actual view: select answers, edit note, clear, rerender and complete with scoped normalized result', () => {
  let value = {}, complete = [], changes = []
  const render = () => SessionFeeling({ enabled: true, scope, value,
    onChange: (key, draft) => { assert.equal(key, scope); value = draft; changes.push(draft) },
    onComplete: (...args) => complete.push(args) })
  let tree = render()
  assert.equal(find(tree, 'button')[0].props.disabled, true)
  find(tree, 'button')[0].props.onClick(); assert.equal(complete.length, 0)
  find(tree, 'select')[0].props.onChange({ target: { value: '0' } }); tree = render()
  assert.equal(find(tree, 'select')[0].props.value, 0)
  find(tree, 'select')[1].props.onChange({ target: { value: '1' } }); tree = render()
  find(tree, 'textarea')[0].props.onChange({ target: { value: '  Nok for i dag  ' } }); tree = render()
  assert.equal(find(tree, 'button')[0].props.disabled, false)
  assert.equal(complete.length, 0) // editing is never completion
  find(tree, 'button')[0].props.onClick()
  assert.deepEqual(complete, [[scope, { rpe: 0, energy: 1, note: 'Nok for i dag' }]])
  find(tree, 'select')[0].props.onChange({ target: { value: '' } }); tree = render()
  assert.equal(find(tree, 'button')[0].props.disabled, true)
  assert.equal(changes.at(-1).energy, '1'); assert.equal(changes.at(-1).note, '  Nok for i dag  ')
})

test('invalid values, missing completion callback and identity replacement', () => {
  let calls = 0
  for (const value of [{ rpe: 8, energy: 3, note: 'x'.repeat(281) }, { rpe: 11, energy: 2 }, { rpe: 8, energy: 9 }]) {
    const tree = SessionFeeling({ enabled: true, scope, value, onChange() {}, onComplete() { calls++ } })
    assert.ok(all(tree).some(n => n.props.role === 'alert'))
    assert.equal(find(tree, 'button')[0].props.disabled, true)
    find(tree, 'button')[0].props.onClick()
  }
  const noCallback = SessionFeeling({ enabled: true, scope, value: { rpe: 8, energy: 3 }, onChange() {} })
  assert.equal(find(noCallback, 'button')[0].props.disabled, true)
  find(noCallback, 'button')[0].props.onClick()
  const next = SessionFeeling({ enabled: true, scope: 'other-session', value: {}, onChange() {} })
  assert.deepEqual(find(next, 'select').map(n => n.props.value), ['', ''])
  assert.equal(find(next, 'textarea')[0].props.value, '')
  assert.equal(calls, 0)
})

test('native labels and scales, safe text, no nested form, mobile targets and explicit contrast', () => {
  const tree = SessionFeeling({ enabled: true, scope, value: { note: '<b>Kun tekst</b>' }, onChange() {} })
  assert.equal(find(tree, 'legend').map(text)[0], 'Hvordan var passet?')
  assert.equal(find(tree, 'label').length, 3)
  for (const label of find(tree, 'label')) assert.equal(find(label, 'select').length + find(label, 'textarea').length, 1)
  const selects = find(tree, 'select')
  assert.deepEqual(find(selects[0], 'option').map(n => n.props.value), ['', ...Array.from({ length: 21 }, (_, i) => i / 2)])
  assert.deepEqual(find(selects[1], 'option').map(n => n.props.value), ['', 1, 2, 3, 4, 5])
  assert.match(text(tree), /0 = ingen anstrengelse.*10 = maksimal anstrengelse/)
  assert.match(text(tree), /Energi efter passet/)
  assert.equal(find(tree, 'textarea')[0].props.maxLength, 280)
  assert.equal(find(tree, 'textarea')[0].props.value, '<b>Kun tekst</b>')
  assert.ok(all(tree).every(n => !n.props.dangerouslySetInnerHTML))
  assert.equal(find(tree, 'form').length, 0)
  assert.equal(find(tree, 'button')[0].props.type, 'button')
  const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0)
  for (const n of [tree, ...selects, ...find(tree, 'textarea'), ...find(tree, 'button')]) {
    const style = n.props.style, a = luminance(style.color), b = luminance(style.background)
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5)
    if (n !== tree) assert.ok(style.minHeight >= 44)
    assert.equal(style.outline, undefined) // native keyboard focus stays intact
  }
  assert.equal(tree.props.style.minWidth, 0)
})
