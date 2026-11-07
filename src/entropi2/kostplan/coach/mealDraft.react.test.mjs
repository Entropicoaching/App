import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as vm from 'node:vm'
import { fileURLToPath } from 'node:url'
// The normal app runner also executes this gate serially. No skipped VM gate.
if (!vm.SourceTextModule) {
 test('actual mounted meal draft + original SQL (isolated realm child)', { timeout: 180000 }, () => {
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--test', '--test-concurrency=1', fileURLToPath(import.meta.url)], { encoding: 'utf8', timeout: 170000, env: {} })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /tests 5/); assert.match(result.stdout, /pass 5/)
 })
} else {
 const { act } = await import('react')
 const { mountMealPortal, clone } = await import('./mealDraftReact.fixture.mjs')
 const { withDatabase, scope, profile, names, date, athleteId, coachId } = await import('./generatorSql.fixture.mjs')
 const { memoryStorage } = await import('./portal.fixture.mjs')
 const { draftKey, openPortalPlan } = await import('./portalModel.mjs')
 const { startPlanActivation } = await import('./activation.mjs')
 const { totals } = await import('./model.mjs')
 const { FOODS } = await import('../foedevarer/index.mjs')
 const props = { enabled: true, athlete: profile, today: date, session: { user: { id: coachId } } }
 const key = draftKey(coachId, athleteId, date)
 const draft = () => ({ schema: 'entropi2:meal-draft:v1', ...scope,
  meals: ['07:00 Morgenmad', '10:00 Mellemmåltid', '12:30 Frokost', '15:00 Før træning', '18:30 Aftensmad', '21:00 Aften'].map((name, i) => ({ id: `synthetic-${i}`, name, items: [{ foodId: FOODS[i].id, grams: 120.125 + i * 10 }] })) })
 const importForm = ui => ui.host.querySelectorAll('form').find(n => n.textContent.includes('Manuel måltidskladde'))
 const input = ui => ui.host.querySelectorAll('textarea').find(n => (n.name ?? n.getAttribute('name')) === 'meal-draft-json')
 const load = async (ui, raw = draft()) => { await ui.input('meal-draft-json', typeof raw === 'string' ? raw : JSON.stringify(raw)); await ui.submit('Manuel måltidskladde') }
 const writes = f => f.calls.filter(c => c.payload)
 const counts = async f => { const result = []; for (const name of names) result.push(Number((await f.db.query(`select count(*) n from public.${name}`)).rows[0].n)); return result }
 const sqlMeals = meals => meals.map(m => ({ name: m.name, portions: m.items.map(i => ({ grams: i.grams,
  food: Object.fromEntries(['id', 'name', 'preparation', 'basisGrams', 'nutrientsPer100g', 'source'].map(k => [k, i.food.nutrition[k]])) })) }))
 const open = storage => openPortalPlan({ enabled: true, ...scope, athlete: profile, storage: () => storage }).controller
 const connect = async (c, client) => {
  const stop = startPlanActivation({ controller: c, ...scope, client })
  for (let i = 0; i < 500 && c.snapshot().activationState === 'checking'; i++) await new Promise(r => setImmediate(r))
  assert.equal(c.snapshot().activationState, 'ready'); return stop
 }

 test('actual mounted six-meal import -> exact preview -> normal save -> original SQL approval; unchanged reopen/import/save adds no approval', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage(), originalProfile = structuredClone(profile)
  let stored, version
  await mountMealPortal(storage, { ...props, client: f.client }, async ui => {
   assert.equal(storage.data.size, 0); assert.ok(!input(ui))
   await ui.open()
   const baseline = ui.host.querySelectorAll('form').find(n => n.textContent.includes('Vælg måltider til forslaget'))
   assert.deepEqual(baseline.querySelectorAll('legend').map(n => n.textContent), ['Morgenmad', 'Frokost', 'Aftensmad'])
   await ui.input('meal-draft-json', JSON.stringify(draft()))
   assert.ok(!ui.host.querySelectorAll('input').some(n => (n.name ?? n.getAttribute('name')) === 'grams-5-0'))
   assert.equal(storage.data.size, 0); assert.equal(writes(f).length, 0)
   await ui.submit('Manuel måltidskladde')
   assert.match(ui.host.textContent, /Manuel måltidskladde · gram er indlæst præcist/)
   for (const [mi, meal] of draft().meals.entries()) {
    assert.ok(ui.host.querySelectorAll('legend').some(n => n.textContent === meal.name))
    const grams = ui.host.querySelectorAll('input').find(n => (n.name ?? n.getAttribute('name')) === `grams-${mi}-0`)
    assert.equal(Number(grams.value), meal.items[0].grams)
   }
   assert.equal(storage.data.size, 0); assert.equal(writes(f).length, 0)
   await ui.click('Gem som kladde')
   stored = JSON.parse(storage.data.get(key)); assert.equal(stored.manualImport, true)
   assert.deepEqual(stored.plan.meals.map(m => ({ id: m.id, name: m.name, items: m.items.map(i => ({ foodId: i.food.id, grams: i.grams })) })), draft().meals)
   const c = open(storage); assert.deepEqual(c.snapshot().totals, totals(stored.plan.meals))
   assert.equal(writes(f).length, 0)
   await ui.wait(() => !!ui.find('button', 'Aktivér for atleten') && ui.find('button', 'Aktivér for atleten').getAttribute('disabled') === null)
   await ui.click('Aktivér for atleten')
   await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
   assert.deepEqual(await counts(f), [1, 1, 1])
   version = (await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
   assert.deepEqual(version.meals, sqlMeals(stored.plan.meals))
   assert.deepEqual(writes(f).map(c => c.table), names)
  })
  const before = writes(f).length
  await mountMealPortal(storage, { ...props, client: f.client }, async ui => {
   await ui.open(); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
   await load(ui); await ui.click('Gem som kladde')
   const row = JSON.parse(storage.data.get(key))
   assert.equal(row.clientVersion, stored.clientVersion)
   assert.deepEqual(row.plan.meals, stored.plan.meals)
   assert.notEqual(ui.find('button', 'Aktivér for atleten').getAttribute('disabled'), null)
   assert.equal(writes(f).length, before)
   const changed = draft(); changed.meals[0].items[0].grams += 0.25
   await load(ui, changed)
   assert.equal(writes(f).length, before)
   assert.notEqual(ui.find('button', 'Aktivér for atleten').getAttribute('disabled'), null)
   await ui.click('Gem som kladde')
   assert.equal(ui.find('button', 'Aktivér for atleten').getAttribute('disabled'), null)
   await ui.click('Aktivér for atleten'); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
   assert.deepEqual(await counts(f), [2, 2, 2])
  })
  assert.deepEqual((await f.db.query('select * from public.kostplan_v1_versions where id=$1', [version.id])).rows[0], version)
  assert.deepEqual(profile, originalProfile)
 }))

 test('actual mounted invalid/polluted input retains text, error and preview; stale version/scope/OFF/disposal callbacks do nothing', async () => {
  const storage = memoryStorage(), client = { from() { throw Error('Synthetic unavailable') } }
  let retained
  await mountMealPortal(storage, { ...props, client }, async ui => {
   await ui.open(); await load(ui)
   const first = ui.host.querySelectorAll('input').find(n => (n.name ?? n.getAttribute('name')) === 'grams-0-0').value
   for (const raw of ['{', JSON.stringify({ ...draft(), advice: 'unsupported' }), JSON.stringify(draft()).replace('"schema":', '"__proto__":{"polluted":true},"schema":'), JSON.stringify({ ...draft(), date: '2026-11-08' })]) {
    await load(ui, raw)
    assert.equal(input(ui).value, raw); assert.match(ui.host.textContent, /Ugyldig måltidskladde/)
    assert.equal(ui.host.querySelectorAll('input').find(n => (n.name ?? n.getAttribute('name')) === 'grams-0-0').value, first)
    assert.equal(storage.data.size, 0)
   }
   await ui.input('meal-draft-json', JSON.stringify(draft()))
   const stale = ui.handler(importForm(ui), 'onSubmit')
   await ui.submit('Manuel måltidskladde') // unchanged keeps version
   const changed = draft(); changed.meals[0].name = '<synthetic changed>'
   await load(ui, changed)
   await act(async () => { stale({ preventDefault() {} }) })
   assert.ok(ui.host.querySelectorAll('legend').some(n => n.textContent === '<synthetic changed>'))
   assert.equal(storage.data.size, 0)
   retained = ui.handler(importForm(ui), 'onSubmit')
   for (const patch of [{ today: '2026-11-08' }, { athlete: { ...profile, id: 'synthetic-other' } }, { session: { user: { id: 'synthetic-other-coach' } } }]) {
    await ui.render({ ...props, client, ...patch }); await act(async () => { retained({ preventDefault() {} }) })
    assert.ok(!input(ui)); await ui.open(); assert.equal(input(ui).value, '')
    await load(ui); assert.match(ui.host.textContent, /Ugyldig måltidskladde/)
    assert.ok(!ui.host.querySelectorAll('input').some(n => (n.name ?? n.getAttribute('name')) === 'grams-0-0'))
    assert.equal(storage.data.size, 0)
   }
   retained = ui.handler(importForm(ui), 'onSubmit')
   await ui.render({ enabled: false }); await act(async () => { retained({ preventDefault() {} }) })
   assert.equal(ui.host.textContent, ''); assert.equal(storage.data.size, 0)
  })
  await retained({ preventDefault() {} }); assert.equal(storage.data.size, 0); assert.equal({}.polluted, undefined)
 })

 test('mounted live activation race blocks retained import before/during reserved SQL write; exact immutable original is approved', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage()
  let release, entered = false
  const held = new Promise(r => { release = r })
  const client = { from(table) {
   const q = f.client.from(table); let inserting = false
   const proxy = new Proxy(q, { get(target, key) {
    if (key === 'then') return (resolve, reject) => (async () => { if (inserting) { entered = true; await held } return await target })().then(resolve, reject)
    if (typeof target[key] === 'function') return (...args) => { if (key === 'insert') inserting = true; target[key](...args); return proxy }
    return target[key]
   } }); return proxy
  } }
  await mountMealPortal(storage, { ...props, client }, async ui => {
   await ui.open(); await load(ui); await ui.click('Gem som kladde')
   const saved = JSON.parse(storage.data.get(key)), changed = draft(); changed.meals[0].items[0].grams += 15
   await ui.input('meal-draft-json', JSON.stringify(changed))
   const oldImport = ui.handler(importForm(ui), 'onSubmit')
   await ui.wait(() => !!ui.find('button', 'Aktivér for atleten') && ui.find('button', 'Aktivér for atleten').getAttribute('disabled') === null)
   let activation
   act(() => { activation = ui.handler(ui.find('button', 'Aktivér for atleten'), 'onClick')() })
   await ui.wait(() => entered)
   try {
    assert.equal(JSON.parse(storage.data.get(key)).activationPending, true)
    const bytes = storage.data.get(key)
    await act(async () => { oldImport({ preventDefault() {} }) })
    assert.equal(storage.data.get(key), bytes)
    assert.equal(Number(ui.host.querySelectorAll('input').find(n => (n.name ?? n.getAttribute('name')) === 'grams-0-0').value), saved.plan.meals[0].items[0].grams)
   } finally { release(); await act(async () => { await activation }) }
   await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
   const row = (await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
   assert.deepEqual(row.meals, sqlMeals(saved.plan.meals)); assert.deepEqual(await counts(f), [1, 1, 1])
  })
 }))

 test('lost SQL replies preserve pending imported draft, original operation IDs and payload; only original retry/reconciliation succeeds', { timeout: 90000 }, async () => {
  for (const lost of names) await withDatabase(async f => {
   const storage = memoryStorage(), c = open(storage)
   assert.equal(c.importMealDraft(JSON.stringify(draft()), 0), true); assert.equal(await c.save(), true)
   let stop = await connect(c, f.client)
   try {
    assert.equal(await c.activate(), false); assert.equal(c.snapshot().activationPending, true)
    const bytes = storage.data.get(key), meals = c.snapshot().meals, calls = clone(writes(f))
    const changed = draft(); changed.meals[0].items[0].grams += 1
    assert.equal(c.importMealDraft(JSON.stringify(changed), c.snapshot().version), false)
    assert.equal(c.generate(), false); assert.equal(await c.save(), false)
    assert.deepEqual(c.snapshot().meals, meals); assert.equal(storage.data.get(key), bytes)
    stop()
    const reopened = open(storage), cleanup = await connect(reopened, f.client)
    try {
     if (lost !== names[2]) {
      assert.equal(reopened.snapshot().activationPending, true)
      assert.equal(reopened.importMealDraft(JSON.stringify(changed), reopened.snapshot().version), false)
      assert.equal(await reopened.activate(), false); assert.equal(storage.data.get(key), bytes)
     } else assert.equal(reopened.snapshot().publishedVersion, reopened.snapshot().version)
     assert.equal(writes(f).length, calls.length)
    } finally { cleanup() }
    stop = await connect(c, f.client)
    if (lost !== names[2]) assert.equal(await c.activate(), true)
    assert.deepEqual(await counts(f), [1, 1, 1])
    assert.equal(writes(f).find(c => c.table === names[0]).payload.id, calls[0].payload.id)
    assert.deepEqual((await f.db.query('select * from public.kostplan_v1_versions')).rows[0].meals, sqlMeals(meals))
   } finally { stop() }
  }, { lost })
 })

 test('mounted explicit automatic recommendation stays separate and available after manual preview', async () => {
  await mountMealPortal(memoryStorage(), { ...props, client: { from() { throw Error('Synthetic unavailable') } } }, async ui => {
   await ui.open(); await load(ui)
   const f = ui.host.querySelectorAll('form').find(n => n.textContent.includes('Dagens mål'))
   await act(async () => { ui.handler(f, 'onSubmit')({ preventDefault() {} }) })
   assert.ok(!ui.host.textContent.includes('Manuel måltidskladde · gram er indlæst præcist'))
   const names = ui.host.querySelectorAll('legend').map(n => n.textContent)
   for (const name of ['Morgenmad', 'Frokost', 'Aftensmad']) assert.ok(names.includes(name))
  })
 })
}
