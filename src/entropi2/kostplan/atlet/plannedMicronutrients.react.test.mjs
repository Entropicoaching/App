import test from 'node:test'
import assert from 'node:assert/strict'
import { seeded, mounted, nutrientFold, nutrientRows, micros, freeze, athleteId, date, all, propsOf, tick, act, h, StrictMode } from './plannedMicronutrients.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { byKey, hostFixture, button } from '../../nutrition/diaryTemplate.fixture.mjs'
import { createRoot } from 'react-dom/client'
import UpcomingPlan from './UpcomingPlan.mjs'

const labels = { ironMg: 'Jern', calciumMg: 'Calcium', magnesiumMg: 'Magnesium', zincMg: 'Zink', potassiumMg: 'Kalium',
  sodiumMg: 'Natrium', vitaminDUg: 'D-vitamin', vitaminB12Ug: 'B12', folateUg: 'Folat' }
const complete = { Jern: '3,51 mg', Calcium: '176 mg', Magnesium: '52,7 mg', Zink: '1,76 mg', Kalium: '352 mg',
  Natrium: '87,9 mg', 'D-vitamin': '0 µg', B12: '0,879 µg', Folat: '35,2 µg' }
const unknown = 'Ukendt – mangler data'
const unknownRows = Object.fromEntries(Object.keys(complete).map(label => [label, unknown]))
const click = async (host, label) => {
  const node = button(host, label); assert.ok(node, label)
  await act(async () => { await propsOf(node).onClick(); await tick() })
}
const sideEffects = f => ({ plan: f.plan.writes().length, storage: f.writes.length,
  diary: f.calls.filter(c => c.action !== 'select').length, rows: f.rows.length })

for (const kind of ['complete', 'zero', 'partial', 'missing']) test('actual mounted route Today and selected Future: ' + kind + ', fractional grams, explicit units, collapsed native disclosure and no display writes', async t => {
  const f = seeded(kind), original = JSON.stringify(f.plan.data), ui = await mounted(t, f)
  for (const selected of [date, '2026-11-06']) {
    if (selected !== date) await ui.choose(selected)
    const scope = selected === date ? ui.today() : ui.future()
    assert.ok(scope)
    const fold = nutrientFold(scope); assert.ok(fold)
    assert.equal(fold.getAttribute('open'), null)
    assert.ok(propsOf(all(fold, 'summary')[0]).style.minHeight >= 44)
    assert.match(fold.textContent, /Planlagte fødevarer i den godkendte planversion/)
    assert.match(fold.textContent, /ikke spist indtag eller dokumenteret dækning/)
    assert.match(fold.textContent, /Rettede gram og spist-markeringer ændrer ikke/)
    const expected = kind === 'missing' ? unknownRows : kind === 'partial' ? { ...complete, Jern: unknown }
      : kind === 'zero' ? Object.fromEntries(Object.keys(complete).map(key => [key, '0 ' + (['D-vitamin', 'B12', 'Folat'].includes(key) ? 'µg' : 'mg')])) : complete
    assert.deepEqual(nutrientRows(scope), expected)
    assert.match(fold.textContent, kind === 'missing' ? /Ingen mineral- eller vitaminsummer/ : kind === 'partial' ? /Kendte summer for 8 af 9 stoffer/ : /Kendte summer for 9 af 9 stoffer/)
    assert.doesNotMatch(fold.textContent, /RDA|%|tilskud|dosis/)
    assert.match(scope.textContent, /Væske og timing.*<b>Coachens ord<\/b>/s)
    assert.equal(all(scope, 'b').length, 0)
    const count = f.plan.calls.length, logs = f.calls.length, effects = sideEffects(f)
    await act(async () => { fold.open = true; fold.dispatch('toggle'); await tick() })
    assert.equal(f.plan.calls.length, count); assert.equal(f.calls.length, logs); assert.deepEqual(sideEffects(f), effects)
    if (selected !== date) {
      assert.equal(all(scope, 'input,form').length, 0)
      assert.deepEqual(all(scope, 'button').map(n => n.textContent), ['Hent planen igen'])
      await click(scope, 'Hent planen igen')
      assert.deepEqual(nutrientRows(ui.future()), expected)
    }
  }
  assert.equal(JSON.stringify(f.plan.data), original)
  assert.deepEqual(sideEffects(f), { plan: 0, storage: 0, diary: 0, rows: 0 })
})

