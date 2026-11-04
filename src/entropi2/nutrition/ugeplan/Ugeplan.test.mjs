// Real application React and server renderer. No replacement runtime/loader.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Ugeplan, UgeplanView } from './Ugeplan.mjs'
import { createWeekPlan } from './model.mjs'
import { createNutritionController, mealKey } from '../controller.mjs'

const template = { id: 'synthetic:meal', name: 'Min <skål>', meal: { meal: 'Skål', kcal: 400, protein: 25 },
  ingredients: [{ name: 'Havre', quantity: 50, unit: 'g' }] }
function setup(extra = {}) {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const props = { enabled: true, athleteId: 'synthetic:a', date: '2026-11-04',
    templates: [template], targets: { kcal: 2000, protein: 120 }, storage, ...extra }
  return { props, model: createWeekPlan(props) }
}
function nodes(element) {
  if (!isValidElement(element)) return []
  return [element, ...[element.props.children].flat(Infinity).flatMap(nodes)]
}
const html = model => renderToStaticMarkup(h(UgeplanView, { enabled: true, snapshot: model.snapshot() }))

test('real React shows seven days, daily targets and collapsed shopping, and escapes own names', () => {
  const { model } = setup()
  model.add(0, template.id); model.add(6, template.id)
  const markup = html(model)
  assert.match(markup, /400 kcal \/ 2.000 kcal/)
  assert.match(markup, /25 g protein \/ 120 g protein/)
  assert.match(markup, /Min &lt;skål&gt;/)
  assert.match(markup, /Havre: 100 g/)
  assert.match(markup, /<details><summary/)
  assert.doesNotMatch(markup, /<details open/)
  const tree = UgeplanView({ enabled: true, snapshot: model.snapshot() })
  assert.equal(nodes(tree).filter(node => node.type === 'select').length, 7)
  assert.equal(nodes(tree).filter(node => node.type === 'h3').length, 7)
})

test('real React change and remove handlers edit actual model and rerender totals', () => {
  const { model } = setup()
  const render = () => UgeplanView({ enabled: true, snapshot: model.snapshot(),
    onAdd: (day, id) => model.add(day, id), onRemove: (day, slot) => model.remove(day, slot) })
  const selector = nodes(render()).find(node => node.type === 'select')
  selector.props.onChange({ currentTarget: { value: template.id } })
  selector.props.onChange({ currentTarget: { value: template.id } })
  assert.match(html(model), /800 kcal/)
  const remove = nodes(render()).find(node => node.type === 'button')
  assert.match(remove.props['aria-label'], /Mandag, måltid 1/)
  remove.props.onClick()
  assert.match(html(model), /400 kcal/)
  assert.equal(model.snapshot().days[0].entries.length, 1)
})

test('empty and unavailable data stay honest; local draft is read by real hook component', () => {
  const { props, model } = setup({ templates: [], targets: {} })
  const markup = renderToStaticMarkup(h(Ugeplan, props))
  assert.match(markup, /ingen egne måltidsskabeloner/)
  assert.match(markup, /Ingen måltider planlagt/)
  assert.match(markup, /Ukendt kcal \/ mål mangler/)
  assert.match(markup, /Ingen ingredienser at vise/)
  assert.equal(model.snapshot().saved, false)
  const other = setup()
  other.model.add(0, template.id)
  assert.match(renderToStaticMarkup(h(Ugeplan, other.props)), /Gemt på denne enhed/)
})

test('read/write, setup and ingredient failures render explicit alerts; unreadable drafts disable editing', () => {
  const badStorage = { getItem() { throw Error('synthetic read failure') } }
  const { props, model } = setup({ storage: badStorage })
  assert.match(renderToStaticMarkup(h(Ugeplan, props)), /role="alert"/)
  assert.match(html(model), /ikke læses/)
  const selects = nodes(UgeplanView({ enabled: true, snapshot: model.snapshot() })).filter(n => n.type === 'select')
  assert.equal(selects.every(n => n.props.disabled), true)
  assert.match(renderToStaticMarkup(h(Ugeplan, { ...props, date: 'invalid' })), /kunne ikke åbnes/)
  const failedWrite = setup({ storage: { getItem: () => null, setItem() { throw Error('quota') } } }).model
  failedWrite.add(0, template.id)
  assert.match(html(failedWrite), /Ændringen blev ikke gemt/)
  const ingredients = setup({ templates: [{ ...template, ingredients: [{ name: 'X', quantity: -1, unit: 'g' }] }] }).model
  ingredients.add(0, template.id)
  assert.match(html(ingredients), /Indkøbslisten kunne ikke beregnes/)
})

