import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'

const boundary = registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context)
  if (result.url.endsWith('/supabase.js')) throw Error('Production client forbidden in selected evidence tests')
  return result
} })
test.after(() => boundary.deregister())
const props = { enabled: true, today: '2026-11-08',
  athlete: { id: 'evidence-athlete-27', age: 31, bodyweight: 76, goal: 'maintain' },
  session: { user: { id: 'evidence-coach-27' } } }
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const edit = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const title = (ii = 1, mi = 1) => `Næringsgrundlag for valgt fødevare ${ii} i måltid ${mi}`
const panel = (ui, ii = 1, mi = 1) => ui.host.querySelectorAll('details').find(n => n.firstChild?.textContent === title(ii, mi))
const preview = ui => ui.host.querySelectorAll('input').filter(n => (n.name ?? '').startsWith('grams-'))

test('pinned lead: actual CoachKostMaal -> PortalPlan shows selected reference evidence before applying any meal', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.open()
    assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 241)
    assert.equal(panel(ui), undefined)
    await edit(ui, 'draft-food-0-0', 'frida55:914')
    await edit(ui, 'draft-grams-0-0', '87,03125')
    const shown = panel(ui)
    assert.ok(shown, 'BASE lacks selected-food evidence in the actual mounted editor')
    assert.match(shown.textContent, /Referenceværdier pr. 100 g/)
    assert.equal(shown.getAttribute('open'), null)
    assert.equal(preview(ui).length, 0)
    assert.equal(field(ui, 'draft-grams-0-0').value, '87,03125')
  }, '../../kostMaalKobling.mjs')
  assert.equal(storage.calls.some(([action]) => action === 'set'), false)
})

// Additional cases mount the same actual editor with public synthetic catalogue
// snapshots and real controllers; business matching/validation is never copied.
const { createElement: h } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { createFood, FOODS } = await import('../foedevarer/index.mjs')
const { openPortalPlan } = await import('./portalModel.mjs')
const { createCoachPlan } = await import('./controller.mjs')
const { syntheticInput } = await import('./syntheticFixture.mjs')
const { FRIDA_FOODS } = await import('../foedevarer/frida55.mjs')
const literal = '<img src=x onerror="publicSynthetic()">&<b>tekst</b>'
const citation = 'Public synthetic source ' + literal + ' lang-reference/'.repeat(100)
const makeFood = (id, preparation, nutrients, source = citation) => createFood({ id, name: 'Samme navn ' + literal,
  preparation, source: { citation: source, verification: 'Syntetisk, ikke verificeret' },
  nutrientsPer100g: { energyKcal: 120, proteinG: 12, carbohydrateG: 10, fatG: 2, ...nutrients } })
const raw = makeFood('evidence-public-raw-17', 'rå ' + literal, { calciumMg: 126.25, sodiumMg: 0 })
const cooked = makeFood('evidence-public-cooked-18', 'kogt ' + literal, { ironMg: 3.25 }, 'Public cooked source 18')
const catalog = [raw, cooked]
const inputProps = c => ({ controller: c, snapshot: c.snapshot(), coachId: 'evidence-editor-coach-29' })
const controller = (storage, foods = catalog) => openPortalPlan({ enabled: true, coachId: 'evidence-editor-coach-29',
  athlete: props.athlete, date: props.today, catalog: foods, storage: () => storage }).controller
