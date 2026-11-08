import test from 'node:test'
import assert from 'node:assert/strict'
// Actual copied React portal + manual builder + unchanged SQL, synthetic owners only.
// Run with node --experimental-vm-modules --test --test-concurrency=1 <this file>.
const { mountFridaPortal: mountFormPortal, clone } = await import('./frida55.normal.fixture.mjs')
const { memoryStorage } = await import('./portal.fixture.mjs')
const { withDatabase, profile, scope: originalScope, names } = await import('./generatorSql.fixture.mjs')
const { openPortalPlan, draftKey } = await import('./portalModel.mjs')
const { COACH_FOODS, FRIDA_FOODS } = await import('../foedevarer/frida55.mjs')
const { FOODS } = await import('../foedevarer/index.mjs')
const { supportedFoodSnapshot } = await import('../sqlSnapshot.mjs')
const { summarizePlanSnapshot } = await import('../planSnapshot.mjs')
// Each SQL test enables a bounded daytime Date before creating PGlite.
// Original historical-date tests run separately with the real clock, unchanged.
const scope = { ...originalScope, date: '2026-11-08' }
const p = client => ({ enabled: true, athlete: profile, today: scope.date,
  session: { user: { id: scope.coachId } }, client })
const unavailable = { from() { throw Error('synthetic unavailable') } }
const node = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const form = ui => ui.host.querySelectorAll('form').find(n => n.textContent.includes('Formularkladde · navngivne måltider'))
const preview = ui => ui.host.querySelectorAll('input').filter(n => (n.name ?? n.getAttribute('name') ?? '').startsWith('grams-')).map(n => Number(String(n.value).replace(',', '.')))
const input = (ui, name, value) => ui.invoke(node(ui, name), 'onChange', { currentTarget: { value } })
const apply = ui => ui.submit('Formularkladde · navngivne måltider')
const selected = [FRIDA_FOODS.find(f => f.id === 'frida55:1'), FRIDA_FOODS.find(f => f.id === 'frida55:1597'), FRIDA_FOODS.find(f => f.id === 'frida55:754')]
const key = draftKey(scope.coachId, profile.id, scope.date)
const saved = storage => JSON.parse(storage.data.get(key))
const counts = async f => {
  const result = []
  for (const table of [...names, 'meal_logs']) result.push(Number((await f.db.query(`select count(*) n from public.${table}`)).rows[0].n))
  return result
}
const build = async ui => {
  await input(ui, 'draft-name-0', 'Frida frokost')
  await input(ui, 'draft-time-0', '12:15')
  await input(ui, 'draft-food-0-0', selected[0].id)
  await input(ui, 'draft-grams-0-0', '123,123456789')
  await ui.click('Tilføj fødevare til måltid 1')
  await input(ui, 'draft-food-0-1', selected[1].id)
  await input(ui, 'draft-grams-0-1', '52,25')
  await ui.click('Tilføj fødevare til måltid 1')
  await input(ui, 'draft-food-0-2', selected[2].id)
  await input(ui, 'draft-grams-0-2', '43,5')
}

