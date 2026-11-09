// Real ReactDOM/StrictMode, actual normal coach host and MealDraftImport.
// Only public synthetic foods, controllers and the existing local DOM fixture.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { createFood, FOODS } from '../foedevarer/index.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { createCoachPlan } from './controller.mjs'
import { syntheticInput } from './syntheticFixture.mjs'

const boundary = registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context)
  if (result.url.endsWith('/supabase.js')) throw Error('Production client forbidden in macro tests')
  return result
} })
test.after(() => boundary.deregister())
const title = 'Energi og makroer pr. 100 g'
const unknown = 'Ukendt – mangler data'
const props = { enabled: true, today: '2026-11-08',
  athlete: { id: 'macro-athlete-83', age: 29, bodyweight: 81, goal: 'maintain' },
  session: { user: { id: 'macro-coach-83' } } }
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const edit = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const panel = (ui, line = 1) => ui.host.querySelectorAll('details').find(n => n.firstChild?.textContent === `Næringsgrundlag for valgt fødevare ${line} i måltid 1`)
const section = shown => shown.querySelectorAll('section').find(n => n.querySelectorAll('h4').some(h => h.textContent === title))
const macroRows = shown => {
  const part = section(shown)
  assert.ok(part, 'Mounted selected food lacks the named macro section')
  return part.querySelectorAll('li').map(n => n.textContent)
}
const microRows = shown => shown.querySelectorAll('dl')[0].querySelectorAll('dd').map(n => n.textContent)
const noWrites = storage => assert.equal(storage.calls.filter(([a]) => a === 'set').length, 0)
async function toggle(ui, fold, open) {
  await ui.act(() => { if (open) fold.setAttribute('open', ''); else fold.removeAttribute('open'); fold.dispatch('toggle') })
}
const literal = '<img src=x onerror="syntheticMacro()">&<b>ordret</b>'
const makeFood = (id, values, source) => createFood({ id, name: 'Fælles navn ' + literal,
  preparation: 'Syntetisk tilstand ' + id, source: { citation: source, verification: 'Syntetisk status ' + id },
  nutrientsPer100g: values })
// Deliberately inconsistent kcal/macros: the display must never calculate kcal.
const first = makeFood('macro-specific-83', { energyKcal: 987.654, proteinG: 0, carbohydrateG: 2.125, fatG: 0.004567 },
  'Kilde 83 ' + literal + ' lang-kilde/'.repeat(70))
const second = makeFood('macro-specific-84', { energyKcal: 321, proteinG: 18.75, carbohydrateG: 0, fatG: 3.125 }, 'Kilde 84')
const expectedFirst = ['Energi: 988 kcal', 'Protein: 0 g', 'Kulhydrat: 2,13 g', 'Fedt: 0,00457 g']
const expectedSecond = ['Energi: 321 kcal', 'Protein: 18,8 g', 'Kulhydrat: 0 g', 'Fedt: 3,13 g']
const controller = storage => openPortalPlan({ enabled: true, coachId: props.session.user.id,
  athlete: props.athlete, date: props.today, catalog: [first, second], storage: () => storage }).controller
const inputProps = c => ({ controller: c, snapshot: c.snapshot(), coachId: props.session.user.id })

test('macro pinned lead: normal mounted Coach host exposes four reference macros within the closed evidence fold', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.openRaw()
    assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 201)
    assert.equal(panel(ui), undefined)
    await edit(ui, 'draft-food-0-0', FOODS[0].id)
    await edit(ui, 'draft-grams-0-0', '23,046875')
    const shown = panel(ui)
    assert.equal(shown.getAttribute('open'), null)
    assert.ok(parseFloat(shown.firstChild.style.minHeight) >= 44)
    assert.ok(section(shown), 'Pinned BASE omits Energi og makroer pr. 100 g in actual normal consumer')
    const n = FOODS[0].nutrientsPer100g
    assert.deepEqual(macroRows(shown), ['Energi: ' + n.energyKcal.toLocaleString('da-DK', { maximumSignificantDigits: 3 }) + ' kcal',
      ...[['Protein', n.proteinG], ['Kulhydrat', n.carbohydrateG], ['Fedt', n.fatG]].map(([label, value]) => label + ': ' + value.toLocaleString('da-DK', { maximumSignificantDigits: 3 }) + ' g')])
    assert.deepEqual(microRows(shown), Array(9).fill(unknown))
    assert.match(shown.textContent, /0 af 9 stoffer har kendte værdier; 9 er ukendte/)
    assert.ok(shown.textContent.includes(FOODS[0].source.citation))
    const state = storage.calls.length
    await toggle(ui, shown, true); await toggle(ui, shown, false)
    assert.equal(storage.calls.length, state)
    assert.equal(field(ui, 'draft-grams-0-0').value, '23,046875')
    assert.equal(ui.host.querySelectorAll('input').filter(n => (n.name ?? '').startsWith('grams-')).length, 0)
  }, '../../kostMaalKobling.mjs')
  noWrites(storage)
})

