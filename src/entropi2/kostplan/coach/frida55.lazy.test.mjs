import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
const trace = []
const hook = registerHooks({ resolve(s, c, next) {
  const result = next(s, c)
  if (/\/frida55(?:\.data)?\.mjs$/.test(result.url)) trace.push({ from: c.parentURL, to: result.url })
  return result
} })
const { mountFridaPortal } = await import('./frida55.normal.fixture.mjs')
const { memoryStorage } = await import('./portal.fixture.mjs')
const { openPortalPlan, draftKey } = await import('./portalModel.mjs')
const { FOODS } = await import('../foedevarer/index.mjs')
const props = { enabled: true, today: '2026-11-08', athlete: { id: 'lazy-athlete', age: 33, bodyweight: 80, goal: 'cut' },
  session: { user: { id: 'lazy-coach' } }, client: { from() { throw Error('synthetic offline') } } }
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const change = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const details = ui => ui.host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
const toggle = (ui, open) => ui.invoke(details(ui), 'onToggle', { currentTarget: { open } })
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const catalogue = async () => (await import('../foedevarer/frida55Loader.mjs')).loadCoachFoods()
const noWrites = s => assert.equal(s.calls.filter(c => c[0] === 'set').length, 0)

test('fresh normal ESM: unopened/OFF/missing actor/legacy do not resolve data; explicit reference launch really imports both modules', async () => {
  const storage = memoryStorage()
  try {
    assert.equal(trace.length, 0)
    await mountFridaPortal(storage, { enabled: false }, async ui => {
      assert.equal(ui.host.textContent, '')
      await ui.render({ enabled: true, today: props.today, athlete: props.athlete })
      assert.equal(ui.host.textContent, '')
      await ui.render(props)
      assert.equal(trace.length, 0)
      const launch = ui.find('button', 'Åbn kostplan med Frida-fødevarer')
      const retired = ui.handler(launch, 'onClick')
      await ui.openRaw()
      assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 201)
      await change(ui, 'draft-name-0', 'Legacy typed before stale launch')
      await ui.act(() => retired())
      assert.equal(field(ui, 'draft-name-0').value, 'Legacy typed before stale launch')
      assert.equal(trace.length, 0)
      noWrites(storage)
    })
    await mountFridaPortal(storage, props, async ui => {
      assert.equal(trace.length, 0)
      await ui.open()
      assert.equal(trace.some(e => /\/frida55\.mjs$/.test(e.to)), true)
      assert.equal(trace.some(e => /\/frida55\.data\.mjs$/.test(e.to)), true)
      assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 241)
      await change(ui, 'draft-name-0', 'Unsaved reference name')
      await change(ui, 'draft-time-0', '12:31')
      await change(ui, 'draft-food-0-0', 'frida55:1')
      await change(ui, 'draft-grams-0-0', '123,456789')
      await toggle(ui, false); await toggle(ui, true)
      await ui.render({ ...props, nutritionRead: { state: 'loading' }, loadReferenceFoods: () => { throw Error('Must not reload ready controller') } })
      for (const [name, value] of [['draft-name-0', 'Unsaved reference name'], ['draft-time-0', '12:31'], ['draft-food-0-0', 'frida55:1'], ['draft-grams-0-0', '123,456789']]) assert.equal(field(ui, name).value, value)
      noWrites(storage)
    })
    console.log('Normal ESM reference resolution edges:', JSON.stringify(trace))
  } finally { hook.deregister() }
})

