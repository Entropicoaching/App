import test from 'node:test'
import assert from 'node:assert/strict'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { registerHooks } from 'node:module'
import { searchFoods } from './foodSearch.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { syntheticTables } from './activation.fixture.mjs'
import { withDatabase, profile, scope, names } from './generatorSql.fixture.mjs'
import { createCoachPlan } from './controller.mjs'

// Hermetic boundary: the normal coach host does not forward the injected client.
// Reject its production-client import before reading/evaluating that module.
const boundary = registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context)
  if (result.url.endsWith('/supabase.js')) throw Error('Production client forbidden in synthetic test')
  return result
} })
test.after(() => boundary.deregister())

const props = { enabled: true, today: '2026-11-08',
  athlete: { id: 'search-synthetic-athlete', age: 36, bodyweight: 79, goal: 'maintain' },
  session: { user: { id: 'search-synthetic-coach' } },
  client: { from() { throw Error('Synthetic offline client') } } }
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea')
  .find(n => (n.name ?? n.getAttribute('name')) === name)

test('pinned lead: normal CoachKostMaal legacy named-meal row offers labeled food search', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.openRaw()
    const select = field(ui, 'draft-food-0-0')
    assert.equal(select.querySelectorAll('option').length, 201)
    assert.ok(ui.host.querySelectorAll('input').some(n => (n.type ?? n.getAttribute('type')) === 'search'),
      'The actual mounted named-meal form needs a per-row food search')
  }, '../../kostMaalKobling.mjs')
  assert.equal(storage.calls.some(([action]) => action === 'set'), false)
})

const edit = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const options = (ui, name = 'draft-food-0-0') => field(ui, name).querySelectorAll('option').map(n => [n.value, n.textContent])
const noWrites = storage => assert.equal(storage.calls.some(([action]) => action === 'set'), false)
const search = (ui, value, mi = 0, ii = 0) => edit(ui, `draft-search-${mi}-${ii}`, value)

test('matching only folds search: exact empty order, Danish words/accents and same-name preparations keep identities', () => {
  const foods = Object.freeze([
    Object.freeze({ id: 'raw', name: 'Æble og grøn pære', nutrition: { preparation: 'rå' } }),
    Object.freeze({ id: 'cooked', name: 'Æble og grøn pære', nutrition: { preparation: 'kogt' } }),
    Object.freeze({ id: 'other', name: 'Ris', nutrition: { preparation: 'kogt' } }),
  ])
  assert.equal(searchFoods(foods, '', 'raw').foods, foods)
  assert.equal(searchFoods(foods, ' \t ', 'raw').foods, foods)
  const cooked = searchFoods(foods, ' PAERE  ÆBLE  KO\u0301GT ', 'raw')
  assert.deepEqual(cooked.foods, [foods[0], foods[1]])
  assert.equal(cooked.matches, 1)
  assert.deepEqual(searchFoods(foods, 'gra\u0301n', '').foods, [])
  assert.deepEqual(searchFoods(foods, 'GRO\u0301N RA', '').foods, [foods[0]])
  assert.equal(searchFoods(foods, 'missing', 'cooked').matches, 0)
  assert.deepEqual(searchFoods(foods, 'missing', 'cooked').foods, [foods[1]])
})