const choices = ui => field(ui, 'draft-food-0-0').querySelectorAll('option').map(n => [n.value, n.textContent])
const rows = shown => {
  const dl = shown.querySelectorAll('dl')[0]
  return Object.fromEntries(dl.querySelectorAll('dt').map((n, i) => [n.textContent, dl.querySelectorAll('dd')[i].textContent]))
}
const noWrites = storage => assert.equal(storage.calls.some(([action]) => action === 'set'), false)
async function toggle(ui, shown, open) {
  await ui.act(() => { if (open) shown.setAttribute('open', ''); else shown.removeAttribute('open'); shown.dispatch('toggle') })
}
function inspect(ui, shown) {
  assert.ok(shown)
  const summary = shown.firstChild
  assert.ok(parseFloat(summary.style.minHeight) >= 44)
  assert.equal(shown.getAttribute('open'), null)
  assert.equal(summary.textContent, title())
  assert.equal(summary.getAttribute('aria-label'), null, 'No source/DOI in accessible control name')
  for (const key of ['onClick', 'onKeyDown', 'tabIndex', 'role', 'aria-expanded']) assert.equal(ui.handler(summary, key), undefined)
  assert.equal(ui.handler(shown, 'onToggle'), undefined)
  assert.equal(shown.querySelectorAll('input,select,button,form,a,img,b,script').length, 0)
  assert.match(shown.textContent, /ikke spist indtag/)
  assert.match(shown.textContent, /eksakt mærkevare/)
  assert.match(shown.textContent, /medicinske behov/)
  assert.match(shown.textContent, /Ukendt er ikke nul/)
}

test('normal Coach host keeps legacy unknown; explicit Frida exposes known zero before apply, with no writes or stale source', async () => {
  for (const explicit of [false, true]) {
    const storage = memoryStorage()
    await mountFridaPortal(storage, props, async ui => {
      if (explicit) await ui.open(); else await ui.openRaw()
      const original = choices(ui), selected = explicit ? 'frida55:1' : FOODS[0].id
      assert.equal(original.length, explicit ? 241 : 201)
      await edit(ui, 'draft-name-0', 'Ugemt ' + literal)
      await edit(ui, 'draft-time-0', '17:43')
      await edit(ui, 'draft-grams-0-0', '93,015625')
      await edit(ui, 'portionGuidance', 'Ordret råd ' + literal)
      await edit(ui, 'meal-draft-json', 'Ugemt JSON-tekst ' + literal)
      await edit(ui, 'draft-food-0-0', selected)
      const shown = panel(ui); inspect(ui, shown)
      if (explicit) {
        assert.equal(rows(shown)['D-vitamin'], '0 µg')
        assert.match(shown.textContent, /9 af 9 stoffer har kendte værdier/)
        assert.ok(shown.textContent.includes(FRIDA_FOODS.find(f => f.id === selected).source.citation))
      } else {
        assert.deepEqual(Object.values(rows(shown)), Array(9).fill('Ukendt – mangler data'))
        assert.match(shown.textContent, /0 af 9 stoffer har kendte værdier; 9 er ukendte/)
      }
      const before = storage.calls.length
      await toggle(ui, shown, true); await toggle(ui, shown, false)
      await edit(ui, 'draft-search-0-0', 'zz-evidence-no-match')
      assert.equal(panel(ui), shown)
      assert.deepEqual(choices(ui), original.filter(([id]) => !id || id === selected))
      await ui.click('Ryd søgning for fødevare 1 i måltid 1')
      assert.deepEqual(choices(ui), original)
      await ui.render({ ...props, nutritionRead: { state: 'loading' } })
      assert.equal(panel(ui), shown)
      assert.deepEqual(['draft-name-0','draft-time-0','draft-grams-0-0','portionGuidance','meal-draft-json'].map(n => field(ui,n).value),
        ['Ugemt ' + literal, '17:43', '93,015625', 'Ordret råd ' + literal, 'Ugemt JSON-tekst ' + literal])
      assert.equal(storage.calls.length, before)
      assert.equal(preview(ui).length, 0)
    }, '../../kostMaalKobling.mjs')
    noWrites(storage)
  }
})

