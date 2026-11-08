import test from 'node:test'
import assert from 'node:assert/strict'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const base = { enabled: true, today: '2028-02-28', athlete: { id: 'overview-athlete', protein_target: 140 },
  session: { user: { id: 'overview-coach' } }, client: { from() { throw Error('Synthetic offline') } } }
const scope = date => ({ enabled: true, coachId: base.session.user.id, athlete: base.athlete, date })
const button = 'Vis kladder for fire dage'
const rows = ui => ui.host.querySelectorAll('li').filter(n => n.getAttribute('data-plan-day'))
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const input = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const toggle = (ui, open) => ui.click(open ? button : 'Skjul kladdeoverblik')
const reads = storage => storage.calls.filter(([action]) => action === 'get')
const writes = storage => storage.calls.filter(([action]) => action === 'set')
async function saved(storage, date, pending = false) {
  const c = openPortalPlan({ ...scope(date), storage: () => storage,
    template: [{ id: 'saved-meal', name: '<b>Gemte havregryn</b>', items: [{ foodId: FOODS[0].id, grams: 100 }] }] }).controller
  c.set('maintenanceKcal', '2400'); c.set('fat', '70'); c.setAdvice('Gemte råd')
  assert.equal(c.generate(), true); assert.equal(await c.save(), true)
  const key = draftKey(base.session.user.id, base.athlete.id, date)
  if (pending) storage.data.set(key, JSON.stringify({ ...JSON.parse(storage.data.get(key)), activationPending: true }))
  return c
}

test('overview lead: normal mounted consumer exposes an explicit collapsed four-day overview without storage reads', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, { enabled: false }, async ui => {
    assert.equal(ui.host.textContent, ''); assert.equal(storage.calls.length, 0)
    await ui.render({ ...base, weightStatus: { athleteId: base.athlete.id, state: 'ready', rows: [] } })
    assert.equal(ui.find('button', button), undefined); assert.equal(storage.calls.length, 0)
    await ui.openRaw(); storage.calls.length = 0
    assert.ok(ui.find('button', button), 'Normal opened coach consumer must expose the overview')
    assert.equal(ui.handler(ui.find('button', button), 'aria-expanded'), false)
    assert.equal(rows(ui).length, 0); assert.equal(storage.calls.length, 0)
    await toggle(ui, true)
    assert.deepEqual(rows(ui).map(n => n.getAttribute('data-plan-day')), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02'])
    assert.equal(rows(ui).filter(n => n.getAttribute('aria-current') === 'date').length, 1)
    assert.match(rows(ui)[0].textContent, /28\. februar 2028.*Valgt plandato/)
    assert.match(ui.host.textContent, /Ingen gemte lokale kladder i de fire dage/)
    assert.equal(reads(storage).length, 4); assert.equal(writes(storage).length, 0)
    await toggle(ui, false); assert.equal(reads(storage).length, 4)
  }, '../../kostMaalKobling.mjs')
})

test('overview shows strictly saved counts, missing, unreadable and pending separately; refresh is bounded and read only', async () => {
  const storage = memoryStorage()
  await saved(storage, '2028-02-28'); await saved(storage, '2028-03-01', true)
  storage.data.set(draftKey(base.session.user.id, base.athlete.id, '2028-03-02'), '{broken')
  storage.data.set('unrelated-private-key', 'must never read')
  storage.calls.length = 0
  await mountFridaPortal(storage, base, async ui => {
    await ui.openRaw(); storage.calls.length = 0
    await toggle(ui, true)
    const list = rows(ui)
    assert.match(list[0].textContent, /Lokal kladde gemt.*1 gemte måltider: <b>Gemte havregryn<\/b>/)
    assert.match(list[1].textContent, /Ingen lokal kladde gemt/)
    assert.match(list[2].textContent, /afventende aktiveringsreservation.*1 gemte måltider/)
    assert.match(list[3].textContent, /kunne ikke læses/)
    assert.equal(ui.host.querySelectorAll('b').length, 0)
    assert.ok(list.every(n => n.textContent.includes('Aktiv plan: ikke indlæst')))
    assert.equal(reads(storage).length, 4)
    assert.deepEqual(new Set(reads(storage).map(([, key]) => key)), new Set(['2028-02-28','2028-02-29','2028-03-01','2028-03-02'].map(date => draftKey(base.session.user.id, base.athlete.id, date))))
    const refresh = ui.handler(ui.find('button', 'Opdatér kladdeoverblik'), 'onClick')
    await toggle(ui, false); await ui.act(() => refresh())
    assert.equal(reads(storage).length, 4, 'Retained refresh cannot read while closed')
    await toggle(ui, true); assert.equal(reads(storage).length, 8)
    storage.data.delete(draftKey(base.session.user.id, base.athlete.id, '2028-03-02'))
    await ui.click('Opdatér kladdeoverblik'); assert.match(rows(ui)[3].textContent, /Ingen lokal kladde gemt/)
    assert.equal(reads(storage).length, 12); assert.equal(writes(storage).length, 0)
    await ui.render({ enabled: false }); await ui.act(() => refresh())
    assert.equal(reads(storage).length, 12)
  })
})

