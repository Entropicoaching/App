import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './vaerd5Loader.mjs'
import { mount, text, nodes } from './vaerd5Dom.mjs'
install()
const { default: ProgramTab } = await import('./ProgramTab.jsx')
const { fixture, saveWarmupOverride } = await import('./vaerd5Fixture.mjs')
const label = 'Din lokale rettelse af opvarmningen'
const render = f => mount(ProgramTab, f.props).render()
const skipButtons = tree => nodes(tree,
  n => n.type === 'button' && n.props.title === 'Spring dette opvarmningssæt over')

test('positive control: UTF-8 selector finds actual expanded warmup skip buttons', () => {
  const f = fixture({ vaerdF6: true })
  f.save()
  assert.equal(skipButtons(render(f)).length, 2)
})

test('counterexample: another athlete or exercise never receives the badge', () => {
  const f = fixture({ vaerdF6: true })
  f.save()
  f.props.athlete = { id: 'synthetic-b' }
  assert.ok(!text(render(f)).includes(label))
  f.props.athlete = { id: 'synthetic-a' }
  f.ex.name = 'Bench'
  assert.ok(!text(render(f)).includes(label))
})

test('counterexample: correction outside working-weight tolerance falls back to model', () => {
  const f = fixture({ vaerdF6: true })
  f.save()
  f.ex.recommended_weight = 106
  assert.ok(!text(render(f)).includes(label))
  assert.ok(text(render(f)).includes('60kg'))
  f.ex.recommended_weight = 105
  assert.ok(text(render(f)).includes(label))
})

test('counterexample: failed storage write and malformed entry cannot imply saved data', () => {
  const f = fixture({ vaerdF6: true })
  assert.equal(saveWarmupOverride('synthetic-a', 'Squat', 100, f.model,
    { setItem() { throw Error('synthetic full storage') } }), false)
  assert.ok(!text(render(f)).includes(label))
  f.save()
  for (const key of f.storage.keys()) f.storage.set(key, '{broken')
  assert.ok(!text(render(f)).includes(label))
})

test('counterexample: collapsed and fully skipped warmup retain local scope without extra sets', () => {
  for (const expanded of [false, true]) {
    const f = fixture({ vaerdF6: true,
      exWarmupExpanded: new Set(expanded ? ['ex1'] : []) })
    if (expanded) f.save([])
    else f.save()
    const tree = render(f)
    assert.ok(text(tree).includes(label))
    assert.equal(skipButtons(tree).length, 0)
    assert.equal(f.props.suggestWarmupOverride('synthetic-a', 'Squat', 100).length,
      expanded ? 0 : 2)
    assert.equal(f.writes.length, 0)
  }
})

test('counterexample: existing edit handler still writes the entered weight and keeps working weight', () => {
  const f = fixture({ vaerdF6: true, warmupSetEditing: 'ex1_1' })
  f.save()
  const input = nodes(render(f), n => n.type === 'input' && n.props.defaultValue === 55)[0]
  assert.ok(input)
  input.props.onBlur({ target: { value: '52,5' } })
  assert.equal(f.writes.length, 1)
  const [athlete, name, weight, sets] = f.writes[0]
  assert.deepEqual([athlete, name, weight], ['synthetic-a', 'Squat', 100])
  assert.equal(sets[1].weight, 52.5)
  assert.equal(sets[1].warmupOverride.anbefalet, 60)
  assert.equal(f.ex.recommended_weight, 100)
})