test('macro exact IDs, mixed unknown/known zero, unchanged nine micros, native fold and dirty fields through search/switch/reorder/removal', async () => {
  const storage = memoryStorage(), c = controller(storage), before = JSON.stringify(c.snapshot())
  await mountFridaPortal(storage, inputProps(c), async ui => {
    await edit(ui, 'draft-name-0', 'Ugemt navn ' + literal)
    await edit(ui, 'draft-time-0', '09:43')
    await edit(ui, 'draft-grams-0-0', '36,015625')
    await edit(ui, 'meal-draft-json', 'Ugemt JSON ' + literal)
    await edit(ui, 'draft-food-0-0', first.id)
    const shown = panel(ui)
    assert.deepEqual(macroRows(shown), expectedFirst)
    assert.deepEqual(microRows(shown), Array(9).fill(unknown))
    assert.match(shown.textContent, /0 af 9 stoffer har kendte værdier; 9 er ukendte/)
    assert.ok(shown.textContent.includes(first.source.citation))
    assert.ok(!shown.textContent.includes(second.source.citation))
    assert.equal(shown.querySelectorAll('img,b,script,a,input,button').length, 0)
    assert.equal(parseFloat(shown.style.minWidth), 0); assert.equal(shown.style.maxWidth, '100%')
    assert.equal(shown.style.overflowWrap, 'anywhere')
    await toggle(ui, shown, true)
    await edit(ui, 'draft-search-0-0', 'no-match-83')
    assert.equal(panel(ui), shown); assert.notEqual(shown.getAttribute('open'), null)
    assert.deepEqual(macroRows(shown), expectedFirst)
    await ui.click('Ryd søgning for fødevare 1 i måltid 1')
    await edit(ui, 'draft-food-0-0', second.id)
    const next = panel(ui)
    assert.notEqual(next, shown); assert.equal(next.getAttribute('open'), null)
    assert.deepEqual(macroRows(next), expectedSecond)
    assert.ok(next.textContent.includes(second.source.citation)); assert.ok(!next.textContent.includes(first.source.citation))
    await ui.click('Tilføj fødevare til måltid 1')
    await edit(ui, 'draft-food-0-1', first.id)
    const kept = panel(ui, 2); await toggle(ui, kept, true)
    await ui.click('Fjern fødevare 1 fra måltid 1')
    assert.equal(panel(ui), kept); assert.deepEqual(macroRows(kept), expectedFirst)
    assert.notEqual(kept.getAttribute('open'), null)
    await edit(ui, 'draft-food-0-0', '')
    assert.equal(panel(ui), undefined)
    assert.deepEqual(['draft-name-0','draft-time-0','meal-draft-json'].map(n => field(ui,n).value), ['Ugemt navn ' + literal,'09:43','Ugemt JSON ' + literal])
    assert.equal(JSON.stringify(c.snapshot()), before)
  }, './MealDraftImport.mjs')
  noWrites(storage)
})

test('macro invalid or foreign snapshots never leak apparently known values; missing keys are unknown and IDs stay unique across the full snapshot', async () => {
  const storage = memoryStorage(), c = controller(storage), original = c.snapshot()
  const valid = original.foods.find(f => f.id === first.id)
  await mountFridaPortal(storage, inputProps(c), async ui => {
    await edit(ui, 'draft-food-0-0', first.id)
    const bad = [{}, { ...valid.nutrition, id: second.id }, { ...valid.nutrition, name: 'Fremmed' },
      { ...valid.nutrition, basisGrams: 1 }, { ...valid.nutrition, source: { citation: 'Kilde uden status' } },
      ...['0', -1, NaN, Infinity, 1e13, undefined].map(energyKcal => ({ ...valid.nutrition,
        nutrientsPer100g: { ...valid.nutrition.nutrientsPer100g, energyKcal } })),
      { ...valid.nutrition, nutrientsPer100g: { ...valid.nutrition.nutrientsPer100g, energyKJ: 900 } }]
    for (const nutrition of bad) {
      await ui.render({ ...inputProps(c), snapshot: { ...original, foods: [{ ...valid, nutrition }, original.foods[1]] } })
      const shown = panel(ui)
      assert.deepEqual(macroRows(shown), ['Energi','Protein','Kulhydrat','Fedt'].map(label => `${label}: ${unknown}`))
      assert.deepEqual(microRows(shown), Array(9).fill(unknown))
      assert.match(shown.textContent, /Næringsgrundlag ikke dokumenteret/)
      assert.ok(!shown.textContent.includes(first.source.citation))
    }
    for (const foods of [original.foods.slice(1), [...original.foods, valid]]) {
      await ui.render({ ...inputProps(c), snapshot: { ...original, foods } })
      assert.deepEqual(macroRows(panel(ui)), ['Energi','Protein','Kulhydrat','Fedt'].map(label => `${label}: ${unknown}`))
    }
    const nutrition = { ...valid.nutrition, nutrientsPer100g: { energyKcal: null, proteinG: 0, carbohydrateG: 1.23456 } }
    await ui.render({ ...inputProps(c), snapshot: { ...original, foods: [{ ...valid, nutrition }] } })
    assert.deepEqual(macroRows(panel(ui)), [`Energi: ${unknown}`, 'Protein: 0 g', 'Kulhydrat: 1,23 g', `Fedt: ${unknown}`])
    assert.deepEqual(microRows(panel(ui)), Array(9).fill(unknown))
  }, './MealDraftImport.mjs')
  noWrites(storage)
})