test('unavailable storage is truthful and retry reads the same four scoped keys only', async () => {
  const storage = memoryStorage(), get = storage.getItem
  let blocked = true
  storage.getItem = key => { if (blocked) { storage.calls.push(['get', key]); throw Error('Synthetic denied') } return get(key) }
  await mountFridaPortal(storage, base, async ui => {
    await ui.openRaw(); storage.calls.length = 0
    await toggle(ui, true)
    assert.equal(rows(ui).filter(n => n.textContent.includes('kunne ikke læses')).length, 4)
    assert.doesNotMatch(ui.host.textContent, /Ingen gemte lokale kladder i de fire dage/)
    blocked = false; await ui.click('Opdatér kladdeoverblik')
    assert.equal(rows(ui).filter(n => n.textContent.includes('Ingen lokal kladde gemt')).length, 4)
    assert.equal(reads(storage).length, 8); assert.equal(writes(storage).length, 0)
  })
})

test('inspection reuses original restoration validation without constructing controllers, changing saved bytes or accepting foreign payloads', async () => {
  const { inspectPortalDraft } = await import('./portalModel.mjs')
  const storage = memoryStorage(), c = await saved(storage, base.today), before = c.snapshot()
  const options = { enabled: true, coachId: base.session.user.id, athleteId: base.athlete.id, date: base.today, storage: () => storage }
  const key = draftKey(options.coachId, options.athleteId, options.date), raw = storage.data.get(key), parsed = JSON.parse(raw)
  storage.calls.length = 0
  assert.deepEqual(inspectPortalDraft(options), { state: 'present', mealCount: 1, mealNames: ['<b>Gemte havregryn</b>'] })
  assert.strictEqual(c.snapshot(), before); assert.equal(storage.data.get(key), raw)
  const invalid = ['{bad', 'x'.repeat(250001), JSON.stringify({ ...parsed, schema: 'other' }),
    JSON.stringify({ ...parsed, coachId: 'foreign-coach' }), JSON.stringify({ ...parsed, date: '2028-02-29' }),
    JSON.stringify({ ...parsed, sequence: 0 }), JSON.stringify({ ...parsed, clientVersion: -1 }),
    JSON.stringify({ ...parsed, manualImport: 'true' }), JSON.stringify({ ...parsed, activationPending: 'true' }),
    JSON.stringify({ ...parsed, calculation: {} }), JSON.stringify({ ...parsed, form: { ...parsed.form, fat: 2 } }),
    JSON.stringify({ ...parsed, plan: { ...parsed.plan, athleteId: 'foreign-athlete' } }),
    JSON.stringify({ ...parsed, plan: { ...parsed.plan, status: 'active' } }),
    JSON.stringify({ ...parsed, plan: { ...parsed.plan, portionGuidance: 'x'.repeat(4001) } })]
  for (const bad of invalid) {
    storage.data.set(key, bad)
    assert.equal(inspectPortalDraft(options).state, 'unreadable')
    const original = openPortalPlan({ ...scope(base.today), storage: () => storage })
    assert.ok(original.loadError); assert.equal(original.restored, false)
    assert.equal(storage.data.get(key), bad)
  }
  assert.equal(writes(storage).length, 0)
  assert.equal(inspectPortalDraft({ enabled: false, get coachId() { throw Error('OFF scope') } }), null)
})

