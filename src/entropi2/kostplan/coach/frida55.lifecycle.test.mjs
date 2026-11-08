// Source5 regression: normal ESM, actual ReactDOM/StrictMode, synthetic storage.
// Reuse the immutable normal host fixture; no hook/module replacements.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { registerHooks } from 'node:module'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { syntheticTables } from './activation.fixture.mjs'
import { draftKey } from './portalModel.mjs'
import { withDatabase, profile, scope as sqlScope, names } from './generatorSql.fixture.mjs'

const evaluated = []
const observer = registerHooks({ load(url, context, next) {
  const result = next(url, context)
  if (/\/frida55(?:\.data)?\.mjs$/.test(url)) evaluated.push(url)
  return result
} })
const { default: PortalPlan } = await import('./PortalPlan.mjs')
const launch = 'Åbn kostplan med Frida-fødevarer'
const base = { enabled: true, today: '2026-11-08', athlete: { id: 'r4-atlet', age: 38, bodyweight: 76, goal: 'maintain' },
  session: { user: { id: 'r4-coach' } }, client: { from() { throw Error('Synthetic offline') } } }
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const input = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const disclosure = ui => ui.host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
const toggle = (ui, open) => ui.invoke(disclosure(ui), 'onToggle', { currentTarget: { open } })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const catalogue = async () => (await import('../foedevarer/frida55Loader.mjs')).loadCoachFoods()
const writes = storage => storage.calls.filter(([action]) => action === 'set').length
const isLoading = ui => ui.host.querySelectorAll('p').some(n => n.textContent === 'Indlæser referencefødevarer til måltidseditoren…')
const isError = ui => ui.host.querySelectorAll('p').some(n => n.getAttribute('role') === 'alert' && n.textContent.startsWith('Referencefødevarer er ikke tilgængelige.'))

// The probe runs during commit, before passive effect cleanups. It does not
// change product hooks and is never part of a delivered product entry point.
function CommitProbe({ run }) {
  React.useLayoutEffect(() => { run?.() }, [run])
  return null
}
export default function LifecycleHost(props) {
  return React.createElement(React.Fragment, null, React.createElement(PortalPlan, props),
    React.createElement(CommitProbe, { run: props.afterCommit }))
}

test('source5 cold mounted consumer: OFF/closed and ordinary200 never evaluate DATA; real reference240 is explicit', async () => {
  const storage = memoryStorage()
  assert.deepEqual(evaluated, [])
  await mountFridaPortal(storage, { enabled: false }, async ui => {
    assert.equal(ui.host.textContent, '')
    await ui.render({ ...base, weightStatus: { athleteId: base.athlete.id, state: 'ready', rows: [] } })
    assert.ok(ui.find('button', launch))
    assert.equal(ui.host.querySelectorAll('input,select,textarea,form').length, 0)
    assert.equal(storage.calls.length, 0)
    assert.deepEqual(evaluated, [])
  }, '../../kostMaalKobling.mjs')
  let loads = 0
  await mountFridaPortal(storage, { ...base, loadReferenceFoods: () => { loads++; throw Error('Ordinary path loaded reference') } }, async ui => {
    const oldLaunch = ui.handler(ui.find('button', launch), 'onClick')
    await ui.openRaw()
    assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 201)
    await input(ui, 'draft-name-0', 'R4 almindeligt måltid')
    await input(ui, 'draft-grams-0-0', '38,271828')
    await ui.act(() => oldLaunch())
    await toggle(ui, false); await toggle(ui, true)
    assert.equal(field(ui, 'draft-name-0').value, 'R4 almindeligt måltid')
    assert.equal(field(ui, 'draft-grams-0-0').value, '38,271828')
    assert.equal(loads, 0)
    assert.deepEqual(evaluated, [])
  })
  await mountFridaPortal(storage, base, async ui => {
    assert.deepEqual(evaluated, [])
    await ui.open()
    assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 241)
    assert.equal(evaluated.filter(url => url.endsWith('/frida55.data.mjs')).length, 1)
    assert.equal(evaluated.filter(url => url.endsWith('/frida55.mjs')).length, 1)
  })
  assert.equal(writes(storage), 0)
})