for (const change of ['coach', 'athlete', 'date', 'OFF']) test('macro normal host retires opened macro source and retained edits on ' + change, async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.open(); assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 241)
    await edit(ui, 'draft-food-0-0', 'frida55:1')
    const old = panel(ui); assert.equal(macroRows(old).length, 4)
    assert.match(old.textContent, /9 af 9 stoffer har kendte værdier/)
    await toggle(ui, old, true)
    const stale = ui.handler(field(ui,'draft-food-0-0'), 'onChange')
    const changed = change === 'coach' ? { session: { user: { id: 'macro-coach-other-84' } } }
      : change === 'athlete' ? { athlete: { ...props.athlete, id: 'macro-athlete-other-84' } }
        : change === 'date' ? { today: '2026-11-09' } : { enabled: false }
    await ui.render({ ...props, ...changed })
    await ui.act(() => stale({ currentTarget: { value: FOODS[0].id } }))
    assert.equal(panel(ui), undefined); assert.ok(!ui.host.querySelectorAll('details').includes(old))
    if (change === 'OFF') assert.equal(ui.host.textContent, '')
    else { await ui.open(); assert.equal(panel(ui), undefined); assert.equal(field(ui,'draft-food-0-0').value, '') }
  }, '../../kostMaalKobling.mjs')
  noWrites(storage)
})


test('macro inspection stays read-only during a real pending save; replacement, unmount and late completion retire old callbacks', async () => {
  const storage = memoryStorage(), f = syntheticInput(), calls = []
  let release, saving, retained
  const gate = new Promise(resolve => { release = resolve })
  const c = createCoachPlan({ ...f.options, coachId: props.session.user.id, localDraftOnly: true, catalog: [first, second],
    saveDraft: async request => { calls.push(structuredClone(request)); await gate; return f.ack(request, 'draft') } })
  const replacement = controller(storage)
  try {
    await mountFridaPortal(storage, inputProps(c), async ui => {
      await edit(ui, 'draft-name-0', 'Pending synthetic meal')
      await edit(ui, 'draft-grams-0-0', '62,03125')
      await edit(ui, 'draft-food-0-0', first.id)
      const old = panel(ui), stale = ui.handler(field(ui, 'draft-food-0-0'), 'onChange')
      await toggle(ui, old, true); assert.equal(calls.length, 0)
      await ui.submit('Formularkladde · navngivne måltider')
      saving = c.save(); assert.equal(c.snapshot().busy, 'save')
      await ui.render(inputProps(c))
      const request = JSON.stringify(calls), state = JSON.stringify(c.snapshot())
      await toggle(ui, panel(ui), false); await toggle(ui, panel(ui), true)
      await ui.act(() => stale({ currentTarget: { value: second.id } }))
      assert.equal(JSON.stringify(calls), request); assert.equal(JSON.stringify(c.snapshot()), state)
      assert.deepEqual(macroRows(panel(ui)), expectedFirst)
      assert.equal(field(ui, 'draft-grams-0-0').value, '62,03125')
      await ui.render(inputProps(replacement))
      assert.equal(panel(ui), undefined)
      await edit(ui, 'draft-name-0', 'Fresh unsaved replacement')
      await edit(ui, 'draft-food-0-0', second.id)
      assert.deepEqual(macroRows(panel(ui)), expectedSecond)
      await ui.act(() => stale({ currentTarget: { value: first.id } }))
      assert.equal(field(ui, 'draft-food-0-0').value, second.id)
      retained = ui.handler(field(ui, 'draft-food-0-0'), 'onChange')
      release(); await saving
      assert.equal(field(ui, 'draft-name-0').value, 'Fresh unsaved replacement')
      assert.deepEqual(macroRows(panel(ui)), expectedSecond)
      assert.equal(calls.length, 1)
    }, './MealDraftImport.mjs')
    const state = JSON.stringify(replacement.snapshot())
    retained({ currentTarget: { value: first.id } })
    assert.equal(JSON.stringify(replacement.snapshot()), state)
    assert.equal(calls.length, 1)
  } finally { release(); await saving }
  noWrites(storage)
})