test('calendar dates and Danish labels stay anchored across month, year, leap and Copenhagen DST boundaries', async () => {
  const { overviewDates, danishPlanDate, readPlanDayOverview } = await import('./planDayOverviewModel.mjs')
  for (const [today, expected] of [
    ['2028-02-28', ['2028-02-28','2028-02-29','2028-03-01','2028-03-02']],
    ['2027-02-28', ['2027-02-28','2027-03-01','2027-03-02','2027-03-03']],
    ['2026-12-30', ['2026-12-30','2026-12-31','2027-01-01','2027-01-02']],
    ['2026-03-28', ['2026-03-28','2026-03-29','2026-03-30','2026-03-31']],
    ['2026-10-24', ['2026-10-24','2026-10-25','2026-10-26','2026-10-27']],
  ]) assert.deepEqual(overviewDates(today), expected)
  assert.match(danishPlanDate('2028-02-29'), /tirsdag.*29\. februar 2028/)
  assert.equal(overviewDates('2027-02-29'), null)
  assert.equal(overviewDates('9999-12-31'), null)
  assert.equal(readPlanDayOverview({ enabled: false, get storage() { throw Error('OFF') } }), null)
  assert.equal(readPlanDayOverview({ enabled: true, today: 'bad', coachId: 'c', athleteId: 'a', storage: () => { throw Error('invalid scope read') } }), null)
})

test('overview preserves mounted dirty meals, advice, selected date and original controller save path across refresh and continue', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, base, async ui => {
    await ui.openRaw()
    await input(ui, 'plan-date', '2028-03-01')
    await input(ui, 'draft-name-0', 'Ugemt formnavn')
    await input(ui, 'draft-food-0-0', FOODS[0].id)
    await input(ui, 'draft-grams-0-0', '187,25')
    await input(ui, 'portionGuidance', 'Ugemte coachråd')
    const nameNode = field(ui, 'draft-name-0'), adviceNode = field(ui, 'portionGuidance')
    await toggle(ui, true); await ui.click('Opdatér kladdeoverblik')
    assert.match(rows(ui)[2].textContent, /Valgt plandato/)
    assert.deepEqual(rows(ui).map(n => n.getAttribute('data-plan-day')), ['2028-02-28','2028-02-29','2028-03-01','2028-03-02'])
    await ui.click('Fortsæt med valgt dato i Kostplan')
    assert.strictEqual(field(ui, 'draft-name-0'), nameNode); assert.strictEqual(field(ui, 'portionGuidance'), adviceNode)
    assert.equal(nameNode.value, 'Ugemt formnavn'); assert.equal(adviceNode.value, 'Ugemte coachråd')
    assert.equal(field(ui, 'draft-grams-0-0').value, '187,25'); assert.equal(field(ui, 'plan-date').value, '2028-03-01')
    assert.equal(writes(storage).length, 0)
    await input(ui, 'maintenanceKcal', '2400'); await input(ui, 'fat', '70')
    await ui.submit('Formularkladde · navngivne måltider')
    await ui.click('Gem som kladde')
    const raw = storage.data.get(draftKey(base.session.user.id, base.athlete.id, '2028-03-01'))
    assert.ok(raw); const stored = JSON.parse(raw)
    assert.equal(stored.plan.portionGuidance, 'Ugemte coachråd'); assert.equal(stored.plan.meals[0].name, 'Ugemt formnavn')
    assert.equal(stored.plan.meals[0].items[0].grams, 187.25)
    assert.equal(writes(storage).length, 1)
    await ui.click('Opdatér kladdeoverblik'); assert.match(rows(ui)[2].textContent, /1 gemte måltider: Ugemt formnavn/)
    assert.equal(writes(storage).length, 1)
  })
})