test('mounted Frida choices: exact decimals, retention, explicit SQL approval/readback and normal reopen', { timeout: 60000 }, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T12:00:00Z') })
  await withDatabase(async f => {
    const storage = memoryStorage(), other = draftKey(scope.coachId, profile.id, '2026-01-01')
    storage.data.set(other, 'synthetic untouched legacy key')
    let version, localBytes
    await mountFormPortal(storage, p(f.client), async ui => {
      await ui.open()
      const select = node(ui, 'draft-food-0-0'), options = select.querySelectorAll('option')
      assert.equal(options.length, COACH_FOODS.length + 1)
      assert.ok(options.length <= FOODS.length + 51)
      for (const food of selected) {
        assert.equal(options.some(n => n.getAttribute('value') === food.id && n.textContent === `${food.name} · ${food.preparation}`), true)
      }
      const attribution = ui.host.querySelectorAll('a').find(n => n.getAttribute('href') === 'https://doi.org/10.11583/DTU.29500682.v8')
      assert.equal(attribution?.textContent, 'DTU Frida5.5')
      assert.ok(ui.host.textContent.includes('CC BY 4.0'))
      await build(ui)
      await ui.render({ ...p(f.client), nutritionRead: { state: 'loading' } })
      assert.equal(node(ui, 'draft-food-0-0').value, selected[0].id)
      assert.equal(node(ui, 'draft-grams-0-0').value, '123,123456789')
      assert.deepEqual(preview(ui), [])
      assert.deepEqual(await counts(f), [0,0,0,0])
      assert.equal(storage.data.has(key), false)
      await apply(ui)
      assert.deepEqual(preview(ui), [123.123456789,52.25,43.5])
      await input(ui, 'grams-0-1', '63,987654321')
      assert.deepEqual(preview(ui), [123.123456789,63.987654321,43.5])
      assert.deepEqual(await counts(f), [0,0,0,0])
      await ui.click('Gem som kladde')
      localBytes = storage.data.get(key)
      assert.deepEqual(await counts(f), [0,0,0,0])
      assert.equal(saved(storage).plan.status, 'draft')
      assert.equal(storage.data.get(other), 'synthetic untouched legacy key')
      await ui.wait(() => ui.find('button', 'Aktivér for atleten')?.getAttribute('disabled') === null)
      await ui.click('Aktivér for atleten')
      await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
      assert.deepEqual(await counts(f), [1,1,1,0])
      localBytes = storage.data.get(key) // Existing explicit activation reservation is now cleared.
      version = (await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v')).rows[0].value
      assert.deepEqual(version.meals, [{ name: '12:15 Frida frokost', portions: selected.map((food, i) => ({
        grams: [123.123456789,63.987654321,43.5][i], food: supportedFoodSnapshot(food),
      })) }])
      const totals = summarizePlanSnapshot(version)
      for (const nutrient of Object.keys(selected[0].nutrientsPer100g)) {
        const amounts = selected.map(food => food.nutrientsPer100g[nutrient])
        const expected = amounts.includes(null) ? null : amounts.reduce((sum, amount, i) => sum + amount * ([123.123456789,63.987654321,43.5][i] / 100), 0)
        assert.equal(totals.nutrients[nutrient].value, expected, nutrient)
      }
      assert.equal(version.meals[0].portions[0].food.nutrientsPer100g.vitaminDUg, 0)
      assert.equal(totals.nutrients.leucineG.value, null)
      assert.equal(version.meals[0].portions[2].food.source.citation.includes('[180,\"NULL\",\"907\"]'), true)
    })
    await mountFormPortal(storage, p(f.client), async ui => {
      await ui.open()
      await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
      assert.deepEqual(preview(ui), [123.123456789,63.987654321,43.5])
      assert.equal(node(ui, 'draft-name-0').value, '')
      await ui.click('Hent planens måltider til formular')
      await ui.click('Erstat formular med planens måltider')
      assert.equal(node(ui, 'draft-food-0-1').value, selected[1].id)
      assert.equal(node(ui, 'draft-grams-0-1').value, '63.987654321')
      assert.deepEqual(await counts(f), [1,1,1,0])
    })
    assert.equal(storage.data.get(key) === localBytes, true)
    assert.deepEqual((await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v')).rows[0].value, version)
  })
})

test('mounted scope/version/client/OFF/late callbacks cannot cross ownership or rewrite a legacy draft', async () => {
  const storage = memoryStorage()
  const c = openPortalPlan({ enabled: true, ...scope, athlete: profile, catalog: COACH_FOODS, storage: () => storage }).controller
  assert.equal(c.generate([{ id: 'legacy', name: 'Legacy morgenmad', items: [] }]), true)
  assert.equal(await c.save(), true)
  const legacy = storage.data.get(key)
  let retired
  await mountFormPortal(storage, p(unavailable), async ui => {
    await ui.open()
    const original = preview(ui)
    await build(ui)
    retired = ui.handler(form(ui), 'onSubmit')
    const oldEdit = ui.handler(node(ui, 'draft-name-0'), 'onChange')
    await input(ui, 'draft-name-0', 'Retained new version')
    await ui.act(() => { retired({ preventDefault() {} }); oldEdit({ currentTarget: { value: 'stale' } }) })
    assert.equal(node(ui, 'draft-name-0').value, 'Retained new version')
    assert.deepEqual(preview(ui), original)
    const otherClient = { from() { throw Error('second synthetic unavailable') } }
    await ui.render(p(otherClient))
    assert.equal(node(ui, 'draft-name-0').value, 'Retained new version')
    for (const patch of [{ today: '2026-01-02' }, { athlete: { ...profile, id: 'synthetic-foreign' } }, { session: { user: { id: 'synthetic-foreign-coach' } } }]) {
      const submit = ui.handler(form(ui), 'onSubmit'), edit = ui.handler(node(ui, 'draft-name-0'), 'onChange')
      await ui.render({ ...p(unavailable), ...patch })
      await ui.act(() => { submit({ preventDefault() {} }); edit({ currentTarget: { value: 'stale owner' } }) })
      await ui.open()
      assert.equal(node(ui, 'draft-name-0').value, '')
      assert.deepEqual(preview(ui), [])
    }
    retired = ui.handler(form(ui), 'onSubmit')
    await ui.render({ enabled: false })
    await ui.act(() => retired({ preventDefault() {} }))
    assert.equal(ui.host.textContent, '')
  })
  retired({ preventDefault() {} })
  assert.equal(storage.data.get(key) === legacy, true)
  assert.equal(storage.data.size, 1)
})

test('foreign import scope and stale controller version reject Frida data before any save', () => {
  const storage = memoryStorage(), c = openPortalPlan({ enabled: true, ...scope, athlete: profile, catalog: COACH_FOODS, storage: () => storage }).controller
  const raw = { schema: 'entropi2:meal-draft:v1', ...scope, meals: [{ id: 'm', name: 'Frida', items: [{ foodId: selected[0].id, grams: 10.125 }] }] }
  const v = c.snapshot().version
  for (const patch of [{ athleteId: 'foreign' }, { coachId: 'foreign' }, { date: '2026-01-02' }]) {
    assert.equal(c.importMealDraft(JSON.stringify({ ...raw, ...patch }), v), false)
  }
  assert.equal(c.importMealDraft(JSON.stringify(raw), v + 1), false)
  assert.equal(c.snapshot().meals.length, 0)
  assert.equal(storage.data.size, 0)
  assert.equal(c.importMealDraft(JSON.stringify(raw), v), true)
  assert.equal(c.snapshot().meals[0].items[0].grams, 10.125)
  assert.deepEqual(clone(c.snapshot().meals[0].items[0].food.nutrition), clone(selected[0]))
})
test('normal mounted reference editor preserves silent-reply reservation, typed fields and immutable operation IDs through close/retry', { timeout: 60000 }, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T12:00:00Z') })
  await withDatabase(async f => {
    const storage = memoryStorage()
    await mountFormPortal(storage, p(f.client), async ui => {
      await ui.open(); await build(ui); await apply(ui); await ui.click('Gem som kladde')
      await ui.wait(() => ui.find('button', 'Aktivér for atleten')?.getAttribute('disabled') === null)
      const oldApply = ui.handler(form(ui), 'onSubmit'), oldDate = ui.handler(node(ui, 'plan-date'), 'onChange')
      await ui.click('Aktivér for atleten')
      assert.equal(ui.host.textContent.includes('En aktivering er uafklaret'), true)
      const key = draftKey(scope.coachId, profile.id, scope.date), bytes = storage.data.get(key)
      const original = f.calls.filter(c => c.payload).map(c => ({ table: c.table, payload: clone(c.payload) }))
      assert.equal(JSON.parse(bytes).activationPending, true)
      assert.deepEqual(await counts(f), [1, 1, 0, 0])
      await ui.act(() => { oldApply({ preventDefault() {} }); oldDate({ currentTarget: { value: '2026-11-09' } }) })
      assert.equal(node(ui, 'plan-date').value, scope.date)
      assert.equal(node(ui, 'draft-grams-0-0').value, '123,123456789')
      const d = ui.host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
      await ui.invoke(d, 'onToggle', { currentTarget: { open: false } })
      await ui.invoke(d, 'onToggle', { currentTarget: { open: true } })
      assert.equal(storage.data.get(key), bytes)
      await ui.click('Kontrollér aktivering igen')
      await ui.wait(() => ui.find('button', 'Aktivér for atleten')?.getAttribute('disabled') === null)
      await ui.click('Aktivér for atleten')
      assert.deepEqual(await counts(f), [1, 1, 1, 0])
      const retried = f.calls.filter(c => c.payload)
      for (const old of original) assert.equal(retried.filter(c => c.table === old.table).every(c => JSON.stringify(c.payload) === JSON.stringify(old.payload)), true)
      assert.equal(node(ui, 'draft-grams-0-0').value, '123,123456789')
    })
  }, { lost: names[1] })
})

test('actual SQL approval with a late receipt after OFF cannot rebind the editor or duplicate approval on reopen', { timeout: 60000 }, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T12:00:00Z') })
  await withDatabase(async f => {
    let release, committed = false
    const receipt = new Promise(resolve => { release = resolve })
    const client = { from(table) {
      const q = f.client.from(table); let inserted = false, proxy
      proxy = new Proxy(q, { get(target, key) {
        if (key === 'then') return (resolve, reject) => target.then(async result => {
          if (inserted && table === names[2]) { committed = true; await receipt }
          return result
        }).then(resolve, reject)
        return (...args) => { if (key === 'insert') inserted = true; target[key](...args); return proxy }
      } })
      return proxy
    } }
    const storage = memoryStorage(); let activation
    try {
      await mountFormPortal(storage, p(client), async ui => {
        await ui.open(); await build(ui); await apply(ui); await ui.click('Gem som kladde')
        await ui.wait(() => ui.find('button', 'Aktivér for atleten')?.getAttribute('disabled') === null)
        const activate = ui.handler(ui.find('button', 'Aktivér for atleten'), 'onClick')
        await ui.act(() => { activation = activate() })
        await ui.wait(() => committed)
        assert.deepEqual(await counts(f), [1, 1, 1, 0])
        await ui.render({ enabled: false })
        await ui.act(async () => { release(); await activation })
        assert.equal(ui.host.textContent, '')
        assert.equal(JSON.parse(storage.data.get(draftKey(scope.coachId, profile.id, scope.date))).activationPending, true)
      })
      await mountFormPortal(storage, p(f.client), async ui => {
        await ui.open(); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
        assert.deepEqual(await counts(f), [1, 1, 1, 0])
      })
    } finally { release(); if (activation) await activation }
  })
})