test('source5 detached onToggle retires before passive cleanup, with owner/date/athlete/OFF and StrictMode ref replay', async () => {
  const changes = [{ enabled: false }, { today: '2026-11-10' }, { athlete: { ...base.athlete, id: 'r4-anden-atlet' } }, { session: { user: { id: 'r4-anden-coach' } } }]
  for (const change of changes) {
    const storage = memoryStorage(); let oldToggle, oldLaunch, probed = 0, loads = 0
    const props = { ...base, loadReferenceFoods: () => { loads++; return new Promise(() => {}) } }
    const poison = { get currentTarget() { throw Error('Detached callback read event before passive cleanup') } }
    await mountFridaPortal(storage, props, async ui => {
      oldToggle = ui.handler(disclosure(ui), 'onToggle')
      oldLaunch = ui.handler(ui.find('button', launch), 'onClick')
      await ui.render({ ...props, ...change, afterCommit: () => { probed++; oldToggle(poison); oldLaunch() } })
      assert.ok(probed > 0)
      assert.equal(loads, 0)
      assert.equal(Boolean(field(ui, 'draft-name-0')), false)
      if (change.enabled !== false) {
        // A fresh ref replay must leave the new scope live.
        await ui.requestReference()
        assert.equal(loads, 1)
      }
    }, './frida55.lifecycle.test.mjs')
    oldToggle(poison); oldLaunch()
    assert.equal(writes(storage), 0)
  }
})

test('source5 retry and changed loader show loading for the current request; retired success and rejection stay inert', async () => {
  const storage = memoryStorage(), one = deferred(), two = deferred(), three = deferred()
  const first = () => one.promise, second = () => two.promise, third = () => three.promise
  await mountFridaPortal(storage, { ...base, loadReferenceFoods: first }, async ui => {
    await ui.requestReference()
    assert.equal(isLoading(ui), true)
    await ui.act(() => one.reject(Error('R4 first offline')))
    assert.equal(isError(ui), true)
    await ui.render({ ...base, loadReferenceFoods: second })
    assert.equal(isLoading(ui), true); assert.equal(isError(ui), false)
    await ui.render({ ...base, loadReferenceFoods: third })
    await ui.act(async () => two.resolve(await catalogue()))
    assert.equal(Boolean(field(ui, 'draft-name-0')), false)
    assert.equal(storage.calls.length, 0)
    await ui.act(() => three.reject(Error('R4 current offline')))
    assert.equal(isError(ui), true)
    const retry = deferred(); let calls = 0
    const load = () => { calls++; return retry.promise }
    await ui.render({ ...base, loadReferenceFoods: load })
    assert.equal(isLoading(ui), true)
    await toggle(ui, false)
    await ui.act(() => retry.reject(Error('R4 retired rejection')))
    assert.equal(isError(ui), false)
    assert.equal(Boolean(field(ui, 'draft-name-0')), false)
    assert.equal(calls, 1)
    await ui.render({ ...base, loadReferenceFoods: catalogue })
    await toggle(ui, true)
    await ui.wait(() => Boolean(field(ui, 'draft-name-0')))
    assert.equal(isError(ui), false); assert.equal(isLoading(ui), false)
  })
  assert.equal(writes(storage), 0)
})

test('source5 retry click and close/reopen retire a visible error without a synchronous effect state reset', async () => {
  const storage = memoryStorage(), pending = deferred(); let calls = 0
  const load = () => { calls++; return calls === 1 ? Promise.reject(Error('First failure')) : pending.promise }
  await mountFridaPortal(storage, { ...base, loadReferenceFoods: load }, async ui => {
    await ui.requestReference(); assert.equal(isError(ui), true)
    await ui.click('Prøv referencefødevarer igen')
    assert.equal(isLoading(ui), true); assert.equal(isError(ui), false)
    await toggle(ui, false); await toggle(ui, true)
    assert.equal(calls, 3)
    assert.equal(isLoading(ui), true)
    await ui.act(async () => pending.resolve(await catalogue()))
    assert.ok(field(ui, 'draft-name-0'))
    assert.equal(isError(ui), false)
  })
  assert.equal(writes(storage), 0)
})

test('source5 ready controller keeps exact typed meal/grams/advice and ignores late client reads and changed loader', async () => {
  const storage = memoryStorage(), pending = deferred(), old = syntheticTables({ before: () => pending.promise }), replacement = syntheticTables({ missing: true })
  let loads = 0
  const load = async () => { loads++; return catalogue() }
  await mountFridaPortal(storage, { ...base, client: old.client, loadReferenceFoods: load }, async ui => {
    await ui.open()
    await input(ui, 'draft-name-0', 'R4 navngivet sen frokost')
    await input(ui, 'draft-time-0', '14:27')
    await input(ui, 'draft-food-0-0', 'frida55:754')
    await input(ui, 'draft-grams-0-0', '91,314159265')
    await input(ui, 'portionGuidance', 'R4 behold denne ordlyd')
    const fields = ['draft-name-0', 'draft-time-0', 'draft-food-0-0', 'draft-grams-0-0', 'portionGuidance']
    const before = fields.map(name => field(ui, name).value)
    const reads = storage.calls.length
    await toggle(ui, false); await toggle(ui, true)
    await ui.render({ ...base, client: replacement.client, loadReferenceFoods: () => { throw Error('Ready catalogue reloaded') } })
    await ui.act(() => pending.resolve())
    assert.deepEqual(fields.map(name => field(ui, name).value), before)
    assert.equal(loads, 1)
    assert.equal(storage.calls.length, reads)
    assert.equal(old.writes().length, 0); assert.equal(replacement.writes().length, 0)
  })
  assert.equal(writes(storage), 0)
})