for (const explicit of [false, true]) test(`actual Coach host ${explicit ? 240 : 200}: tokens, diacritics, no results, selected nonmatch and exact clear`, async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    if (explicit) await ui.open(); else await ui.openRaw()
    const original = options(ui)
    assert.equal(original.length, explicit ? 241 : 201)
    await edit(ui, 'draft-name-0', 'Søgbar frokost')
    await edit(ui, 'draft-time-0', '13:39')
    await edit(ui, 'draft-grams-0-0', '127,03125')
    await edit(ui, 'portionGuidance', 'Bevar råd præcist: ½ portion')
    for (const query of [' ÆRTER   KOGT ', ' AERTER KÓGT ']) {
      await search(ui, query)
      const expected = original.filter((o, i) => !i || /ærter/iu.test(o[1]) && /kogt/iu.test(o[1]))
      assert.ok(expected.length > 1)
      assert.deepEqual(options(ui), expected)
    }
    const selected = original[explicit ? 218 : 97]
    await edit(ui, 'draft-food-0-0', selected[0])
    await search(ui, 'zz-no-result-32')
    assert.deepEqual(options(ui), [original[0], selected])
    assert.equal(field(ui, 'draft-food-0-0').value, selected[0])
    const input = field(ui, 'draft-search-0-0')
    assert.equal(input.type, 'search')
    assert.equal(input.style.minHeight, '44px')
    const label = ui.host.querySelectorAll('label').find(n => n.textContent.startsWith('Søg fødevare 1 i måltid 1'))
    assert.equal(label.querySelector('input'), input)
    const select = field(ui, 'draft-food-0-0')
    assert.equal(input.getAttribute('aria-controls'), select.getAttribute('id'))
    const feedback = ui.host.querySelectorAll('p').find(n => n.getAttribute('id') === input.getAttribute('aria-describedby'))
    assert.equal(feedback.getAttribute('role'), 'status')
    assert.equal(feedback.getAttribute('aria-live'), 'polite')
    assert.match(feedback.textContent, /^Ingen fødevarer matcher/)
    const clear = ui.find('button', 'Ryd søgning for fødevare 1 i måltid 1')
    assert.equal(clear.style.minHeight, '44px'); assert.equal(clear.getAttribute('type'), 'button')
    await ui.invoke(clear, 'onClick')
    assert.deepEqual(options(ui), original)
    assert.equal(field(ui, 'draft-search-0-0').value, '')
    assert.deepEqual(['draft-name-0', 'draft-time-0', 'draft-grams-0-0', 'portionGuidance'].map(n => field(ui,n).value),
      ['Søgbar frokost', '13:39', '127,03125', 'Bevar råd præcist: ½ portion'])
    assert.equal(ui.host.querySelectorAll('input').filter(n => (n.name ?? '').startsWith('grams-')).length, 0)
  }, '../../kostMaalKobling.mjs')
  noWrites(storage)
})

test('stable row filters: independent meals/ingredients, removal, fresh additions and retired handlers', async () => {
  const storage = memoryStorage(); let retired
  await mountFridaPortal(storage, props, async ui => {
    await ui.openRaw(); const original = options(ui)
    await ui.click('Tilføj fødevare til måltid 1'); await ui.click('Tilføj måltid')
    await search(ui, 'kylling', 0, 0); await search(ui, 'ris', 0, 1); await search(ui, 'ærter', 1, 0)
    const second = options(ui, 'draft-food-0-1'), meal2 = options(ui, 'draft-food-1-0')
    assert.ok(second.length > 1 && second.length < 201)
    retired = ui.handler(field(ui, 'draft-search-0-0'), 'onChange')
    await search(ui, 'havre', 0, 0)
    await ui.act(() => retired({ get currentTarget() { throw Error('Stale search read event') } }))
    assert.equal(field(ui, 'draft-search-0-0').value, 'havre')
    await ui.click('Fjern fødevare 1 fra måltid 1')
    assert.deepEqual(options(ui), second)
    assert.equal(field(ui, 'draft-search-0-0').value, 'ris')
    await ui.click('Fjern måltid 1'); assert.deepEqual(options(ui), meal2)
    assert.equal(field(ui, 'draft-search-0-0').value, 'ærter')
    await ui.click('Tilføj måltid'); assert.deepEqual(options(ui, 'draft-food-1-0'), original)
    assert.equal(field(ui, 'draft-search-1-0').value, '')
    retired = ui.handler(field(ui, 'draft-search-0-0'), 'onChange')
    await ui.render({ enabled: false })
    await ui.act(() => retired({ get currentTarget() { throw Error('OFF search read event') } }))
    assert.equal(ui.host.textContent, '')
  }, '../../kostMaalKobling.mjs')
  retired({ get currentTarget() { throw Error('Unmounted search read event') } }); noWrites(storage)
})