test('actual mounted Today and Future: each single unknown nutrient suppresses its whole total, including a formerly complete zero', async t => {
  const f = seeded(), ui = await mounted(t, f)
  for (const key of Object.keys(micros)) {
    for (const index of [0, 1]) {
      const v = structuredClone(f.plan.data[tableNames[1]][index])
      Object.assign(v.meals[1].portions[0].food.nutrientsPer100g, micros)
      v.meals[1].portions[0].food.nutrientsPer100g[key] = null
      f.plan.data[tableNames[1]][index] = freeze(v)
    }
    await ui.choose(date); await click(ui.host, 'Hent kostplan igen')
    assert.equal(nutrientRows(ui.today())[labels[key]], unknown, key)
    assert.deepEqual(nutrientRows(ui.today()), { ...complete, [labels[key]]: unknown })
    await ui.choose('2026-11-06')
    assert.equal(nutrientRows(ui.future())[labels[key]], unknown, key)
    assert.deepEqual(nutrientRows(ui.future()), { ...complete, [labels[key]]: unknown })
  }
  assert.deepEqual(sideEffects(f), { plan: 0, storage: 0, diary: 0, rows: 0 })
})

test('actual route: approved plantal stay fixed through edited/eaten grams; unsaved tracker draft survives future browsing', async t => {
  const f = seeded(), original = JSON.stringify(f.plan.data), ui = await mounted(t, f)
  const gram = all(ui.today(), 'input').find(n => n.getAttribute('aria-label') === 'Frokost <syntetisk>: Syntetisk mad (g)')
  await act(async () => { propsOf(gram).onChange({ currentTarget: { value: '12,5' } }); await tick() })
  assert.deepEqual(nutrientRows(ui.today()), complete)
  await click(ui.today(), 'Spist med rettede gram')
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].kcal, 13)
  assert.match(ui.today().textContent, /1 af 2 måltider spist/)
  assert.deepEqual(nutrientRows(ui.today()), complete)
  const tracker = all(ui.host, '[data-entropi2-kost]')[0], field = byKey(ui.host, 'field-Måltid')
  field.value = 'Ugemt manuel kostlog'; field.dispatch('input', { target: field })
  const protein = byKey(ui.host, 'field-Protein (g)'); protein.value = '12,5'; protein.dispatch('input', { target: protein })
  const second = all(ui.today(), 'input').find(n => n.getAttribute('aria-label') === 'Aftensmad: Syntetisk mad 2 (g)')
  await act(async () => { propsOf(second).onChange({ currentTarget: { value: '22,75' } }); await tick() })
  const stableField = byKey(ui.host, 'field-Måltid'), stableProtein = byKey(ui.host, 'field-Protein (g)')
  const calls = f.calls.length, writes = f.writes.length, planWrites = f.plan.writes().length
  await ui.choose('2026-11-06'); assert.deepEqual(nutrientRows(ui.future()), complete)
  assert.ok(all(ui.host, '[data-entropi2-kost]')[0] === tracker, 'Tracker host retained')
  assert.ok(byKey(ui.host, 'field-Måltid') === stableField, 'Manual input retained while browsing'); assert.equal(stableField.value, 'Ugemt manuel kostlog')
  await ui.choose(date); assert.deepEqual(nutrientRows(ui.today()), complete)
  assert.ok(byKey(ui.host, 'field-Protein (g)') === stableProtein, 'Protein input retained while browsing'); assert.equal(stableProtein.value, '12,5')
  assert.equal(propsOf(all(ui.today(), 'input').find(n => n.getAttribute('aria-label') === 'Aftensmad: Syntetisk mad 2 (g)')).value, '22,75')
  assert.equal(f.calls.length, calls); assert.equal(f.writes.length, writes); assert.equal(f.plan.writes().length, planWrites)
  assert.equal(JSON.stringify(f.plan.data), original)
})