test('pending close retires load, retry is real, and late completion never replaces a typed editor', async () => {
  const storage = memoryStorage(), first = defer(), second = defer(); let calls = 0
  const loadReferenceFoods = () => (++calls === 1 ? first : second).promise
  await mountFridaPortal(storage, { ...props, loadReferenceFoods }, async ui => {
    await ui.requestReference()
    assert.equal(calls, 1)
    assert.equal(Boolean(field(ui, 'draft-name-0')), false)
    assert.equal(ui.host.textContent.includes('Indlæser referencefødevarer'), true)
    await toggle(ui, false)
    await ui.act(async () => first.resolve(await catalogue()))
    assert.equal(Boolean(field(ui, 'draft-name-0')), false)
    await toggle(ui, true)
    assert.equal(calls, 2)
    await ui.act(async () => second.resolve(await catalogue()))
    assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 241)
    await change(ui, 'draft-name-0', 'Retained after load')
    await toggle(ui, false); await toggle(ui, true)
    assert.equal(calls, 2)
    assert.equal(field(ui, 'draft-name-0').value, 'Retained after load')
    noWrites(storage)
  })
})

test('saved Frida bytes survive offline/reject/invalid catalogue; retry restores exact snapshots without fallback writes', async () => {
  const storage = memoryStorage(), catalog = await catalogue()
  const scope = { coachId: props.session.user.id, athleteId: props.athlete.id, date: props.today }
  const key = draftKey(scope.coachId, scope.athleteId, scope.date)
  const c = openPortalPlan({ enabled: true, ...scope, athlete: props.athlete, storage: () => storage, catalog }).controller
  assert.equal(c.importMealDraft(JSON.stringify({ schema: 'entropi2:meal-draft:v1', ...scope,
    meals: [{ id: 'saved', name: 'Saved reference', items: [{ foodId: 'frida55:1', grams: 17.123456789 }] }] }), c.snapshot().version), true)
  assert.equal(await c.save(), true)
  const bytes = storage.data.get(key), before = storage.calls.filter(c => c[0] === 'set').length
  const pending = defer(); let calls = 0
  const loadReferenceFoods = () => { calls++; return calls === 1 ? pending.promise : calls === 2 ? Promise.resolve(FOODS) : catalogue() }
  await mountFridaPortal(storage, { ...props, loadReferenceFoods }, async ui => {
    await ui.requestReference()
    await ui.act(() => pending.reject(Error('Synthetic offline')))
    assert.equal(ui.host.textContent.includes('Referencefødevarer er ikke tilgængelige'), true)
    assert.equal(Boolean(field(ui, 'draft-name-0')), false)
    assert.equal(storage.data.get(key), bytes)
    await ui.click('Prøv referencefødevarer igen')
    assert.equal(ui.host.textContent.includes('Referencefødevarer er ikke tilgængelige'), true)
    assert.equal(Boolean(field(ui, 'draft-name-0')), false)
    await ui.click('Prøv referencefødevarer igen')
    await ui.wait(() => Boolean(field(ui, 'draft-name-0')))
    assert.equal(Number(field(ui, 'grams-0-0').value), 17.123456789)
    assert.equal(storage.data.get(key), bytes)
    assert.equal(storage.calls.filter(c => c[0] === 'set').length, before)
  })
})

test('late load after owner/date/OFF/unmount is ignored with no catalogue or prior-plan leakage', async () => {
  for (const patch of [{ today: '2026-11-09' }, { athlete: { ...props.athlete, id: 'new-athlete' } }, { session: { user: { id: 'new-coach' } } }, { enabled: false }]) {
    const storage = memoryStorage(), pending = defer()
    await mountFridaPortal(storage, { ...props, loadReferenceFoods: () => pending.promise }, async ui => {
      await ui.requestReference()
      await ui.render({ ...props, ...patch, loadReferenceFoods: () => pending.promise })
      await ui.act(async () => pending.resolve(await catalogue()))
      assert.equal(Boolean(field(ui, 'draft-name-0')), false)
      assert.equal(ui.host.textContent.includes('CC BY 4.0'), false)
      noWrites(storage)
    })
  }
  const storage = memoryStorage(), pending = defer()
  await mountFridaPortal(storage, { ...props, loadReferenceFoods: () => pending.promise }, async ui => { await ui.requestReference() })
  pending.resolve(await catalogue()); await Promise.resolve()
  noWrites(storage)
})