test('empty overview continue opens the actual existing editor declaratively; stale owner callbacks cannot read new scope', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, base, async ui => {
    await ui.openRaw(); storage.calls.length = 0
    await toggle(ui, true)
    const oldRefresh = ui.handler(ui.find('button', 'Opdatér kladdeoverblik'), 'onClick')
    await ui.click('Fortsæt med valgt dato i Kostplan')
    assert.ok(field(ui, 'plan-date')); assert.equal(field(ui, 'plan-date').value, base.today)
    assert.equal(ui.host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan').getAttribute('open'), '')
    await ui.render({ ...base, athlete: { ...base.athlete, id: 'other-synthetic-athlete' } })
    const count = reads(storage).length
    await ui.act(() => oldRefresh())
    assert.equal(reads(storage).length, count); assert.equal(rows(ui).length, 0)
    assert.equal(writes(storage).length, 0)
  })
})

test('pending reservation survives overview open, refresh, close and continue with the original restored controller guards', async () => {
  const storage = memoryStorage()
  await saved(storage, base.today, true)
  const key = draftKey(base.session.user.id, base.athlete.id, base.today), bytes = storage.data.get(key)
  const restored = openPortalPlan({ ...scope(base.today), storage: () => storage }).controller
  assert.equal(restored.snapshot().activationPending, true)
  const snapshot = restored.snapshot()
  storage.calls.length = 0
  await mountFridaPortal(storage, base, async ui => {
    await ui.openRaw()
    assert.equal(ui.handler(field(ui, 'plan-date'), 'disabled'), true)
    assert.equal(ui.handler(field(ui, 'portionGuidance'), 'disabled'), true)
    await toggle(ui, true); await ui.click('Opdatér kladdeoverblik')
    assert.match(rows(ui)[0].textContent, /afventende aktiveringsreservation/)
    await ui.click('Fortsæt med valgt dato i Kostplan'); await toggle(ui, false)
    assert.equal(field(ui, 'plan-date').value, base.today)
    assert.equal(ui.handler(field(ui, 'plan-date'), 'disabled'), true)
    assert.equal(field(ui, 'portionGuidance').value, 'Gemte råd')
    assert.equal(storage.data.get(key), bytes); assert.equal(writes(storage).length, 0)
    assert.strictEqual(restored.snapshot(), snapshot)
  })
})