test('real StrictMode editor: exact IDs distinguish equal names; native disclosure resets on selection and partial evidence stays partial', async () => {
  const storage = memoryStorage(), c = controller(storage)
  await mountFridaPortal(storage, inputProps(c), async ui => {
    const original = choices(ui), plan = JSON.stringify(c.snapshot().meals)
    await edit(ui, 'draft-name-0', 'Bevar måltidet'); await edit(ui, 'draft-time-0', '15:37')
    await edit(ui, 'draft-grams-0-0', '11,0078125')
    await edit(ui, 'draft-food-0-0', raw.id)
    const shown = panel(ui); inspect(ui, shown)
    assert.equal(rows(shown).Calcium, '126 mg'); assert.equal(rows(shown).Natrium, '0 mg')
    assert.equal(rows(shown).Jern, 'Ukendt – mangler data')
    assert.match(shown.textContent, /2 af 9 stoffer har kendte værdier; 7 er ukendte/)
    const source = shown.querySelectorAll('dl')[1]
    assert.deepEqual(source.querySelectorAll('dd').map(n => n.textContent), [citation, raw.id, raw.source.verification])
    assert.equal(source.style.overflowWrap, 'anywhere')
    await toggle(ui, shown, true)
    await edit(ui, 'draft-search-0-0', 'no-evidence-match-17')
    assert.equal(panel(ui), shown); assert.notEqual(shown.getAttribute('open'), null)
    await edit(ui, 'draft-food-0-0', cooked.id)
    const next = panel(ui); inspect(ui, next)
    assert.notEqual(next, shown)
    assert.ok(next.textContent.includes('kogt ' + literal))
    assert.ok(next.textContent.includes(cooked.source.citation))
    assert.ok(!next.textContent.includes(citation)); assert.equal(rows(next).Jern, '3,25 mg')
    assert.equal(rows(next).Calcium, 'Ukendt – mangler data')
    await ui.click('Ryd søgning for fødevare 1 i måltid 1'); assert.deepEqual(choices(ui), original)
    await edit(ui, 'draft-food-0-0', 'evidence-missing-19')
    const missing = panel(ui)
    assert.match(missing.textContent, /Næringsgrundlag ikke dokumenteret/)
    assert.equal(missing.querySelectorAll('dl').length, 1)
    assert.ok(!missing.textContent.includes(cooked.source.citation))
    await edit(ui, 'draft-food-0-0', '')
    assert.equal(panel(ui), undefined)
    assert.deepEqual(['draft-name-0','draft-time-0','draft-grams-0-0'].map(n => field(ui,n).value), ['Bevar måltidet','15:37','11,0078125'])
    assert.equal(JSON.stringify(c.snapshot().meals), plan)
  }, './MealDraftImport.mjs')
  noWrites(storage)
})

test('malformed/foreign/removed evidence fails closed in the actual mounted editor without borrowing same-name sources', async () => {
  const storage = memoryStorage(), c = controller(storage), original = c.snapshot()
  await mountFridaPortal(storage, inputProps(c), async ui => {
    await edit(ui, 'draft-food-0-0', raw.id)
    const valid = original.foods.find(f => f.id === raw.id)
    const malformed = [
      { ...valid.nutrition, id: cooked.id },
      { ...valid.nutrition, name: 'Forkert navn' },
      { ...valid.nutrition, basisGrams: 1 },
      { ...valid.nutrition, source: { citation: citation, verification: '' } },
      { ...valid.nutrition, nutrientsPer100g: { ...valid.nutrition.nutrientsPer100g, ironMg: '0' } },
      { ...valid.nutrition, nutrientsPer100g: { ...valid.nutrition.nutrientsPer100g, calciumMg: NaN } },
      { ...valid.nutrition, nutrientsPer100g: { ...valid.nutrition.nutrientsPer100g, wrongUnit: 1 } },
    ]
    for (const nutrition of malformed) {
      await ui.render({ ...inputProps(c), snapshot: { ...original, foods: [{ ...valid, nutrition }, original.foods[1]] } })
      const shown = panel(ui)
      assert.match(shown.textContent, /Næringsgrundlag ikke dokumenteret/)
      assert.deepEqual(Object.values(rows(shown)), Array(9).fill('Ukendt – mangler data'))
      assert.equal(shown.querySelectorAll('dl').length, 1)
      assert.ok(!shown.textContent.includes(citation))
    }
    await ui.render({ ...inputProps(c), snapshot: { ...original, foods: [original.foods[1]] } })
    assert.match(panel(ui).textContent, /Næringsgrundlag ikke dokumenteret/)
    assert.equal(panel(ui).querySelectorAll('h3').length, 0)
    await ui.render(inputProps(c))
    assert.ok(panel(ui).textContent.includes(citation))
    assert.equal(c.snapshot().meals.length, 0)
  }, './MealDraftImport.mjs')
  noWrites(storage)
})