test('actual reference scope changes reset filters; client/loader/late reads preserve exact typed fields', async () => {
  const storage = memoryStorage(); let release
  const held = new Promise(r => { release = r }), client = syntheticTables({ before: () => held })
  await mountFridaPortal(storage, { ...props, client: client.client }, async ui => {
    await ui.open()
    await search(ui, 'linser'); await edit(ui, 'draft-name-0', 'Ugemt linsemåltid')
    await edit(ui, 'draft-food-0-0', 'frida55:914'); await edit(ui, 'draft-time-0', '18:49')
    await edit(ui, 'draft-grams-0-0', '88,015625'); await edit(ui, 'portionGuidance', 'Ordret råd')
    const fields = ['draft-search-0-0','draft-name-0','draft-time-0','draft-food-0-0','draft-grams-0-0','portionGuidance']
    const before = fields.map(n => field(ui,n).value), beforeOptions = options(ui)
    await ui.render({ ...props, client: { from() { throw Error('Replacement offline') } }, loadReferenceFoods: () => { throw Error('Ready catalogue replaced') } })
    await ui.act(() => release())
    assert.deepEqual(fields.map(n => field(ui,n).value), before); assert.deepEqual(options(ui), beforeOptions)
    for (const change of [{ today: '2026-11-19' }, { athlete: { ...props.athlete, id: 'different-food-athlete' } }, { session: { user: { id: 'different-food-coach' } } }]) {
      const stale = ui.handler(field(ui,'draft-search-0-0'),'onChange')
      await ui.render({ ...props, ...change }); await ui.open()
      await ui.act(() => stale({ get currentTarget() { throw Error('Retired scope search read') } }))
      assert.equal(field(ui,'draft-search-0-0').value, '')
      assert.equal(field(ui,'draft-name-0').value, '')
      assert.equal(options(ui).length, 241)
      await search(ui, 'ris')
    }
  })
  assert.equal(client.writes().length, 0); noWrites(storage)
})

test('same-scope controller replacement and version change retire search/clear without changing plans', async () => {
  const storage = memoryStorage(), make = () => openPortalPlan({ enabled: true, coachId: 'search-owner', athlete: props.athlete, date: props.today, storage: () => storage }).controller
  const c1 = make(), c2 = make(), inputProps = c => ({ controller: c, snapshot: c.snapshot(), coachId: 'search-owner' })
  await mountFridaPortal(storage, inputProps(c1), async ui => {
    await search(ui, 'ris'); const stale = ui.handler(field(ui,'draft-search-0-0'),'onChange')
    const clear = ui.handler(ui.find('button','Ryd søgning for fødevare 1 i måltid 1'),'onClick')
    c1.set('goal','bulk')
    await ui.act(() => { stale({ get currentTarget() { throw Error('Stale version read') } }); clear() })
    assert.equal(field(ui,'draft-search-0-0').value, 'ris')
    await ui.render(inputProps(c2)); assert.equal(field(ui,'draft-search-0-0').value, '')
    await ui.act(() => { stale({ get currentTarget() { throw Error('Old controller read') } }); clear() })
    assert.equal(field(ui,'draft-search-0-0').value, '')
    assert.equal(c1.snapshot().meals.length, 0); assert.equal(c2.snapshot().meals.length, 0)
  }, './MealDraftImport.mjs'); noWrites(storage)
})

test('actual editor same-name raw/cooked choices preserve preparation, identity and selected nonmatch', async () => {
  const catalog = ['rå', 'kogt'].map((preparation,i) => ({ ...FOODS[0], id: `search-synthetic-${i}`, name: 'Pære', preparation }))
  const c = openPortalPlan({ enabled: true, coachId: 'preparation-coach', athlete: props.athlete, date: props.today, catalog, storage: () => memoryStorage() }).controller
  await mountFridaPortal(memoryStorage(), { controller: c, snapshot: c.snapshot(), coachId: 'preparation-coach' }, async ui => {
    const original = options(ui)
    assert.deepEqual(original.map(o=>o[1]), ['Vælg fødevare','Pære · rå','Pære · kogt'])
    await search(ui,'PAERE KOGT'); assert.deepEqual(options(ui), [original[0],original[2]])
    await edit(ui,'draft-food-0-0',original[2][0]); await search(ui,'pære rå')
    assert.deepEqual(options(ui), original); assert.equal(field(ui,'draft-food-0-0').value,original[2][0])
    assert.equal(c.snapshot().meals.length,0)
  }, './MealDraftImport.mjs')
})