test('overview portability: exact public paths are casefold unique and component/model exports resolve separately', async () => {
  const { readdirSync } = await import('node:fs')
  const root = new URL('../../../../', import.meta.url)
  const paths = []
  const walk = (url, prefix) => {
    for (const entry of readdirSync(url, { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false, `${prefix}${entry.name}`)
      if (entry.isDirectory()) walk(new URL(`${entry.name}/`, url), `${prefix}${entry.name}/`)
      else paths.push(`${prefix}${entry.name}`)
    }
  }
  for (const dir of ['src', 'scripts', 'test', 'e2e', 'public', 'supabase/functions/_shared', 'supabase/sql/udkast', 'supabase/migrations']) {
    walk(new URL(`${dir}/`, root), `${dir}/`)
  }
  const changed = ['PortalPlan.mjs', 'PlanDayOverview.mjs', 'planDayOverviewModel.mjs', 'planDayOverview.react.test.mjs', 'portalModel.mjs']
    .map(name => `src/entropi2/kostplan/coach/${name}`)
  assert.equal(new Set(changed.map(path => path.toLowerCase())).size, 5)
  for (const path of changed) assert.ok(paths.includes(path), path)
  assert.equal(paths.includes('src/entropi2/kostplan/coach/planDayOverview.mjs'), false)
  const folded = new Map()
  for (const path of paths) {
    const key = path.toLowerCase()
    assert.equal(folded.has(key), false, `Casefold collision: ${folded.get(key)} / ${path}`)
    folded.set(key, path)
  }
  const component = await import('./PlanDayOverview.mjs')
  const model = await import('./planDayOverviewModel.mjs')
  assert.equal(typeof component.default, 'function')
  assert.deepEqual(Object.keys(model).sort(), ['danishPlanDate', 'overviewDates', 'readPlanDayOverview'])
  assert.ok(Object.values(model).every(value => typeof value === 'function'))
  assert.equal('default' in model, false)
  assert.equal(component.default({ enabled: false }), null)
  assert.deepEqual(model.overviewDates('2028-02-28'), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02'])
  const host = await import('./PortalPlan.mjs')
  assert.equal(typeof host.default, 'function')
})

// Source3: real ReactDOM/StrictMode; native host changes are explicit test user
// actions. The pinned minimal host has no reflected HTMLDetailsElement.open,
// so set both native representations without changing the host or its prototypes.
const nativeDisclosure = ui => ui.host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
async function nativeToggle(ui, open) {
  const host = nativeDisclosure(ui)
  host.open = open
  if (open) host.setAttribute('open', '')
  else host.removeAttribute('open')
  await ui.invoke(host, 'onToggle')
}
// Read-only observation of the actual mounted PlanEditor's first state hook.
// This neither replaces hooks nor constructs a second controller as an oracle.
function mountedController(ui) {
  const node = field(ui, 'plan-date')
  let fiber = node[Object.keys(node).find(k => k.startsWith('__reactFiber$'))]
  while (fiber && fiber.type?.name !== 'PlanEditor') fiber = fiber.return
  assert.ok(fiber, 'Actual mounted PlanEditor')
  return fiber.memoizedState.memoizedState.controller
}
const typedFields = ui => ui.host.querySelectorAll('input,select,textarea').filter(n => n.name ?? n.getAttribute('name'))
  .map(node => ({ node, name: node.name ?? node.getAttribute('name'), value: node.value }))
function unchangedFields(ui, fields) {
  for (const { node, name, value } of fields) {
    assert.strictEqual(field(ui, name), node, name)
    assert.equal(node.value, value, name)
  }
}

test('source3 manual native open/collapse remains uncontrolled; explicit continue retains every typed field and actual controller', async () => {
  const storage = memoryStorage(); let loads = 0
  await mountFridaPortal(storage, { ...base, loadReferenceFoods: () => { loads++; throw Error('Manual path loaded Frida') } }, async ui => {
    const host = nativeDisclosure(ui)
    assert.equal(ui.handler(host, 'open'), undefined)
    assert.equal(host.getAttribute('open'), null)
    assert.equal(typedFields(ui).length, 0); assert.equal(storage.calls.length, 0)
    const oldLaunch = ui.handler(ui.find('button', 'Åbn kostplan med Frida-fødevarer'), 'onClick')
    await nativeToggle(ui, true)
    assert.equal(ui.handler(host, 'open'), undefined)
    await input(ui, 'plan-date', '2028-03-02')
    for (const [name, value] of Object.entries({
      'draft-name-0': 'Source3 ugemt morgen', 'draft-time-0': '08:19',
      'draft-food-0-0': FOODS[8].id, 'draft-grams-0-0': '183,141592653',
      maintenanceKcal: '2481', fat: '76', protein: '143', portionGuidance: 'Behold alle råd',
      'plan-note-preferences': 'Sen morgenmad', 'plan-note-allergies': 'Coachens egne fravalg',
      'plan-note-budget': 'Praktisk ramme', 'template-food-0-0': FOODS[4].id, 'template-grams-0-0': '42,7',
    })) await input(ui, name, value)
    const controller = mountedController(ui), snapshot = controller.snapshot(), fields = typedFields(ui)
    const count = reads(storage).length
    for (let i = 0; i < 2; i++) {
      await nativeToggle(ui, false)
      assert.equal(host.getAttribute('open'), null)
      assert.equal(ui.handler(host, 'open'), undefined)
      await toggle(ui, true); await ui.click('Opdatér kladdeoverblik')
      assert.equal(host.getAttribute('open'), null, 'Inspection must not open the editor')
      await ui.click('Fortsæt med valgt dato i Kostplan')
      assert.equal(host.getAttribute('open'), '')
      assert.equal(ui.handler(host, 'open'), undefined)
      // Deliver the native event after the explicit attribute change.
      await nativeToggle(ui, true)
      unchangedFields(ui, fields)
      assert.strictEqual(mountedController(ui), controller)
      assert.strictEqual(controller.snapshot(), snapshot)
      assert.equal(field(ui, 'plan-date').value, '2028-03-02')
      assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 201)
      await ui.act(() => oldLaunch())
      await toggle(ui, false)
    }
    assert.equal(reads(storage).length, count + 16)
    assert.equal(loads, 0); assert.equal(writes(storage).length, 0)
  }, '../../kostMaalKobling.mjs')
})

test('source3 explicit Frida launch retains controlled readiness and ready source through overview/continue', async () => {
  const storage = memoryStorage(); let resolve, loads = 0
  const pending = new Promise(done => { resolve = done })
  await mountFridaPortal(storage, { ...base, loadReferenceFoods: () => { loads++; return pending } }, async ui => {
    const host = nativeDisclosure(ui)
    assert.equal(ui.handler(host, 'open'), undefined)
    await ui.requestReference()
    assert.equal(ui.handler(host, 'open'), true); assert.equal(loads, 1)
    assert.equal(field(ui, 'plan-date'), undefined)
    await toggle(ui, true); await ui.click('Opdatér kladdeoverblik'); await ui.click('Fortsæt med valgt dato i Kostplan')
    assert.equal(loads, 1)
    const { loadCoachFoods } = await import('../foedevarer/frida55Loader.mjs')
    await ui.act(async () => resolve(await loadCoachFoods()))
    await input(ui, 'plan-date', '2028-03-01')
    for (const [name, value] of Object.entries({ 'draft-name-0': 'Frida beholdes', 'draft-time-0': '13:43',
      'draft-food-0-0': 'frida55:754', 'draft-grams-0-0': '97,27182818',
      portionGuidance: 'Frida råd', 'plan-note-budget': 'Samme kilde' })) await input(ui, name, value)
    const controller = mountedController(ui), snapshot = controller.snapshot(), fields = typedFields(ui)
    // Explicit date selection starts that date's editor; Continue must retain it.
    const readyLoads = loads
    assert.equal(readyLoads, 2)
    await nativeToggle(ui, false)
    assert.equal(ui.handler(host, 'open'), false)
    await ui.click('Opdatér kladdeoverblik')
    assert.equal(host.getAttribute('open'), null)
    await ui.click('Fortsæt med valgt dato i Kostplan')
    assert.equal(ui.handler(host, 'open'), true); assert.equal(host.getAttribute('open'), '')
    unchangedFields(ui, fields)
    assert.strictEqual(mountedController(ui), controller); assert.strictEqual(controller.snapshot(), snapshot)
    assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 241)
    assert.equal(loads, readyLoads); assert.equal(writes(storage).length, 0)
  })
})