test('missing ingredient warning, deleted template warning and strict OFF', () => {
  const { model } = setup({ templates: [{ ...template, ingredients: undefined }] })
  model.add(0, template.id)
  assert.match(html(model), /Listen er ufuldstændig/)
  const deleted = setup()
  deleted.model.add(0, template.id)
  const missing = createWeekPlan({ ...deleted.props, templates: [] })
  assert.match(html(missing), /Skabelon findes ikke længere/)
  assert.match(html(missing), /Listen er ufuldstændig/)
  for (const enabled of [undefined, false, null, 1, 'true']) {
    const props = { enabled, get storage() { throw Error('OFF read') },
      get snapshot() { throw Error('OFF snapshot read') } }
    assert.equal(Ugeplan(props), null)
    assert.equal(UgeplanView(props), null)
  }
  assert.equal(renderToStaticMarkup(h(Ugeplan)), '')
})

function screenInputs(t, { raw, storageError = false, writeError = false } = {}) {
  const athleteId = 'synthetic:screen', date = '2026-11-04'
  const meal = { meal: 'Min <ret>', kcal: 400, protein: 25, carb: 50, fat: 10 }
  const template = { id: mealKey(meal), name: meal.meal, meal }
  const data = new Map([[`entropi2:nutrition:skabeloner:v1:${encodeURIComponent(athleteId)}`,
    raw ?? JSON.stringify({ version: 1, templates: [template] })]])
  const writes = [], backend = []
  const storage = { getItem(key) { if (storageError) throw Error('synthetic read'); return data.get(key) ?? null },
    setItem(key, value) { if (writeError) throw Error('synthetic quota'); writes.push(key); data.set(key, value) } }
  const controller = createNutritionController({ enabled: true,
    athlete: { id: athleteId, kcal_target: 2000, protein_target: 120 }, date, storage,
    contracts: { load: async () => [], save: async value => { backend.push(value); return true } } })
  t.after(() => controller.dispose())
  return { controller, template, data, writes, backend }
}

test('real React screen inputs show saved days and targets, one weekly list, and no repeated Ugeplan heading', t => {
  const f = screenInputs(t), props = f.controller.weekPlanInputs(), model = createWeekPlan(props)
  model.add(0, f.template.id); model.add(6, f.template.id)
  const markup = renderToStaticMarkup(h(Ugeplan, props))
  assert.match(markup, /Min &lt;ret&gt;/)
  assert.match(markup, /400 kcal \/ 2.000 kcal/)
  assert.match(markup, /25 g protein \/ 120 g protein/)
  assert.equal((markup.match(/Ugens indkøbsliste/g) || []).length, 1)
  assert.doesNotMatch(markup, /<h2>Ugeplan/)
  assert.match(markup, /Listen er ufuldstændig: 2/)
  assert.doesNotMatch(markup, /Indkøb fra dine favoritter/)
  assert.equal(f.writes.every(key => key.startsWith('entropi2:nutrition:ugeplan:v1:')), true)
  assert.deepEqual(f.backend, [])
})

test('real React screen empty templates and source failure have distinct, honest output and no writes', t => {
  const empty = screenInputs(t, { raw: JSON.stringify({ version: 1, templates: [] }) })
  const markup = renderToStaticMarkup(h(Ugeplan, empty.controller.weekPlanInputs()))
  assert.match(markup, /ingen egne måltidsskabeloner/)
  assert.match(markup, /Ingen måltider planlagt/)
  assert.match(markup, /Ukendt kcal/)
  assert.match(markup, /Ingen ingredienser at vise/)
  for (const options of [{ raw: '{broken' }, { storageError: true }]) {
    const f = screenInputs(t, options), props = f.controller.weekPlanInputs()
    const failed = renderToStaticMarkup(h(Ugeplan, props))
    assert.match(failed, /role="alert"/)
    assert.match(failed, /Egne skabeloner kunne ikke læses/)
    assert.match(failed, /Hent skabeloner igen/)
    assert.doesNotMatch(failed, /ingen egne måltidsskabeloner|Ingen måltider planlagt/)
    assert.deepEqual(f.writes, [])
    const retry = nodes(Ugeplan(props)).find(node => node.type === 'button')
    assert.equal(retry.props.onClick, props.onRetry)
  }
  assert.deepEqual(empty.writes, [])
})

test('real React integrated draft read/write failures remain visible and offer read retry', t => {
  const f = screenInputs(t), props = f.controller.weekPlanInputs()
  const key = 'entropi2:nutrition:ugeplan:v1:synthetic%3Ascreen:2026-11-02'
  f.data.set(key, '{broken')
  const markup = renderToStaticMarkup(h(Ugeplan, props))
  assert.match(markup, /Ugekladden kunne ikke læses/)
  assert.match(markup, /Prøv at læse ugekladden igen/)
  assert.equal(f.data.get(key), '{broken')
  assert.deepEqual(f.writes, [])
  const quota = screenInputs(t, { writeError: true }), model = createWeekPlan(quota.controller.weekPlanInputs())
  assert.equal(model.add(0, quota.template.id), false)
  assert.match(html(model), /Ændringen blev ikke gemt/)
  assert.deepEqual(quota.backend, [])
})