test('source5 original SQL: lost plan-create reply retains reservation and typed payload through close/reopen, then exactly one approval/readback', { timeout: 60000 }, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T12:00:00Z') })
  await withDatabase(async f => {
    const storage = memoryStorage()
    const props = { ...base, athlete: profile, session: { user: { id: sqlScope.coachId } }, client: f.client }
    const key = draftKey(sqlScope.coachId, profile.id, base.today)
    const counts = async () => {
      const rows = []
      for (const name of [...names, 'meal_logs']) rows.push(Number((await f.db.query(`select count(*) n from public.${name}`)).rows[0].n))
      return rows
    }
    await mountFridaPortal(storage, props, async ui => {
      const oldLaunch = ui.handler(ui.find('button', launch), 'onClick')
      await ui.open()
      assert.deepEqual(await counts(), [0, 0, 0, 0])
      assert.equal(writes(storage), 0)
      await input(ui, 'draft-name-0', 'R4 gemt måltid')
      await input(ui, 'draft-food-0-0', 'frida55:914')
      await input(ui, 'draft-grams-0-0', '62,718281828')
      await input(ui, 'portionGuidance', 'R4 gemt råd med uændret operation')
      await ui.submit('Formularkladde · navngivne måltider')
      await ui.click('Gem som kladde')
      assert.deepEqual(await counts(), [0, 0, 0, 0])
      await ui.wait(() => ui.find('button', 'Aktivér for atleten')?.getAttribute('disabled') === null)
      const oldDate = ui.handler(field(ui, 'plan-date'), 'onChange')
      await ui.click('Aktivér for atleten')
      assert.deepEqual(await counts(), [1, 0, 0, 0])
      const bytes = storage.data.get(key), saved = JSON.parse(bytes), writeCount = writes(storage)
      assert.equal(saved.activationPending, true)
      const original = f.calls.filter(call => call.payload).map(call => ({ table: call.table, payload: structuredClone(call.payload) }))
      await ui.act(() => { oldLaunch(); oldDate({ currentTarget: { value: '2026-11-12' } }) })
      await toggle(ui, false); await toggle(ui, true)
      await ui.render({ ...props, loadReferenceFoods: () => { throw Error('Pending controller replaced') } })
      assert.equal(field(ui, 'plan-date').value, base.today)
      assert.equal(Number(field(ui, 'grams-0-0').value), 62.718281828)
      assert.equal(field(ui, 'portionGuidance').value, 'R4 gemt råd med uændret operation')
      assert.equal(storage.data.get(key), bytes)
      assert.equal(writes(storage), writeCount)
      await ui.click('Kontrollér aktivering igen')
      await ui.wait(() => ui.find('button', 'Aktivér for atleten')?.getAttribute('disabled') === null)
      await ui.click('Aktivér for atleten')
      assert.deepEqual(await counts(), [1, 1, 1, 0])
      for (const old of original) assert.ok(f.calls.filter(call => call.table === old.table && call.payload).every(call => JSON.stringify(call.payload) === JSON.stringify(old.payload)))
      const version = (await f.db.query('select meals from public.kostplan_v1_versions')).rows[0]
      assert.equal(version.meals[0].name, 'R4 gemt måltid')
      assert.equal(version.meals[0].portions[0].grams, 62.718281828)
    })
    const bytes = storage.data.get(key), writesBefore = writes(storage), sqlWrites = f.calls.filter(call => call.payload).length
    await mountFridaPortal(storage, props, async ui => {
      await ui.open()
      await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
      assert.equal(storage.data.get(key), bytes)
      assert.equal(writes(storage), writesBefore)
      assert.equal(f.calls.filter(call => call.payload).length, sqlWrites)
      assert.deepEqual(await counts(), [1, 1, 1, 0])
    })
  }, { lost: names[0] }) // Pinned fixture always closes PGlite in finally.
})

test.after(() => observer.deregister())