test('source3 actual restored reservation and stale callbacks survive native collapse/continue without mutation', async () => {
  const storage = memoryStorage(); await saved(storage, base.today, true)
  const key = draftKey(base.session.user.id, base.athlete.id, base.today), raw = storage.data.get(key)
  storage.calls.length = 0
  await mountFridaPortal(storage, base, async ui => {
    await nativeToggle(ui, true)
    const controller = mountedController(ui), snapshot = controller.snapshot(), fields = typedFields(ui)
    assert.equal(snapshot.activationPending, true)
    const oldDate = ui.handler(field(ui, 'plan-date'), 'onChange')
    await nativeToggle(ui, false)
    await toggle(ui, true); await ui.click('Opdatér kladdeoverblik'); await ui.click('Fortsæt med valgt dato i Kostplan')
    unchangedFields(ui, fields)
    assert.strictEqual(mountedController(ui), controller); assert.strictEqual(controller.snapshot(), snapshot)
    assert.equal(storage.data.get(key), raw); assert.equal(writes(storage).length, 0)
    await ui.act(() => oldDate({ currentTarget: { value: '2028-03-01' } }))
    assert.equal(field(ui, 'plan-date').value, base.today)
    const staleContinue = ui.handler(ui.find('button', 'Fortsæt med valgt dato i Kostplan'), 'onClick')
    await ui.render({ ...base, enabled: false })
    const count = storage.calls.length
    await ui.act(() => staleContinue())
    assert.equal(ui.host.textContent, ''); assert.equal(storage.calls.length, count)
    assert.equal(storage.data.get(key), raw); assert.equal(writes(storage).length, 0)
  })
})
