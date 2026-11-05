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

test('real React renders catalogue reasons for empty-meal suggestions and removes a reason after a coach food change', () => {
  const storage = memoryStorage()
  const template = [{ id: 'm', name: '<synthetic-empty>', items: [] }]
  const { controller: c } = openPortalPlan({ ...scope, template, storage: () => storage })
  assert.equal(c.generate(), true)
  const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller: c }))
  assert.match(render(), /&lt;synthetic-empty&gt;/)
  const first = c.snapshot().meals[0].items[0].food
  const reason = FOODS.find(food => food.id === first.id).prioritetBegrundelse
  assert.ok(render().includes(reason))
  const choices = walk(coachPlanView(h, c.snapshot(), c))
  choices.find(node => node.props.name === 'food-0-0').props.onChange({ currentTarget: { value: 'local:Sukker' } })
  assert.ok(!render().includes(reason))
  assert.ok(!/<details[^>]* open/.test(render()))
  assert.equal(storage.data.size, 0)
})