test('stable rows keep the remaining food evidence after removal/reindex; new line has no inherited source', async () => {
  const storage = memoryStorage(), c = controller(storage)
  await mountFridaPortal(storage, inputProps(c), async ui => {
    await edit(ui, 'draft-food-0-0', raw.id)
    await ui.click('Tilføj fødevare til måltid 1')
    await edit(ui, 'draft-food-0-1', cooked.id)
    await edit(ui, 'draft-grams-0-1', '29,0625')
    await edit(ui, 'draft-search-0-1', 'kogt')
    const second = panel(ui, 2)
    await toggle(ui, second, true)
    await ui.click('Fjern fødevare 1 fra måltid 1')
    assert.equal(panel(ui), second)
    assert.equal(second.firstChild.textContent, title())
    assert.ok(second.textContent.includes(cooked.source.citation))
    assert.ok(!second.textContent.includes(citation))
    assert.equal(field(ui, 'draft-grams-0-0').value, '29,0625')
    assert.equal(field(ui, 'draft-search-0-0').value, 'kogt')
    await ui.click('Tilføj fødevare til måltid 1')
    assert.equal(panel(ui, 2), undefined)
    await ui.click('Tilføj måltid')
    await edit(ui, 'draft-food-1-0', raw.id)
    const nextMeal = panel(ui, 1, 2)
    await ui.click('Fjern måltid 1')
    assert.equal(panel(ui), nextMeal)
    assert.equal(nextMeal.firstChild.textContent, title())
    assert.equal(c.snapshot().meals.length, 0)
  }, './MealDraftImport.mjs')
  noWrites(storage)
})

for (const change of ['owner','athlete','day','OFF']) test('normal Coach host retires source and retained edits across ' + change, async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.open(); await edit(ui, 'draft-food-0-0', 'frida55:1')
    const old = panel(ui); await toggle(ui, old, true)
    const stale = ui.handler(field(ui,'draft-food-0-0'),'onChange')
    const next = change === 'owner' ? { session: { user: { id: 'evidence-other-coach-31' } } }
      : change === 'athlete' ? { athlete: { ...props.athlete, id: 'evidence-other-athlete-32' } }
        : change === 'day' ? { today: '2026-11-09' } : { enabled: false }
    await ui.render({ ...props, ...next })
    await ui.act(() => stale({ currentTarget: { value: 'frida55:914' } }))
    assert.equal(panel(ui), undefined)
    assert.ok(!ui.host.querySelectorAll('details').includes(old))
    if (change === 'OFF') assert.equal(ui.host.textContent, '')
    else { await ui.open(); assert.equal(field(ui,'draft-food-0-0').value, ''); assert.equal(panel(ui), undefined) }
  }, '../../kostMaalKobling.mjs')
  noWrites(storage)
})

