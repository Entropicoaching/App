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
  assert.match(markup, /Notér dine måltider i dagbogen/)
  assert.doesNotMatch(markup, /Ingen måltider planlagt/)
  assert.doesNotMatch(markup, /Ukendt|mål mangler|<h3/)
  assert.doesNotMatch(markup, /Ingen ingredienser at vise|Ugens indkøbsliste/)
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
  assert.doesNotMatch(html(model), /Listen er ufuldstændig|Ugens indkøbsliste/)
  const deleted = setup()
  deleted.model.add(0, template.id)
  const missing = createWeekPlan({ ...deleted.props, templates: [] })
  assert.match(html(missing), /Skabelon findes ikke længere/)
  assert.doesNotMatch(html(missing), /Listen er ufuldstændig|Ugens indkøbsliste|Ukendt|mål mangler/)
  assert.equal(nodes(UgeplanView({ enabled: true, snapshot: missing.snapshot() })).filter(n => n.type === 'button').length, 1)
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

test('real React screen inputs show saved days and targets, no empty ingredient list, and no repeated Ugeplan heading', t => {
  const f = screenInputs(t), props = f.controller.weekPlanInputs(), model = createWeekPlan(props)
  model.add(0, f.template.id); model.add(6, f.template.id)
  const markup = renderToStaticMarkup(h(Ugeplan, props))
  assert.match(markup, /Min &lt;ret&gt;/)
  assert.match(markup, /400 kcal \/ 2.000 kcal/)
  assert.match(markup, /25 g protein \/ 120 g protein/)
  assert.equal((markup.match(/Ugens indkøbsliste/g) || []).length, 0)
  assert.doesNotMatch(markup, /<h2>Ugeplan/)
  assert.doesNotMatch(markup, /Listen er ufuldstændig|Ingen ingredienser at vise/)
  assert.doesNotMatch(markup, /Indkøb fra dine favoritter/)
  assert.equal(f.writes.every(key => key.startsWith('entropi2:nutrition:ugeplan:v1:')), true)
  assert.deepEqual(f.backend, [])
})

test('real React screen empty templates and source failure have distinct, honest output and no writes', t => {
  const empty = screenInputs(t, { raw: JSON.stringify({ version: 1, templates: [] }) })
  const markup = renderToStaticMarkup(h(Ugeplan, empty.controller.weekPlanInputs()))
  assert.match(markup, /Notér dine måltider i dagbogen/)
  assert.doesNotMatch(markup, /Ingen måltider planlagt/)
  assert.doesNotMatch(markup, /Ukendt|mål mangler|<h3/)
  assert.doesNotMatch(markup, /Ingen ingredienser at vise|Ugens indkøbsliste/)
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

test('real React empty week has one useful template path and no empty days, local status or shopping fold', () => {
  const { model } = setup({ templates: [] })
  const markup = html(model)
  assert.equal((markup.match(/Notér dine måltider i dagbogen/g) || []).length, 1)
  assert.doesNotMatch(markup, /<h3|<select|Ingen gemt|Ingen måltider planlagt|Ukendt|mål mangler|Ugens indkøbsliste/)
})

test('real React selectable empty days omit calculations; known zero and absent targets stay distinct', () => {
  const { model } = setup({ targets: {}, templates: [{ ...template, meal: { ...template.meal, kcal: 0, protein: null } }] })
  assert.doesNotMatch(html(model), /kcal|g protein|Ukendt|mål mangler|Ingen måltider planlagt/)
  model.add(0, template.id)
  const markup = html(model)
  assert.match(markup, /0 kcal/)
  assert.doesNotMatch(markup, /g protein|Ukendt|mål mangler/)
})

test('real React partial ingredient list contains only known items and an explicit partial warning', () => {
  const { model } = setup({ templates: [template, { ...template, id: 'synthetic:missing-ingredients', ingredients: undefined }] })
  model.add(0, template.id); model.add(1, 'synthetic:missing-ingredients')
  const markup = html(model)
  assert.equal((markup.match(/Ugens indkøbsliste/g) || []).length, 1)
  assert.match(markup, /Havre: 50 g/)
  assert.match(markup, /Listen er ufuldstændig: 1/)
  assert.doesNotMatch(markup, /Ingen ingredienser at vise/)
})

test('real React removed template remains removable and replaceable without read-time draft writes', () => {
  const { model, props } = setup()
  model.add(0, template.id)
  const writes = []
  const replacement = { ...template, id: 'synthetic:replacement', name: 'Ny ret' }
  const restored = createWeekPlan({ ...props, templates: [replacement], storage: {
    getItem: key => props.storage.getItem(key),
    setItem: (key, value) => { writes.push(key); props.storage.setItem(key, value) },
  } })
  const render = () => UgeplanView({ enabled: true, snapshot: restored.snapshot(),
    onRemove: (day, slot) => restored.remove(day, slot), onAdd: (day, id) => restored.add(day, id) })
  assert.match(renderToStaticMarkup(render()), /Skabelon findes ikke længere/)
  assert.doesNotMatch(renderToStaticMarkup(render()), /Ukendt|mål mangler|Ugens indkøbsliste/)
  assert.deepEqual(writes, [])
  nodes(render()).find(n => n.type === 'button').props.onClick()
  nodes(render()).find(n => n.type === 'select').props.onChange({ currentTarget: { value: replacement.id } })
  assert.equal(restored.snapshot().days[0].entries[0].templateId, replacement.id)
  assert.equal(writes.every(key => key.startsWith('entropi2:nutrition:ugeplan:v1:')), true)
})
