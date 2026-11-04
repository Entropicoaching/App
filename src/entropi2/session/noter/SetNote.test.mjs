import test from 'node:test'
import assert from 'node:assert/strict'
import SetNote from './SetNote.mjs'

const children = node => [node?.props?.children].flat().filter(Boolean)
const all = node => [node, ...children(node).flatMap(all)].filter(n => typeof n === 'object')
const find = (tree, type) => all(tree).filter(node => node.type === type)
const text = node => typeof node === 'string' ? node : children(node).map(text).join(' ')
const scope = JSON.stringify(['synthetic-a', 'plan-a', 'lift-a_1'])

test('OFF and missing identity render nothing; read-only controls cannot emit patches', () => {
  let calls = 0
  assert.equal(SetNote(), null)
  assert.equal(SetNote({ scope, onChange: () => calls++ }), null)
  assert.equal(SetNote({ enabled: true, scope: '' }), null)
  for (const props of [{ disabled: true, onChange: () => calls++ }, {}]) {
    const tree = SetNote({ enabled: true, scope, ...props })
    assert.equal(tree.props.disabled, true)
    find(tree, 'button')[0].props.onClick()
    find(tree, 'textarea')[0].props.onChange({ target: { value: 'Forsøg' } })
  }
  assert.equal(calls, 0)
})

test('actual component emits scoped note patches, toggles one choice and supports clearing', () => {
  let value = {}, patches = []
  const render = () => SetNote({ enabled: true, scope, value, onChange: (key, draft, patch) => {
    assert.equal(key, scope); value = draft; patches.push(patch)
  } })
  let tree = render()
  assert.deepEqual(find(tree, 'button').map(text), ['Let', 'Tungt', 'Smerte', 'Teknik'])
  find(tree, 'button')[1].props.onClick(); tree = render()
  assert.equal(find(tree, 'button')[1].props['aria-pressed'], true)
  find(tree, 'textarea')[0].props.onChange({ target: { value: 'Sidste rep' } }); tree = render()
  assert.deepEqual(patches.at(-1), { note: 'Tungt: Sidste rep' })
  find(tree, 'button')[3].props.onClick(); tree = render()
  assert.equal(find(tree, 'button')[1].props['aria-pressed'], false)
  assert.equal(find(tree, 'button')[3].props['aria-pressed'], true)
  find(tree, 'button')[3].props.onClick(); tree = render()
  find(tree, 'textarea')[0].props.onChange({ target: { value: '' } })
  assert.deepEqual(patches.at(-1), { note: '' })
})

test('labels, form safety, mobile wrapping, controlled identity and model-enforced paste limit', () => {
  const calls = [], props = { enabled: true, scope, value: { choice: 'Let', text: '<b>tekst</b>' },
    onChange: (...args) => calls.push(args) }
  const tree = SetNote(props)
  assert.equal(find(tree, 'legend').map(text)[0], 'Note til sættet (valgfri)')
  assert.equal(find(tree, 'label').length, 1)
  assert.equal(find(find(tree, 'label')[0], 'textarea').length, 1)
  assert.ok(find(tree, 'button').every(n => n.props.type === 'button' && n.props.style.minHeight >= 44))
  assert.equal(find(tree, 'div')[0].props.style.flexWrap, 'wrap')
  const field = find(tree, 'textarea')[0]
  assert.equal(field.props.maxLength, 140)
  assert.equal(field.props.value, '<b>tekst</b>')
  assert.ok(all(tree).every(n => !n.props?.dangerouslySetInnerHTML))
  field.props.onChange({ target: { value: 'x'.repeat(200) } })
  assert.equal(calls[0][1].text.length, 140)
  assert.equal(calls[0][2].note, `Let: ${'x'.repeat(140)}`)
  const next = SetNote({ ...props, scope: 'other-plan-set', value: {} })
  assert.equal(find(next, 'textarea')[0].props.value, '')
  assert.ok(find(next, 'button').every(n => n.props['aria-pressed'] === false))
  assert.match(text(tree), /Noten gemmes sammen med sættet, når du godkender det/)
  assert.equal(find(tree, 'form').length, 0)
})