for (const changed of ['date', 'athlete', 'client', 'OFF', 'missing-athlete']) test('actual Today owner replacement: late old response cannot leak nutrients after ' + changed, async t => {
  let release, holding = true
  const gate = new Promise(resolve => { release = resolve })
  const f = seeded('complete', { before: call => holding && call.table === tableNames[1] && call.limit !== 0 ? gate : undefined })
  t.after(() => release())
  const ui = await mounted(t, f); assert.equal(ui.today(), undefined)
  if (changed === 'date') ui.props.date = '2026-11-04'
  if (changed === 'athlete') ui.props.athlete = { id: 'synthetic-other' }
  if (changed === 'client') ui.props.client = seeded('missing').client
  if (changed === 'OFF') ui.props.enabled = false
  if (changed === 'missing-athlete') ui.props.athlete = null
  holding = false; await ui.render()
  await act(async () => { release(); await tick() })
  if (ui.today()) assert.deepEqual(nutrientRows(ui.today()), unknownRows)
  else assert.equal(nutrientFold(ui.host), undefined)
  if (['OFF', 'missing-athlete'].includes(changed)) assert.equal(ui.host.textContent, '')
  assert.deepEqual(sideEffects(f), { plan: 0, storage: 0, diary: 0, rows: 0 })
})

for (const changed of ['date', 'athlete', 'client']) test('actual Future owner replacement clears already visible sums and discards delayed old reload after ' + changed, async t => {
  const f = seeded(), other = seeded('missing'), dom = hostFixture(), root = createRoot(dom.host)
  let release, holding = false
  const held = new Promise(resolve => { release = resolve })
  f.plan.options.before = call => holding && call.table === tableNames[1] && call.limit !== 0 ? held : undefined
  const props = { athleteId, today: date, date: '2026-11-06', client: f.client }
  const render = async () => act(async () => { root.render(h(StrictMode, null, h(UpcomingPlan, props))); await tick() })
  t.after(async () => { try { release(); await act(async () => { root.unmount(); await tick() }) } finally { dom.restore() } })
  await render(); assert.deepEqual(nutrientRows(dom.host), complete)
  holding = true
  let pending
  await act(async () => { pending = propsOf(button(dom.host, 'Hent planen igen')).onClick(); await tick() })
  assert.equal(nutrientFold(dom.host), undefined, 'Loading removes prior nutrient section')
  if (changed === 'date') {
    const next = structuredClone(other.plan.data[tableNames[1]][1])
    next.id = '30000000-0000-4000-8000-000000000004'; next.version_no = 3; next.effective_from = '2026-11-07'
    f.plan.data[tableNames[1]].push(freeze(next))
    f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: next.id })
    props.date = '2026-11-07'
  }
  if (changed === 'athlete') props.athleteId = 'synthetic-other'
  if (changed === 'client') props.client = other.client
  holding = false
  await render()
  const confirmed = dom.host.textContent
  await act(async () => { release(); await pending; await tick() })
  assert.equal(dom.host.textContent, confirmed)
  if (changed === 'athlete') assert.equal(nutrientFold(dom.host), undefined)
  else assert.deepEqual(nutrientRows(dom.host), unknownRows)
  assert.deepEqual(sideEffects(f), { plan: 0, storage: 0, diary: 0, rows: 0 })
})

test('actual Future reload replaces version nutrients and clears evidence for empty/unavailable/error; guards never invent a total', async t => {
  const f = seeded(), ui = await mounted(t, f)
  await ui.choose('2026-11-06'); assert.deepEqual(nutrientRows(ui.future()), complete)
  const v = structuredClone(f.plan.data[tableNames[1]][1]); v.id = '30000000-0000-4000-8000-000000000004'; v.version_no = 3
  for (const meal of v.meals) for (const portion of meal.portions) Object.assign(portion.food.nutrientsPer100g, { ...micros, ironMg: 0 })
  f.plan.data[tableNames[1]].push(freeze(v))
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: v.id, approved_at: date + 'T12:00:01Z' })
  await click(ui.future(), 'Hent planen igen'); assert.equal(nutrientRows(ui.future()).Jern, '0 mg')
  for (const kind of ['unavailable', 'read-error', 'empty']) {
    if (kind === 'unavailable') f.plan.options.missing = true
    if (kind === 'read-error') { f.plan.options.missing = false; f.plan.options.error = '42501' }
    if (kind === 'empty') { f.plan.options.error = null; f.plan.data[tableNames[2]].length = 0 }
    await click(ui.future(), 'Hent planen igen')
    assert.equal(nutrientFold(ui.future()), undefined)
    assert.match(ui.future().textContent, kind === 'unavailable' ? /ikke tilgængelige/ : kind === 'read-error' ? /kunne ikke hentes/ : /ingen godkendt/)
  }
  assert.deepEqual(sideEffects(f), { plan: 0, storage: 0, diary: 0, rows: 0 })
})
