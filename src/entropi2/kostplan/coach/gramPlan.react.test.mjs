// Required real React gate, discovered by the app's existing npm test runner.
// Dependency errors are intentional failures, never replaced by fixture React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PortalPlan from './PortalPlan.mjs'
import CoachPlan from './CoachPlan.mjs'
import { coachPlanView } from './view.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { strengthDays } from '../generator/days.fixture.mjs'
import { FOODS } from '../foedevarer/catalog.mjs'

const scope = { enabled: true, coachId: 'synthetic-coach', date: '2026-11-05',
  athlete: { id: 'synthetic-adult', age: 30, bodyweight: 80, goal: 'maintain' } }
const walk = node => !isValidElement(node) ? [] : [node, ...[node.props.children].flat(Infinity).flatMap(walk)]

test('real React exposes method assumptions before generation and retains a short visible review step', () => {
  const { controller: c } = openPortalPlan({ ...scope, storage: () => memoryStorage(),
    template: ['Morgenmad', 'Frokost', 'Aftensmad'].map((name, i) => ({ id: `synthetic-${i}`, name, items: [] })) })
  const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller: c }))
  const method = html => html.match(/<details><summary[^>]*>Om forslaget<\/summary>([\s\S]*?)<\/details>/)
  const initial = render()
  assert.ok(method(initial)); assert.match(method(initial)[1], /hviledag som standard|5–300 g/)
  assert.match(initial, /Vælg dagens mål/)
  assert.equal(c.generate(), true)
  const generated = render()
  assert.equal((generated.match(/>Om forslaget<\/summary>/g) ?? []).length, 1)
  assert.match(method(generated)[1], /Dagens tolerance/)
  assert.match(generated.replace(method(generated)[0], ''), /Gennemgå fødevarer og portioner før gemning/)
  assert.doesNotMatch(generated, /<details[^>]* open/)
})

test('real React events generate bounded grams, render escaped meals and live signed macro differences, then save locally', async () => {
  const storage = memoryStorage(), template = strengthDays()[2].input.meals
  template[0].name = '<synthetic-meal>'
  const { controller: c } = openPortalPlan({ ...scope, template, storage: () => storage })
  const tree = () => walk(coachPlanView(h, c.snapshot(), c))
  // The local portal's first generation is PortalPlan's own template form, which
  // calls controller.generate(template); the shared view form only regenerates.
  assert.equal(c.generate(), true)
  assert.ok(c.snapshot().meals.length); assert.equal(storage.data.size, 0)
  const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller: c,
    athleteId: scope.athlete.id, date: scope.date }))
  assert.match(render(), /&lt;synthetic-meal&gt;/)
  assert.match(render(), /Afvigelse|Dagens tolerance/)
  tree().find(n => n.props.name === 'grams-0-0').props.onChange({ currentTarget: { value: '123,5' } })
  assert.match(render(), /rettede portioner/)
  for (const [key, unit] of [['kcal', 'kcal'], ['protein', 'g'], ['carb', 'g'], ['fat', 'g']]) {
    const delta = c.snapshot().totals[key] - c.snapshot().planTargets[key]
    assert.ok(render().includes(`${delta > 0 ? '+' : ''}${delta.toLocaleString('da-DK', { maximumFractionDigits: 1 })} ${unit}`))
  }
  await tree().find(n => n.type === 'button' && n.props.children === 'Gem som kladde').props.onClick()
  assert.deepEqual([...storage.data.keys()], [draftKey(scope.coachId, scope.athlete.id, scope.date)])
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
  assert.match(render(), /Lokal kladde gemt/); assert.doesNotMatch(render(), /Aktivér for atleten|Planen er aktiveret/)
  tree().find(n => n.props.name === 'minGrams-0-0').props.onChange({ currentTarget: { value: '45' } })
  assert.equal(tree().find(n => n.props.children === 'Gem som kladde').props.disabled, true)
  tree().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(c.snapshot().meals[0].items[0].minGrams, 45)
  assert.ok(!/<details[^>]* open/.test(render()))
})

test('real React preserves the collapsed host, strict OFF and selected-athlete guards', () => {
  assert.equal(renderToStaticMarkup(h(PortalPlan, { enabled: false })), '')
  const props = { enabled: true, athlete: scope.athlete, today: scope.date, session: { user: { id: scope.coachId } } }
  const html = renderToStaticMarkup(h(PortalPlan, props))
  assert.match(html, /<summary[^>]*>Kostplan/); assert.doesNotMatch(html, /Generér forslag|Afvigelse|<details[^>]* open/)
  const { controller } = openPortalPlan({ ...scope, storage: () => memoryStorage() })
  assert.equal(renderToStaticMarkup(h(CoachPlan, { enabled: true, controller, athleteId: 'synthetic-other' })), '')
})

test('real React renders one short catalogue reason per food and removes it after a coach food change', () => {
  const storage = memoryStorage()
  const template = [{ id: 'm', name: '<synthetic-empty>', items: [] }]
  const { controller: c } = openPortalPlan({ ...scope, template, storage: () => storage })
  assert.equal(c.generate(), true)
  const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller: c }))
  assert.match(render(), /&lt;synthetic-empty&gt;/)
  const first = c.snapshot().meals[0].items[0].food
  assert.equal(first.name, 'Kyllingebryst')
  const reason = 'Protein med essentielle aminosyrer; andre kilder kan dække behovet.'
  assert.ok(render().includes(reason))
  assert.ok(!render().includes(FOODS.find(food => food.id === first.id).prioritetBegrundelse))
  const choices = walk(coachPlanView(h, c.snapshot(), c))
  choices.find(node => node.props.name === 'food-0-0').props.onChange({ currentTarget: { value: 'local:Sukker' } })
  assert.ok(!render().includes(reason))
  assert.ok(!/<details[^>]* open/.test(render()))
  assert.equal(storage.data.size, 0)
})

test('real React shows four distinct named meals, preserves regenerated choices and writes only the scoped local draft', async () => {
  const storage = memoryStorage()
  const template = ['Morgenmad', 'Frokost', 'Aftensmad', 'Mellemmåltid'].map((name, i) =>
    ({ id: `synthetic-${i}`, name, items: [] }))
  const { controller: c } = openPortalPlan({ ...scope, template, storage: () => storage })
  assert.equal(c.generate(), true)
  const selected = c.snapshot().meals.map(meal => meal.items.map(item => item.food.name))
  assert.deepEqual(selected, [['Skyr naturel', 'Havregryn'], ['Kyllingebryst', 'Ris kogt', 'Broccoli'],
    ['Laks fersk', 'Linser kogte', 'Broccoli'], ['Skyr naturel']])
  const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller: c }))
  assert.equal((render().match(/<legend>/g) ?? []).length, 5)
  assert.equal((render().match(/Mælkeprotein; leucinmængden er ikke registreret\./g) ?? []).length, 2)
  assert.doesNotMatch(render(), /Katalogets begrundelse:|højeste kendte protein|variation er ikke koblet ind/)
  assert.ok(!/<details[^>]* open/.test(render())); assert.equal(storage.data.size, 0)
  assert.equal(c.generate(), true)
  assert.deepEqual(c.snapshot().meals.map(meal => meal.items.map(item => item.food.name)), selected)
  await c.save()
  assert.deepEqual([...storage.data.keys()], [draftKey(scope.coachId, scope.athlete.id, scope.date)])
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
})
