import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoachPlan } from './controller.mjs'
import { coachPlanView } from './view.mjs'
import { syntheticInput, element, nodes, text } from './syntheticFixture.mjs'

function fixture(overrides) {
  const f = syntheticInput(overrides), model = createCoachPlan(f.options)
  return { ...f, model, render: () => coachPlanView(element, model.snapshot(), model) }
}
function one(tree, predicate) {
  const result = nodes(tree, predicate); assert.equal(result.length, 1); return result[0]
}
const named = (tree, name) => one(tree, node => node.props.name === name)
const button = (tree, title) => one(tree, node => node.type === 'button' && text(node) === title)
const generate = f => one(f.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} })

test('actual view edits goal and intensity, generates concrete grams and recalculates meal and day macros', async () => {
  const f = fixture()
  assert.match(text(f.render()), /Ingen aktiv dagsplan/)
  named(f.render(), 'goal').props.onChange({ currentTarget: { value: 'cut' } })
  named(f.render(), 'intensity').props.onChange({ currentTarget: { value: '15' } })
  generate(f); assert.equal(f.model.snapshot().planTargets.kcal, 2040)
  assert.equal(nodes(f.render(), node => node.type === 'table').length, 1)
  assert.equal(nodes(f.render(), node => node.type === 'fieldset').length, 4)
  assert.match(text(f.render()), /Ris, kogt/); assert.match(text(f.render()), /Gram af Kylling/)
  const before = f.model.snapshot().totals.kcal
  named(f.render(), 'grams-1-0').props.onChange({ currentTarget: { value: '200' } })
  assert.notEqual(f.model.snapshot().totals.kcal, before)
  named(f.render(), 'food-1-1').props.onChange({ currentTarget: { value: 'oats' } })
  assert.equal(f.model.snapshot().meals[1].items[1].food.id, 'oats')
  assert.equal(button(f.render(), 'Aktivér for atleten').props.disabled, true)
  await button(f.render(), 'Gem som kladde').props.onClick()
  assert.equal(button(f.render(), 'Aktivér for atleten').props.disabled, false)
  await button(f.render(), 'Aktivér for atleten').props.onClick()
  assert.match(text(f.render()), /Planen er aktiveret for atleten/)
  assert.match(text(f.render()), /Atleten har en aktiv dagsplan/)
  named(f.render(), 'grams-1-0').props.onChange({ currentTarget: { value: '201' } })
  assert.equal(button(f.render(), 'Aktivér for atleten').props.disabled, true)
  assert.match(text(f.render()), /Rettelserne er ikke gemt/)
  assert.equal(f.calls.length, 2)
})

test('invalid grams, changed targets and missing persistence are visible and cannot activate', () => {
  const f = fixture({ saveDraft: undefined, activatePlan: undefined })
  generate(f); named(f.render(), 'grams-0-0').props.onChange({ currentTarget: { value: '' } })
  assert.match(text(f.render()), /Kan ikke beregnes/)
  assert.equal(button(f.render(), 'Gem som kladde').props.disabled, true)
  assert.equal(button(f.render(), 'Aktivér for atleten').props.disabled, true)
  assert.match(text(f.render()), /Gemning er ikke tilgængelig/)
  named(f.render(), 'maintenanceKcal').props.onChange({ currentTarget: { value: '2600' } })
  assert.match(text(f.render()), /Generér en ny dagsplan før gemning/)
})

test('empty, loading, failed and foreign history have distinct honest output and collapsed context', async () => {
  const empty = fixture()
  assert.match(text(empty.render()), /Ingen tidligere planer eller respons/)
  for (const [history, expected] of [[undefined, /endnu ikke indlæst/],
    [{ athleteId: 'synthetic-athlete-a', state: 'error' }, /kunne ikke hentes/],
    [{ athleteId: 'foreign', state: 'ready', plans: [], responses: [] }, /kunne ikke hentes/]]) {
    const f = fixture({ history })
    assert.match(text(f.render()), expected)
    assert.doesNotMatch(text(f.render()), /Ingen tidligere planer eller respons|Ingen aktiv dagsplan/)
  }
  const f = fixture({ basis: undefined })
  assert.doesNotMatch(text(f.render()), /Ikke oplyst|Grundlag og tidligere erfaringer/)
  assert.equal(nodes(f.render(), node => node.type === 'details').every(node => node.props.open == null), true)
  generate(f); assert.match(text(f.render()), /Angiv gyldig/)
  assert.equal(nodes(f.render(), node => node.props.role === 'alert').length, 1)
})

test('history shows previous food grams, status and only the linked athlete response', async () => {
  const f = fixture(); generate(f); await f.model.save(); await f.model.activate()
  const history = structuredClone(f.model.snapshot().history)
  history.responses.push({ athleteId: history.athleteId, planId: history.plans[0].id,
    date: '2026-11-04', text: 'Syntetisk respons: nem plan' })
  const next = fixture({ history })
  const out = text(next.render())
  assert.match(out, /Atletens respons: Syntetisk respons: nem plan/)
  assert.match(out, /2026-11-04 · Aktiv · Vedligehold/)
  assert.match(out, /g Ris, kogt/)
  assert.doesNotMatch(out, /Ingen respons fra atleten endnu/)
  assert.equal(next.calls.length, 0)
})

test('accessible controls have labels, touch sizes, responsive wrapping and pending write feedback', async () => {
  let resolve
  const pending = new Promise(r => { resolve = r })
  const f = fixture({ saveDraft: () => pending }); generate(f)
  for (const label of nodes(f.render(), node => node.type === 'label')) {
    assert.equal(nodes(label, node => ['input', 'select'].includes(node.type)).length, 1)
    assert.ok(text(label).trim())
  }
  for (const node of nodes(f.render(), node => ['input', 'select', 'button', 'summary'].includes(node.type)))
    assert.ok(node.props.style.minHeight >= 44)
  const saving = button(f.render(), 'Gem som kladde').props.onClick()
  assert.match(text(f.render()), /Gemmer kladde/)
  assert.equal(f.render().props['aria-busy'], true)
  assert.equal(button(f.render(), 'Gem som kladde').props.disabled, true)
  assert.equal(nodes(f.render(), node => node.type === 'fieldset').every(node => node.props.disabled), true)
  resolve(false); await saving
  assert.match(text(f.render()), /ikke bekræftet gemt/)
  assert.equal(f.render().props['aria-busy'], false)
})

test('OFF view produces no tree, reads no actions and cannot write', () => {
  assert.equal(coachPlanView(() => { throw Error('unexpected element') }, null,
    new Proxy({}, { get() { throw Error('unexpected action') } })), null)
})

test('context displays only actual values and hides an empty context fold', () => {
  const f = fixture({ basis: { athleteId: 'synthetic-athlete-a', date: '2026-11-04',
    context: { weightTrend: 'Syntetisk vægttrend', training: '  ', nutrition: null } } })
  const tree = f.render()
  const context = nodes(tree, n => n.type === 'details' && /Grundlag og tidligere erfaringer/.test(text(n)))
  assert.equal(context.length, 1)
  assert.match(text(context[0]), /Syntetisk vægttrend/)
  assert.equal(nodes(context[0], n => n.type === 'dt').length, 1)
  assert.doesNotMatch(text(tree), /Ikke oplyst/)
})
