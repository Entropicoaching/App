// Required real React gate, discovered by the app's npm test. No substitute/skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalNutritionReport } from './PortalPlan.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { coachPlanView } from './view.mjs'
import { recipeItems } from './connections.mjs'
import { catalogFoods } from './model.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { RECIPES } from '../opskrifter/index.mjs'
import { input, coach, athleteId } from '../rapport/reportFixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'

const props = { enabled: true, coachId: coach.id, athlete: { id: athleteId, bodyweight: 80, protein_target: 150 }, date: '2026-11-08' }
const receipt = () => ({ ...input(), coachId: coach.id, state: 'ready', complete: true })

test('real React report is folded and scoped, compares day/week targets, and has no fabricated data on stale/empty input', () => {
  const render = nutritionRead => renderToStaticMarkup(h(PortalNutritionReport, { ...props, nutritionRead }))
  const html = render(receipt())
  assert.match(html, /^<details><summary[^>]*>Kostrapport<\/summary>/)
  assert.doesNotMatch(html, /<details[^>]* open/)
  assert.match(html, /Ugens kost/); assert.match(html, /3.500 kcal/); assert.match(html, /4.000 kcal plan for loggede dage/)
  for (const read of [undefined, { ...receipt(), mealLogs: [] }, { ...receipt(), plans: [] },
    { ...receipt(), planHistory: 'unavailable', plans: undefined },
    { ...receipt(), plans: receipt().plans.map(plan => ({ ...plan, status: 'draft' })) }, { ...receipt(), date: '2026-11-07' },
    { ...receipt(), coachId: 'foreign' }, { ...receipt(), state: 'loading' }]) assert.equal(render(read), '')
  assert.match(render({ ...receipt(), weightLogs: undefined }), /role="alert"/)
  assert.equal(PortalNutritionReport({ enabled: false, get nutritionRead() { throw Error('OFF read') } }), null)
})

test('real React meal controls replace recipes, update protein marks and save only a namespaced device draft', async () => {
  const storage = memoryStorage()
  const { controller: c } = openPortalPlan({ ...props, storage: () => storage,
    template: RECIPES.slice(0, 3).map((recipe, i) => ({ id: `synthetic-${i}`, name: `<synthetic-${i}>`,
      items: recipeItems(recipe.id, catalogFoods(FOODS)) })) })
  c.set('maintenanceKcal', 2400); c.set('fat', 70); assert.equal(c.generate(), true)
  const walk = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props.children].flat(Infinity).flatMap(walk)]
  const tree = () => walk(coachPlanView(h, c.snapshot(), c))
  const render = () => renderToStaticMarkup(coachPlanView(h, c.snapshot(), c))
  assert.match(render(), /&lt;synthetic-0&gt;/)
  assert.equal(tree().filter(n => n.type === 'small').length, 3)
  const kcal = c.snapshot().totals.kcal
  tree().find(n => n.props.name === 'recipe-1').props.onChange({ currentTarget: { value: 'tofu-ris' } })
  assert.ok(Math.abs(c.snapshot().totals.kcal - kcal) < 1e-8)
  c.snapshot().meals[0].items.forEach((_, i) => c.editGrams(0, i, '1'))
  assert.match(render(), /Proteinfordeling: under pejlemærke/)
  assert.equal(storage.data.size, 0)
  await tree().find(n => n.type === 'button' && n.props.children === 'Gem som kladde').props.onClick()
  assert.deepEqual([...storage.data.keys()], [draftKey(coach.id, athleteId, props.date)])
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
  assert.doesNotMatch(render(), /Planen er aktiveret|Ugens kost/)
})