test('actual controller busy save rejects search/clear even before React receives the busy snapshot', async () => {
  let release, request
  const held = new Promise(r => { release = r })
  const c = createCoachPlan({ enabled: true, localDraftOnly: true, ...scope, athlete: profile, catalog: FOODS,
    basis: { ...scope, maintenanceKcal: 2400, protein: 150, fat: 60 }, saveDraft: async r => {
      request = r; await held
      return { ok: true, namespace: r.namespace, ...scope, planId: 'search-plan', revision: 'search-r1', clientVersion: r.clientVersion, status: 'draft' }
    } })
  const p = () => ({ controller: c, snapshot: c.snapshot(), coachId: scope.coachId })
  await mountFridaPortal(memoryStorage(), p(), async ui => {
    await edit(ui,'draft-name-0','Travl gemning'); await edit(ui,'draft-food-0-0',FOODS[6].id)
    await edit(ui,'draft-grams-0-0','51,0625'); await ui.submit('Formularkladde · navngivne måltider')
    await ui.render(p()); await search(ui,'ris')
    const stale = ui.handler(field(ui,'draft-search-0-0'),'onChange'), clear = ui.handler(ui.find('button','Ryd søgning for fødevare 1 i måltid 1'),'onClick')
    const before = JSON.stringify(c.snapshot().meals), saving = c.save()
    try {
      assert.equal(c.snapshot().busy,'save')
      const payload = JSON.stringify(request)
      await ui.act(() => { stale({ get currentTarget() { throw Error('Busy search read event') } }); clear() })
      assert.equal(field(ui,'draft-search-0-0').value,'ris')
      assert.equal(JSON.stringify(c.snapshot().meals),before); assert.equal(JSON.stringify(request),payload)
    } finally { release(); await saving }
  }, './MealDraftImport.mjs')
})

test('late catalogue after date replacement/OFF cannot replace an ordinary searched editor', async () => {
  const storage = memoryStorage(); let release
  const pending = new Promise(r => { release = r })
  await mountFridaPortal(storage, { ...props, loadReferenceFoods: () => pending }, async ui => {
    await ui.requestReference()
    assert.equal(field(ui,'draft-search-0-0'), undefined)
    await ui.render({ ...props, today:'2026-11-21' }); await ui.openRaw()
    await edit(ui,'draft-name-0','Behold legacy efter sen indlæsning'); await search(ui,'ris')
    const before = options(ui)
    const catalog = await (await import('../foedevarer/frida55Loader.mjs')).loadCoachFoods()
    await ui.act(() => release(catalog))
    assert.deepEqual(options(ui), before); assert.equal(field(ui,'draft-search-0-0').value,'ris')
    assert.equal(field(ui,'draft-name-0').value,'Behold legacy efter sen indlæsning')
    await ui.render({ enabled:false }); assert.equal(ui.host.textContent,'')
  }); noWrites(storage)
})

test('search/clear cannot alter pending activation IDs, selected food, exact payload or typed fields', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T12:00:00Z') })
  await withDatabase(async f => {
    const storage = memoryStorage(), p = { ...props, athlete: profile, session: { user: { id: scope.coachId } }, client: f.client }
    await mountFridaPortal(storage, p, async ui => {
      await ui.open(); await edit(ui,'draft-name-0','Søgning låst ved reservation')
      await edit(ui,'draft-food-0-0','frida55:754'); await edit(ui,'draft-grams-0-0','49,03125')
      await ui.submit('Formularkladde · navngivne måltider'); await ui.click('Gem som kladde')
      await search(ui,'ris')
      const stale = ui.handler(field(ui,'draft-search-0-0'),'onChange'), clear = ui.handler(ui.find('button','Ryd søgning for fødevare 1 i måltid 1'),'onClick')
      await ui.wait(() => ui.find('button','Aktivér for atleten')?.getAttribute('disabled') === null)
      await ui.click('Aktivér for atleten')
      const key = draftKey(scope.coachId, profile.id, props.today), bytes = storage.data.get(key)
      assert.equal(JSON.parse(bytes).activationPending, true)
      const writes = storage.calls.length, payloads = JSON.stringify(f.calls.filter(c => c.payload)), before = options(ui)
      await ui.act(() => { stale({ get currentTarget() { throw Error('Pending search read') } }); clear() })
      assert.equal(field(ui,'draft-search-0-0').value, 'ris'); assert.deepEqual(options(ui), before)
      assert.equal(field(ui,'draft-food-0-0').value, 'frida55:754'); assert.equal(field(ui,'draft-grams-0-0').value,'49,03125')
      assert.equal(storage.data.get(key), bytes); assert.equal(storage.calls.length, writes)
      assert.equal(JSON.stringify(f.calls.filter(c => c.payload)), payloads)
    })
  }, { lost: names[0] }) // Original fixture closes its sole synthetic PGlite in finally.
})

test('pinned lead: explicit Frida named-meal row offers search among 240 exact foods', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.open()
    const select = field(ui, 'draft-food-0-0')
    assert.equal(select.querySelectorAll('option').length, 241)
    assert.ok(ui.host.querySelectorAll('input').some(n => (n.type ?? n.getAttribute('type')) === 'search'),
      'The explicit Frida mounted named-meal form needs a per-row food search')
  })
  assert.equal(storage.calls.some(([action]) => action === 'set'), false)
})