test('SSR escapes literal food/preparation/citation and never creates links or raw JSON; unsupported inputs do not crash', async () => {
  const { default: SelectedFoodEvidence } = await import('./SelectedFoodEvidence.mjs')
  const props = { foods: [{ id: raw.id, name: raw.name, nutrition: raw }], foodId: raw.id, ingredientNumber: 4, mealNumber: 3 }
  const html = renderToStaticMarkup(h(SelectedFoodEvidence, props))
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img|<b>|<a|<script|<details[^>]* open/)
  assert.match(html, /Næringsgrundlag for valgt fødevare 4 i måltid 3/)
  assert.ok(!html.includes(JSON.stringify(raw)))
  for (const foods of [undefined, null, [], [null], [{ id: raw.id, name: raw.name }], [...props.foods, ...props.foods]]) {
    const text = renderToStaticMarkup(h(SelectedFoodEvidence, { ...props, foods }))
    assert.match(text, /Næringsgrundlag ikke dokumenteret/)
    assert.ok(!text.includes(raw.id)); assert.ok(!text.includes('Public synthetic source'))
  }
  assert.equal(renderToStaticMarkup(h(SelectedFoodEvidence, { ...props, foodId: '' })), '')
})

test('actual controller busy save and pending activation allow only read-only disclosure; retained edits cannot change reserved payload', async () => {
  const storage = memoryStorage(), f = syntheticInput(), calls = []
  let releaseSave, releaseActivation
  const heldSave = new Promise(resolve => { releaseSave = resolve })
  const heldActivation = new Promise(resolve => { releaseActivation = resolve })
  const c = createCoachPlan({ ...f.options, localDraftOnly: true, catalog,
    coachId: 'evidence-editor-coach-29',
    saveDraft: async request => { calls.push(['save', structuredClone(request)]); await heldSave; return f.ack(request, 'draft') },
    markActivationPending: async value => { calls.push(['reservation', value]) } })
  let saving, activating
  try {
    await mountFridaPortal(storage, inputProps(c), async ui => {
      await edit(ui, 'draft-name-0', 'Reserveret syntetisk måltid')
      await edit(ui, 'draft-food-0-0', raw.id); await edit(ui, 'draft-grams-0-0', '45,0078125')
      const shown = panel(ui)
      assert.equal(c.snapshot().meals.length, 0)
      await toggle(ui, shown, true); assert.equal(calls.length, 0)
      await ui.submit('Formularkladde · navngivne måltider'); await ui.render(inputProps(c))
      const staleFood = ui.handler(field(ui,'draft-food-0-0'),'onChange')
      const staleForm = ui.handler(ui.host.querySelectorAll('form').find(n => n.textContent.includes('Formularkladde · navngivne måltider')), 'onSubmit')
      saving = c.save(); assert.equal(c.snapshot().busy, 'save')
      const request = JSON.stringify(calls)
      await ui.render(inputProps(c))
      await toggle(ui, shown, false); await toggle(ui, shown, true)
      await ui.act(() => { staleFood({ currentTarget: { value: cooked.id } }); staleForm({ preventDefault() {} }) })
      assert.equal(field(ui,'draft-food-0-0').value, raw.id)
      assert.equal(JSON.stringify(calls), request)
      assert.ok(panel(ui).textContent.includes(citation))
      releaseSave(); await saving; await ui.render(inputProps(c))
      c.setActivationAdapter({ check: async () => ({ state: 'ready', active: null }), activate: async plan => {
        calls.push(['activate', structuredClone(plan)]); await heldActivation; throw Error('Synthetic unconfirmed activation')
      } })
      await c.checkActivation()
      activating = c.activate()
      await ui.wait(() => c.snapshot().activationPending)
      await ui.render(inputProps(c))
      const pending = JSON.stringify(c.snapshot()), payload = JSON.stringify(calls)
      await toggle(ui, shown, false); await toggle(ui, shown, true)
      await ui.act(() => { staleFood({ currentTarget: { value: cooked.id } }); staleForm({ preventDefault() {} }) })
      assert.equal(JSON.stringify(c.snapshot()), pending)
      assert.equal(JSON.stringify(calls), payload)
      assert.equal(field(ui,'draft-grams-0-0').value, '45,0078125')
      assert.equal(field(ui,'draft-food-0-0').value, raw.id)
      releaseActivation(); await activating
      assert.equal(c.snapshot().activationPending, true)
    }, './MealDraftImport.mjs')
  } finally { releaseSave(); releaseActivation(); await saving; await activating }
  noWrites(storage)
})
