import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as vm from 'node:vm'
import { fileURLToPath } from 'node:url'

if (!vm.SourceTextModule) {
 test('combined actual React + original SQL integration (serial isolated child)', { timeout: 240000 }, () => {
  const r = spawnSync(process.execPath, ['--max-old-space-size=256', '--experimental-vm-modules', '--test', '--test-concurrency=1', fileURLToPath(import.meta.url)], { encoding: 'utf8', timeout: 230000, env: {} })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /tests 4/); assert.match(r.stdout, /pass 4/)
 })
} else {
 const { act, createElement: h, StrictMode } = await import('react')
 const { createRoot } = await import('react-dom/client')
 const { mountMealPortal, clone } = await import('./coach/mealDraftReact.fixture.mjs')
 const { withDatabase, scope, profile, date, coachId, athleteId, owner, names } = await import('./coach/generatorSql.fixture.mjs')
 const { memoryStorage } = await import('./coach/portal.fixture.mjs')
 const { draftKey, openPortalPlan } = await import('./coach/portalModel.mjs')
 const { startPlanActivation } = await import('./coach/activation.mjs')
 const { FOODS } = await import('./foedevarer/index.mjs')
 const { createPlanAdapter } = await import('./planAdapter.mjs')
 const { createUpcomingPlan } = await import('./atlet/upcomingPlanModel.mjs')
 const { default: Entropi2Kost } = await import('../Entropi2Kost.mjs')
 const { all, byKey, propsOf, tick, hostFixture } = await import('../nutrition/diaryTemplate.fixture.mjs')
 const days = ['2026-11-08', '2026-11-09', '2026-11-10']
 const props = { enabled: true, athlete: profile, today: date, session: { user: { id: coachId } } }
 const named = (ui, name) => ui.host.querySelectorAll('textarea,input').find(n => (n.name ?? n.getAttribute('name')) === name)
 const change = async (ui, name, value) => { const node = named(ui, name); assert.ok(node, name); await act(async () => { ui.handler(node, 'onChange')({ currentTarget: { value } }); await tick() }) }
 const draft = (day, offset = 0) => ({ schema: 'entropi2:meal-draft:v1', ...scope, date: day,
  meals: ['06:45 Morgenmad', '09:30 Formiddag', '12:15 Frokost', '15:45 Før træning', '18:30 Aftensmad', '21:15 Aften'].map((name, i) => ({ id: `combined-${i}`, name,
   items: [{ foodId: FOODS[i].id, grams: 81.125 + i * 7 + offset }, { foodId: FOODS[i + 10].id, grams: 17.375 + i + offset }] })) })
 const simplify = meals => meals.map(m => ({ id: m.id, name: m.name, items: m.items.map(i => ({ foodId: i.food.id, grams: i.grams })) }))
 const ready = ui => ui.wait(() => { const n = ui.find('button', 'Aktivér for atleten'); return n && !ui.handler(n, 'disabled') })
 const load = async (ui, raw) => { await change(ui, 'meal-draft-json', typeof raw === 'string' ? raw : JSON.stringify(raw)); await ui.submit('Manuel måltidskladde') }
 const reads = f => f.calls.filter(c => c.payload).length
 const advice = day => `Coachens tekst ${day}\nVæske, vitamin, mineral og timing <b>bogstavelig tekst</b>`
 const connect = async (c, client, day) => {
  const stop = startPlanActivation({ controller: c, ...scope, date: day, client })
  for (let i = 0; i < 500 && c.snapshot().activationState === 'checking'; i++) await new Promise(r => setImmediate(r))
  return stop
 }
 test('three selected future dates: advice then exact six-meal import, advice edit, save/reopen, exactly three SQL approvals and athlete readonly previews', { timeout: 90000 }, async () => withDatabase(async f => {
  const storage = memoryStorage(), expected = new Map()
  await mountMealPortal(storage, { ...props, client: f.client }, async ui => {
   await ui.open()
   for (const [i, day] of days.entries()) {
    await change(ui, 'plan-date', day)
    await change(ui, 'portionGuidance', advice(day))
    const oldForm = { goal: profile.goal }
    await load(ui, draft(day, i))
    assert.ok(ui.host.textContent.includes('Manuel måltidskladde · gram er indlæst præcist'))
    assert.equal(named(ui, 'portionGuidance').value, advice(day)); assert.equal(reads(f), i * 3)
    for (const [mi, meal] of draft(day, i).meals.entries()) for (const [ii, item] of meal.items.entries()) assert.equal(Number(named(ui, `grams-${mi}-${ii}`).value), item.grams)
    await ui.click('Gem som kladde')
    const key = draftKey(coachId, athleteId, day), saved = JSON.parse(storage.data.get(key))
    assert.deepEqual(simplify(saved.plan.meals), draft(day, i).meals)
    assert.equal(saved.plan.portionGuidance, advice(day)); assert.equal(saved.manualImport, true)
    assert.equal(saved.plan.goal, oldForm.goal)
    await change(ui, 'portionGuidance', advice(day) + '\nEkstra separat råd')
    await ui.click('Gem som kladde')
    await change(ui, 'plan-date', date); await change(ui, 'plan-date', day)
    assert.equal(named(ui, 'portionGuidance').value, advice(day) + '\nEkstra separat råd')
    assert.deepEqual(simplify(JSON.parse(storage.data.get(key)).plan.meals), draft(day, i).meals)
    await ready(ui); await ui.click('Aktivér for atleten')
    await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
    const rows = (await f.db.query('select * from public.kostplan_v1_versions order by effective_from')).rows
    assert.equal(rows.length, i + 1)
    const v = rows[i]; assert.equal(v.effective_from.toISOString().slice(0, 10), day)
    assert.equal(v.portion_guidance, advice(day) + '\nEkstra separat råd')
    assert.deepEqual(v.meals.map(m => ({ name: m.name, items: m.portions.map(p => ({ foodId: p.food.id, grams: p.grams })) })), draft(day, i).meals.map(({ name, items }) => ({ name, items })))
    expected.set(day, { id: v.id, meals: clone(v.meals), advice: v.portion_guidance })
    assert.equal(reads(f), (i + 1) * 3)
   }
   await change(ui, 'plan-date', days[0]); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
   await load(ui, draft(days[0], 0)); await ui.click('Gem som kladde')
   assert.equal(reads(f), 9)
  })
  assert.equal(Number((await f.db.query('select count(*) n from public.kostplan_v1_approvals')).rows[0].n), 3)
  await f.login(owner)
  assert.equal(await createPlanAdapter({ enabled: true, athleteId, date, client: f.client }).loadActive(), null)
  for (const day of days) {
   const c = createUpcomingPlan({ enabled: true, athleteId, today: date, date: day, client: f.client })
   try { assert.equal(await c.load(), true); const s = c.snapshot(); assert.equal(s.plan.revision, expected.get(day).id); assert.equal(s.plan.athlete_id, athleteId); assert.equal(s.plan.portionGuidance, expected.get(day).advice); assert.deepEqual(s.plan.meals.map(m => m.foods.map(v => v.grams)), expected.get(day).meals.map(m => m.portions.map(v => v.grams))) } finally { c.dispose() }
  }
  const dom = hostFixture(), root = createRoot(dom.host), values = new Map(), localWrites = []
  dom.globals({ localStorage: { getItem: k => values.get(k) ?? null, setItem(k, v) { localWrites.push(k); values.set(k, v) } } })
  const wait = async p => { for (let i = 0; i < 400 && !p(); i++) await act(async () => new Promise(r => setTimeout(r, 5))); assert.ok(p(), dom.host.textContent.slice(-1200)) }
  try {
   await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, { enabled: true, athlete: { id: athleteId }, date, currentDay: () => date, client: f.client, foods: [], weightLogs: [] }))); await tick() })
   await wait(() => dom.host.textContent.includes('ingen aktiv kostplan'))
   const tracker = all(dom.host, '[data-entropi2-kost]')[0], manual = byKey(dom.host, 'field-Måltid')
   manual.value = 'Ugemt seksmåltidsdag'; manual.dispatch('input', { target: manual })
   const before = reads(f)
   for (const day of days) {
    const picker = all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
    await act(async () => { propsOf(picker).onChange({ currentTarget: { value: day } }); await tick() })
    await wait(() => dom.host.textContent.includes(expected.get(day).advice))
    const preview = all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kommende kostplan')
    assert.equal(all(preview, 'input,form').length, 0)
    assert.ok(all(preview, 'button').every(n => n.textContent === 'Hent planen igen'))
    for (const meal of expected.get(day).meals) { assert.ok(preview.textContent.includes(meal.name)); for (const p of meal.portions) assert.ok(preview.textContent.includes(new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(p.grams))) }
    await act(async () => { propsOf(all(preview, 'button')[0]).onClick(); await tick() })
    await wait(() => dom.host.textContent.includes(expected.get(day).advice))
    assert.strictEqual(all(dom.host, '[data-entropi2-kost]')[0], tracker); assert.strictEqual(byKey(dom.host, 'field-Måltid'), manual); assert.equal(manual.value, 'Ugemt seksmåltidsdag')
   }
   assert.equal(reads(f), before); assert.equal(localWrites.length, 0)
  } finally { try { await act(async () => root.unmount()) } finally { dom.restore() } }
  assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n), 0)
 }))

 test('selected date/import/advice callbacks are frozen through uncertain activation and original SQL reconciliation, for each lost table response', { timeout: 90000 }, async () => {
  for (const lost of names) await withDatabase(async f => {
   const storage = memoryStorage(), day = days[0]
   await mountMealPortal(storage, { ...props, client: f.client }, async ui => {
    await ui.open(); await change(ui, 'plan-date', day); await change(ui, 'portionGuidance', advice(day)); await load(ui, draft(day)); await ui.click('Gem som kladde'); await ready(ui)
    const changeDate = ui.handler(named(ui, 'plan-date'), 'onChange'), changeAdvice = ui.handler(named(ui, 'portionGuidance'), 'onChange')
    const submit = ui.handler(ui.host.querySelectorAll('form').find(n => n.textContent.includes('Manuel måltidskladde')), 'onSubmit')
    const activate = ui.handler(ui.find('button', 'Aktivér for atleten'), 'onClick')
    await act(async () => { const pending = activate(); changeDate({ currentTarget: { value: days[1] } }); changeAdvice({ currentTarget: { value: 'discarded' } }); submit({ preventDefault() {} }); await pending })
    assert.equal(named(ui, 'plan-date').value, day); assert.equal(named(ui, 'portionGuidance').value, advice(day))
    assert.equal(ui.handler(named(ui, 'plan-date'), 'disabled'), true)
    assert.equal(ui.host.querySelectorAll('fieldset').find(n => n.textContent.includes('Manuel måltidskladde')).getAttribute('disabled'), '')
    const key = draftKey(coachId, athleteId, day), payload = storage.data.get(key), attempts = clone(f.calls.filter(c => c.payload))
    assert.equal(JSON.parse(payload).activationPending, true)
    const reopened = openPortalPlan({ enabled: true, coachId, athlete: profile, date: day, storage: () => storage }).controller
    const stop = await connect(reopened, f.client, day)
    try {
     if (lost !== names[2]) { assert.equal(reopened.snapshot().activationPending, true); assert.equal(reopened.importMealDraft(JSON.stringify(draft(day, 5)), reopened.snapshot().version), false); assert.equal(reopened.setAdvice('discarded'), false); assert.equal(await reopened.activate(), false) }
     else assert.equal(reopened.snapshot().publishedVersion, reopened.snapshot().version)
     assert.deepEqual(f.calls.filter(c => c.payload), attempts)
    } finally { stop() }
    if (lost !== names[2]) { await ui.click('Kontrollér aktivering igen'); await ready(ui); await ui.click('Aktivér for atleten'); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan')) }
    const writes = f.calls.filter(c => c.payload)
    for (const original of attempts) assert.ok(writes.filter(c => c.table === original.table).every(c => JSON.stringify(c.payload) === JSON.stringify(original.payload)))
   })
   assert.equal(Number((await f.db.query('select count(*) n from public.kostplan_v1_approvals')).rows[0].n), 1)
  }, { lost })
 })

 test('strict importer rejects malformed/advice fields; old date/athlete/import callbacks cannot change a new editor', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage()
  await mountMealPortal(storage, { ...props, client: f.client }, async ui => {
   await ui.open(); await change(ui, 'plan-date', days[0]); await change(ui, 'portionGuidance', advice(days[0])); await load(ui, draft(days[0]))
   const before = named(ui, 'grams-0-0').value
   for (const raw of ['{', JSON.stringify({ ...draft(days[0]), advice: 'rejected' }), JSON.stringify({ ...draft(days[0]), portion_guidance: 'rejected' }), JSON.stringify({ ...draft(days[0]), date: days[1] })]) {
    await load(ui, raw); assert.match(ui.host.textContent, /Ugyldig måltidskladde/); assert.equal(named(ui, 'grams-0-0').value, before); assert.equal(named(ui, 'portionGuidance').value, advice(days[0]))
   }
   await change(ui, 'meal-draft-json', JSON.stringify(draft(days[0])))
   const submit = ui.handler(ui.host.querySelectorAll('form').find(n => n.textContent.includes('Manuel måltidskladde')), 'onSubmit')
   const dateChange = ui.handler(named(ui, 'plan-date'), 'onChange')
   await change(ui, 'plan-date', days[1]); await act(async () => { submit({ preventDefault() {} }); dateChange({ currentTarget: { value: days[2] } }) })
   assert.equal(named(ui, 'plan-date').value, days[1]); assert.equal(named(ui, 'grams-0-0'), undefined)
   await ui.render({ ...props, athlete: { ...profile, id: scope.coachId }, client: f.client }); await ui.open()
   await act(async () => submit({ preventDefault() {} }))
   assert.equal(named(ui, 'grams-0-0'), undefined); assert.equal(storage.data.size, 0); assert.equal(reads(f), 0)
  })
 }))

 test('same macro totals with changed profile basis invalidates imported meals until explicit regeneration; advice/meals remain intact', () => {
  const storage = memoryStorage(), day = days[0]
  const options = { enabled: true, coachId, athlete: { ...profile }, date: day, storage: () => storage }
  const a = openPortalPlan(options).controller
  assert.equal(a.set('maintenanceKcal', '1600'), true); assert.equal(a.set('intensity', 15), true)
  assert.equal(a.importMealDraft(JSON.stringify(draft(day)), a.snapshot().version), true)
  assert.equal(a.setAdvice(advice(day)), true)
  return a.save().then(async saved => {
   assert.equal(saved, true)
   const changed = openPortalPlan({ ...options, athlete: { ...options.athlete, training: { volume: 'high', intensity: 'high' } } }).controller
   assert.deepEqual(changed.snapshot().suggestion, a.snapshot().suggestion)
   assert.deepEqual(changed.snapshot().meals, a.snapshot().meals); assert.equal(changed.snapshot().portionGuidance, advice(day))
   assert.equal(changed.snapshot().planTargets, null); assert.equal(await changed.save(), false)
  })
 })
}
