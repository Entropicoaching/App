// Entropi 2-kostmålskobling (APP-KOST-MAAL1 i coachens kostfane) med faktiske moduler:
// kostMaalKobling.mjs, kostMaal/KostMaal.mjs, dashboard/navigation.js og dashboard/atletHandlinger.js.
// Kun React (pakkens egen syntetiske reactFixture) og Supabase-klienten er syntetiske.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setImmediate } from 'node:timers'
import { mount, nodes, one, text, createElement as h, useEffect, useSyncExternalStore } from './kostMaal/reactFixture.mjs'
import { openPortalPlan } from './kostplan/coach/portalModel.mjs'
import { coachPlanView } from './kostplan/coach/view.mjs'
import { syntheticTables, tableNames, flush } from './kostplan/coach/activation.fixture.mjs'
import { memoryStorage } from './kostplan/coach/portal.fixture.mjs'
import { FOODS } from './kostplan/foedevarer/index.mjs'

const here = new URL('./', import.meta.url).href
const src = new URL('../', import.meta.url).href
const handlerUrl = new URL('../dashboard/atletHandlinger.js', import.meta.url).href
const calls = [], responses = []
globalThis.__kostMaalKoblingClient = { from(table) {
  const call = { table, operations: [] }; calls.push(call)
  const chain = Object.fromEntries(['update', 'eq', 'select'].map(method => [method, (...args) => { call.operations.push([method, ...args]); return chain }]))
  chain.single = async () => responses.shift() ?? { data: null, error: { message: 'syntetisk fejl' } }
  return chain
} }
const hooks = registerHooks({ resolve(specifier, context, next) {
  // Koblingens vægteffekt køres ikke her; effektens krop prøves direkte.
  if (specifier === 'react' && context.parentURL?.endsWith('/kostMaalKobling.mjs'))
    return { url: 'data:text/javascript,' + encodeURIComponent(`export { createElement, useState } from '${new URL('./kostMaal/reactFixture.mjs', import.meta.url).href}'; export const useEffect = () => { throw Error('Uventet effekt') }`), shortCircuit: true }
  if (specifier === 'react' && context.parentURL?.startsWith(here) && !context.parentURL.endsWith('.test.js'))
    return { url: new URL('./kostMaal/reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier === '../supabase' && context.parentURL === handlerUrl)
    return { url: 'data:text/javascript,' + encodeURIComponent('export const supabase = globalThis.__kostMaalKoblingClient'), shortCircuit: true }
  // Appens egne moduler bruger importer uden filendelse (Vite); samme tilbagefald som pakkens prøve.
  if (specifier.startsWith('.') && context.parentURL?.startsWith(src)) {
    const url = new URL(specifier, context.parentURL)
    if (!existsSync(url) && existsSync(fileURLToPath(url) + '.js')) return next(url.href + '.js', context)
  }
  return next(specifier, context)
} })
const { default: CoachKostMaal, kostMaalVaegt, startKostVaegt } = await import('./kostMaalKobling.mjs')
// Same import graph and React fixture as the formerly failing coach-tab import.
const { startPlanActivation } = await import('./kostplan/coach/activation.mjs')
const { lavNavigation } = await import('../dashboard/navigation.js')
const { lavAtletHandlinger } = await import('../dashboard/atletHandlinger.js')
hooks.deregister()
delete globalThis.__kostMaalKoblingClient

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const today = '2026-11-02'
const athlete = { id: 'syn-a', kcal_target: 2400, protein_target: 160, bodyweight: 80 }
// Som den eksisterende fetchAthleteWeightLogs: select('*') med athlete_id, nyeste først.
const logs = ['2026-11-02', '2026-11-01', '2026-10-30', '2026-10-28', '2026-10-25', '2026-10-23', '2026-10-21']
  .map((day, i) => ({ id: `syn-w${i}`, athlete_id: 'syn-a', logged_at: `${day}T07:00:00Z`, weight: i < 4 ? 81 : 80 }))
// Runde 11: rækkerne følger statusobjektet fra præcis den læsning, der gav dem.
const ready = { athleteId: 'syn-a', state: 'ready', rows: logs }
const view = props => mount(CoachKostMaal, { enabled: true, athlete, weightStatus: ready, today, ...props }).render()

test('KOST-AKTIVER1: fixture links activation hooks without pretending to run effects or subscriptions', () => {
  assert.throws(() => useEffect(() => assert.fail('Effect ran')), /Unexpected effect/)
  const snapshot = () => 'synthetic snapshot'
  assert.equal(useSyncExternalStore(() => assert.fail('Unexpected subscription'), snapshot, snapshot), 'synthetic snapshot')
  assert.throws(() => useSyncExternalStore(() => {}, snapshot, () => null), /Matching server snapshot/)
  // A valid coach session renders the real, collapsed portal through this fixture.
  const tree = view({ session: { user: { id: 'syn-coach' } } })
  assert.equal(nodes(tree, n => n.type === 'details' && text(n).trim() === 'Kostplan').length, 1)
  assert.doesNotMatch(text(tree), /Aktivér for atleten|Kontrollér aktivering igen/)
})

test('KOST-AKTIVER1: missing tables never enable activation in the actual imported controller', async () => {
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const f = syntheticTables({ missing, missingCode }), storage = memoryStorage()
    const { controller } = openPortalPlan({ enabled: true, coachId: 'syn-coach', athlete, date: today,
      storage: () => storage,
      template: [{ id: 'syn-meal', name: 'Synthetic meal', items: [{ foodId: FOODS[0].id, grams: 100 }] }] })
    controller.set('maintenanceKcal', 2400); controller.set('fat', 70)
    assert.equal(controller.generate(), true)
    const stop = startPlanActivation({ controller, athleteId: athlete.id, date: today, client: f.client })
    try {
      await flush()
      // Assert BEFORE cleanup: cleanup itself disables publishing and can mask a regression.
      assert.ok(f.calls.some(call => call.table === missing))
      assert.equal(controller.snapshot().canPublish, false)
      assert.equal(controller.snapshot().activationError, null)
      assert.doesNotMatch(text(coachPlanView(h, controller.snapshot(), controller)), /Aktivér for atleten/)
      assert.equal(await controller.save(), true)
      assert.equal(await controller.activate(), true) // Local draft operation only.
      assert.match(controller.snapshot().message, /Lokal kladde gemt/)
      assert.equal(f.writes().length, 0)
    } finally { stop() }
  }
  // Positive control: a working schema enables the button without writing.
  const f = syntheticTables(), { controller } = openPortalPlan({ enabled: true,
    coachId: 'syn-coach', athlete, date: today, storage: () => memoryStorage() })
  const stop = startPlanActivation({ controller, athleteId: athlete.id, date: today, client: f.client })
  try { await flush(); assert.equal(controller.snapshot().canPublish, true); assert.equal(f.writes().length, 0) }
  finally { stop() }
})

test('KOSTMÅL: coachen ser mål, kropsvægt, ugegennemsnit og trend fra atletens weight_logs', () => {
  const out = text(view())
  for (const pattern of [/2\.400 kcal/, /160 g/, /Kropsvægt i profilen\s+80 kg/, /Seneste vejning\s+81 kg · 2026-11-02/,
    /Ugegennemsnit · seneste 7 dage\s+81 kg · 4 vejedage/, /Trend · mod de foregående 7 dage\s+\+1 kg/])
    assert.match(out, pattern)
  // Den eksisterende læser giver nyeste først; koblingen vender til stigende uden at ændre rækkerne.
  assert.deepEqual(kostMaalVaegt(ready, 'syn-a').rows, [...logs].reverse())
  assert.equal(logs[0].logged_at.startsWith('2026-11-02'), true)
})

test('KOSTMÅL: manglende mål samles i Sæt kostmål, aldrig som nul', () => {
  for (const goals of [{ kcal_target: null, protein_target: null }, { kcal_target: '', protein_target: 0 }, { kcal_target: undefined, protein_target: undefined }]) {
    const out = text(view({ athlete: { ...athlete, ...goals } }))
    assert.equal((out.match(/Sæt kostmål/g) ?? []).length, 1, JSON.stringify(goals))
    assert.doesNotMatch(out, /Ingen mål endnu/)
    assert.doesNotMatch(out, /0 kcal|Ikke sat/)
  }
})

test('KOSTMÅL: manglende vægt, igangværende læsning, fremmed atlet og læsefejl', () => {
  const empty = text(view({ weightStatus: { ...ready, rows: [] }, athlete: { ...athlete, bodyweight: null } }))
  assert.equal((empty.match(/Ingen vejninger endnu/g) ?? []).length, 1)
  assert.doesNotMatch(empty, /Ingen kropsvægt angivet|Ingen vejninger i perioden|Flere vejninger nødvendige/)
  // Ikke afsluttet læsning for netop denne atlet er aldrig "ingen vejninger".
  for (const props of [{ weightStatus: null }, { weightStatus: { athleteId: 'syn-a', state: 'loading' } },
    { weightStatus: { athleteId: 'syn-b', state: 'ready' } }, { weightStatus: { ...ready, rows: [{ ...logs[0], athlete_id: 'syn-b' }] } }]) {
    const out = text(view(props))
    assert.match(out, /Indlæser vægtgrundlag/, JSON.stringify(Object.keys(props)))
    assert.doesNotMatch(out, /Ingen vejninger/)
    assert.match(out, /Kostmål/)
  }
  const failed = view({ weightStatus: { athleteId: 'syn-a', state: 'error' } })
  assert.equal(nodes(failed, n => n.props.role === 'alert').length, 1); assert.match(text(failed), /kunne ikke hentes/)
})

test('KOSTMÅL: Rediger og Gem bruger den eksisterende startEdit og saveEdit; kun målfelterne skrives', async () => {
  const props = { editing: null, editData: {}, saving: false }
  const setEditing = value => { props.editing = value }
  const nav = lavNavigation({ setEditing, setEditData: value => { props.editData = value } })
  let selected, roster = [athlete], saveCalls = 0
  // Som i Dashboard: handlerfabrikken bygges med den aktuelle editData, og dens saveEdit gives videre.
  const existing = () => lavAtletHandlinger({ editData: props.editData, selectedAthlete: athlete,
    setSaving: value => { props.saving = value }, setSelectedAthlete: value => { selected = value },
    setAthletes: update => { roster = update(roster) }, setEditing, showFlash: () => { throw Error('uventet valideringsfejl') } }).saveEdit
  const saveEdit = (...args) => { saveCalls++; assert.deepEqual(args, []); return existing()() }
  const c = mount(CoachKostMaal, { enabled: true, athlete, weightStatus: ready, today })
  const render = () => c.render({ ...props, startEdit: nav.startEdit, setEditing,
    setEditData: update => { props.editData = update(props.editData) }, saveEdit })
  one(render(), 'button', 'Rediger').props.onClick()
  assert.equal(props.editing, 'setup')
  assert.deepEqual(props.editData, { kcal_target: 2400, protein_target: 160 })
  one(render(), 'input', 'kcal_target').props.onChange({ target: { value: '2500' } })
  one(render(), 'input', 'protein_target').props.onChange({ target: { value: '' } })
  calls.length = 0
  const saved = { ...athlete, kcal_target: 2500, protein_target: null }
  responses.push({ data: saved, error: null })
  await one(render(), 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(saveCalls, 1)
  assert.deepEqual(calls, [{ table: 'athletes', operations: [['update', { kcal_target: 2500, protein_target: null }], ['eq', 'id', 'syn-a'], ['select']] }])
  assert.deepEqual(selected, saved); assert.deepEqual(roster, [saved]); assert.equal(props.editing, null)
  assert.equal(nodes(render(), n => n.type === 'form').length, 0)
})

// Syntetisk Supabase-klient: registrerer forespørgslen og lader prøven bestemme, hvornår og hvad
// hver læsning svarer.
function weightClient() {
  const reads = []
  const client = { from(table) {
    const read = { table, ops: [] }
    const chain = Object.fromEntries(['select', 'eq', 'order'].map(m => [m, (...a) => { read.ops.push([m, ...a]); return chain }]))
    chain.limit = n => { read.ops.push(['limit', n]); return new Promise((resolve, reject) => { read.resolve = resolve; read.reject = reject }) }
    reads.push(read); return chain
  } }
  return { client, reads }
}

test('KOSTMÅL: vægtloggen læses med samme forespørgsel som den eksisterende læser; OFF læser intet', async () => {
  const flush = () => new Promise(resolve => setImmediate(resolve))
  const { client, reads } = weightClient(), seen = []
  const cancel = startKostVaegt({ enabled: true, athleteId: 'syn-a', client }, s => seen.push(s))
  await flush()
  assert.equal(reads.length, 1)
  assert.deepEqual(reads[0].table, 'weight_logs')
  assert.deepEqual(reads[0].ops, [['select', '*'], ['eq', 'athlete_id', 'syn-a'], ['order', 'logged_at', { ascending: false }], ['limit', 90]])
  reads[0].resolve({ data: logs, error: null }); await flush()
  assert.deepEqual(seen, [{ athleteId: 'syn-a', state: 'loading' }, { athleteId: 'syn-a', state: 'ready', rows: logs }])
  cancel()
  const rejected = weightClient(), failed = []
  startKostVaegt({ enabled: true, athleteId: 'syn-a', client: rejected.client }, s => failed.push(s))
  await flush(); rejected.reads[0].reject(Error('syntetisk')); await flush()
  assert.deepEqual(failed.at(-1), { athleteId: 'syn-a', state: 'error' })
  // Et svar efter atletskift (annullering) afleveres ikke.
  const lateClient = weightClient(), late = [], stop = startKostVaegt({ enabled: true, athleteId: 'syn-a', client: lateClient.client }, s => late.push(s))
  await flush(); stop(); lateClient.reads[0].resolve({ data: logs, error: null }); await flush()
  assert.deepEqual(late, [{ athleteId: 'syn-a', state: 'loading' }])
  for (const input of [{ enabled: false, athleteId: 'syn-a' }, { enabled: 'true', athleteId: 'syn-a' }, { enabled: true, athleteId: undefined }, { enabled: true, athleteId: 'syn-a', client: null }]) {
    let called = 0
    const probe = { from() { called++; throw Error('OFF læst') } }
    assert.equal(startKostVaegt({ client: probe, ...input }, () => { called++ }), undefined)
    assert.equal(called, 0)
  }
})

// K-R10 fund 1: et sent vægtsvar fra den forrige atlet må aldrig låse den nye atlets kostskærm.
test('KOSTMÅL R11: sent svar fra atlet A efter skift til B blander sig ikke; B vises med egne rækker', async () => {
  const flush = () => new Promise(resolve => setImmediate(resolve))
  const { client, reads } = weightClient()
  let status = null
  const stopA = startKostVaegt({ enabled: true, athleteId: 'syn-a', client }, s => { status = s })
  await flush()
  stopA() // atletskift: effekten rydder A op og starter B
  startKostVaegt({ enabled: true, athleteId: 'syn-b', client }, s => { status = s })
  await flush()
  const rowsB = [{ id: 'syn-wb', athlete_id: 'syn-b', logged_at: '2026-11-02T07:00:00Z', weight: 70 }]
  reads[1].resolve({ data: rowsB, error: null }); await flush()
  reads[0].resolve({ data: logs, error: null }); await flush() // A svarer sent
  assert.deepEqual(status, { athleteId: 'syn-b', state: 'ready', rows: rowsB })
  assert.deepEqual(kostMaalVaegt(status, 'syn-b'), { state: 'ready', rows: rowsB })
  const out = text(view({ athlete: { ...athlete, id: 'syn-b' }, weightStatus: status }))
  assert.doesNotMatch(out, /Indlæser vægtgrundlag/)
})

// K-R10 fund 3: en læsefejl fra databasen er en fejl, aldrig "Ingen vejninger endnu".
test('KOSTMÅL R11: databasefejl i svaret vises som fejl, ikke som tomme vejninger', async () => {
  const flush = () => new Promise(resolve => setImmediate(resolve))
  for (const answer of [{ data: null, error: { message: 'syntetisk fejl' } }, { data: [], error: { message: 'syntetisk' } }, { data: null, error: null }, undefined]) {
    const { client, reads } = weightClient(), seen = []
    startKostVaegt({ enabled: true, athleteId: 'syn-a', client }, s => seen.push(s))
    await flush(); reads[0].resolve(answer); await flush()
    assert.deepEqual(seen.at(-1), { athleteId: 'syn-a', state: 'error' }, JSON.stringify(answer))
    const out = view({ weightStatus: seen.at(-1) })
    assert.equal(nodes(out, n => n.props.role === 'alert').length, 1); assert.doesNotMatch(text(out), /Ingen vejninger/)
  }
  // En ready-status uden rækker er aldrig bevis for "ingen vejninger".
  assert.deepEqual(kostMaalVaegt({ athleteId: 'syn-a', state: 'ready' }, 'syn-a'), { state: 'error' })
})

test('KOSTMÅL: OFF giver ingen gengivelse, og Dashboard bevarer KostTab uændret bag !e2', () => {
  for (const enabled of [undefined, false, 'true', 1]) assert.equal(CoachKostMaal({ enabled, get athlete() { throw Error('OFF læst') } }), null)
  const source = read('../Dashboard.jsx')
  assert.match(source, /const e2KostVaegt = useEntropi2KostVaegt\(\{ enabled: e2 && activeTab === 'kost', athleteId: selectedAthlete\?\.id, client: supabase \}\)/)
  assert.match(source, /\{e2 && activeTab === 'kost' && \(\n {14}<CoachKostMaal enabled=\{true\} athlete=\{a\} weightStatus=\{e2KostVaegt\} today=\{calendarDay\(\)\} \{\.\.\.\{\n {16}editing, editData, startEdit, setEditData, setEditing, saveEdit, saving,\n {16}session, loading, loadError,\n {14}\}\} coachNutrition=\{e2CoachNutrition\} readContext=\{e2ReadContext\} \/>/)
  assert.match(source, /\{!e2 && activeTab === 'kost' && \(\n {14}<KostTab \{\.\.\.\{\n {16}a, editData, editing, isMobile, saveEdit, saving,\n {16}setEditData, setEditing, startEdit,\n {14}\}\} \/>/)
  assert.equal(source.match(/<KostTab /g).length, 1)
})
