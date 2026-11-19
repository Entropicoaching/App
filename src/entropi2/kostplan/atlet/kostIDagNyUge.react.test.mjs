import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { previewDates, readNextPlanStart } from './upcomingPlanModel.mjs'

// 1916: en sendt uge, der starter i morgen eller senere (højst 13 dage), står som én linje
// i "Kost i dag"; "Se planen" åbner laget på datoen og tæller som set. Syntetisk atlet, ingen database.
const SEEN = 'kostplan_v1_seen'
const plus = n => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const failing = () => { const q = { lte: () => q, gte: () => q, eq: () => q, limit: () => q,
  then: (resolve, reject) => Promise.resolve({ data: null, error: { code: 'synthetic-read-error' } }).then(resolve, reject) }; return q }

async function mount(t, { planFrom = plus(1), approve = true, readError = false, todayPlan = false } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture()
  if (approve) {
    f.approve()
    f.plan.data.kostplan_v1_plans[0].valid_from = planFrom
    f.plan.data.kostplan_v1_versions[0].effective_from = planFrom
    // Uden todayPlan er kun den kommende uge sendt; i dag har ingen planmåltider.
    if (todayPlan) {
      const p = f.plan.data.kostplan_v1_plans[0], v = f.plan.data.kostplan_v1_versions[0], a = f.plan.data.kostplan_v1_approvals[0]
      const id = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
      f.plan.data.kostplan_v1_plans.push({ ...p, id: id(11), valid_from: date })
      f.plan.data.kostplan_v1_versions.push({ ...v, id: id(12), plan_id: id(11), effective_from: date })
      f.plan.data.kostplan_v1_approvals.push({ ...a, plan_id: id(11), version_id: id(12) })
    }
  }
  const seen = [], upserts = [], reads = []
  const client = { from(table) {
    if (table === SEEN) return { async upsert(rows, options) {
      upserts.push({ rows, options })
      for (const row of rows) if (!seen.some(r => r.athlete_id === row.athlete_id && r.version_id === row.version_id)) seen.push(row)
      return { data: null, error: null }
    } }
    const q = f.client.from(table)
    // Kun 1916's læsning bruger gte på plantabellen (planAdapter bruger lte); den syntetiske tabel kender ikke gte.
    if (!q.gte) q.gte = (key, value) => { reads.push([table, key, value]); return readError && table === 'kostplan_v1_plans' ? failing() : q }
    return q
  } }
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const warnings = [], original = console.error
  console.error = (...args) => warnings.push(args.map(String).join(' '))
  t.after(async () => {
    try { await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() }
  })
  const props = () => ({ enabled: true, athlete: { id: athleteId, kcal_target: 2600, protein_target: 160 }, date, client, foods: [],
    weightLogs: [], weightInput: '', onWeightInput() {}, async logWeight() {}, currentDay: () => date })
  const render = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props()))); for (let i = 0; i < 12; i++) await tick() })
  await render()
  const card = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kost i dag')
  const line = () => all(dom.host, '[data-kost-ny-plan]')[0]
  const layer = () => all(dom.host, '[data-kost-detaljer]')[0]
  const select = () => all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
  const press = async node => { assert.ok(node); await act(async () => { await propsOf(node).onClick(); for (let i = 0; i < 12; i++) await tick() }) }
  const choose = async value => { await act(async () => { propsOf(select()).onChange({ currentTarget: { value } }); for (let i = 0; i < 12; i++) await tick() }) }
  return { ...dom, f, seen, upserts, reads, render, card, line, layer, select, press, choose }
}

test('ugen starter i morgen: én linje under tallene med ugedag og dato, intet skrevet før tryk', async t => {
  const r = await mount(t, { planFrom: plus(1) })
  assert.ok(r.line())
  assert.equal(r.line().getAttribute('data-kost-ny-plan'), plus(1))
  assert.match(r.line().textContent, /^Ny kostplan fra fredag 6\. november\s*Se planen$/)
  assert.ok(r.card().contains(r.line()))
  assert.equal(r.layer().getAttribute('data-kost-detaljer'), 'lukket')
  assert.equal(r.upserts.length, 0)
  await r.render()
  assert.equal(r.upserts.length, 0)
})

test('Se planen: åbner laget på datoen i Vælg plandato med samme Kommende kostplan; set skrives én gang', async t => {
  const r = await mount(t, { planFrom: plus(1) })
  await r.press(button(r.line(), 'Se planen'))
  assert.equal(r.layer().getAttribute('data-kost-detaljer'), 'aaben')
  // Laget åbnes kun nu; atletens husket valg for Vis detaljer er uændret.
  assert.ok(!r.f.writes.some(key => key.startsWith('entropi2:kost-detaljer')))
  assert.equal(r.select().value ?? propsOf(r.select()).value, plus(1))
  const kommende = all(r.host, 'section').find(n => n.getAttribute('aria-label') === 'Kommende kostplan')
  assert.ok(kommende)
  assert.match(kommende.textContent, /Frokost <syntetisk>/)
  assert.equal(r.upserts.length, 1)
  assert.deepEqual(r.seen, [{ athlete_id: athleteId, plan_id: r.f.plan.data.kostplan_v1_plans[0].id, version_id: r.f.plan.data.kostplan_v1_versions[0].id }])
  // Tilbage til i dag og et nyt tryk: ingen ny skrivning.
  await r.choose(date)
  assert.ok(r.line())
  await r.press(button(r.line(), 'Se planen'))
  assert.equal(r.upserts.length, 1)
})

test('ugen starter om 8 dage: linjen vises, og datoen kommer med i Vælg plandato ved tryk', async t => {
  const r = await mount(t, { planFrom: plus(8) })
  assert.match(r.line().textContent, /Ny kostplan fra fredag 13\. november/)
  assert.ok(!all(r.select(), 'option').some(o => o.getAttribute('value') === plus(8)))
  await r.press(button(r.line(), 'Se planen'))
  const options = all(r.select(), 'option')
  assert.deepEqual(options.map(o => o.getAttribute('value')), [...previewDates(date), plus(8)])
  assert.match(options.at(-1).textContent, /^Om 8 dage · 13\. november$/)
  assert.equal(propsOf(r.select()).value, plus(8))
  assert.match(all(r.host, 'section').find(n => n.getAttribute('aria-label') === 'Kommende kostplan').textContent, /Frokost <syntetisk>/)
  assert.equal(r.upserts.length, 1)
})

test('ugen starter om 14 dage: ingen linje, siden som før', async t => {
  const r = await mount(t, { planFrom: plus(14) })
  assert.equal(r.line(), undefined)
  assert.doesNotMatch(r.card().textContent, /Ny kostplan|Se planen/)
  assert.equal(r.upserts.length, 0)
})

test('ingen plan og usendt plan: ingen linje', async t => {
  const r = await mount(t, { approve: false })
  assert.equal(r.line(), undefined)
  const f = fixture(); f.approve(); f.plan.data.kostplan_v1_approvals.length = 0
  f.plan.data.kostplan_v1_plans[0].valid_from = plus(2)
  const client = { from: table => { const q = f.client.from(table); if (!q.gte) q.gte = () => q; return q } }
  assert.equal(await readNextPlanStart({ client, athleteId, today: date }), null)
})

test('læsefejl: ingen linje, ingen fejltekst, siden som før', async t => {
  const r = await mount(t, { planFrom: plus(1), readError: true })
  assert.ok(r.reads.length > 0)
  assert.equal(r.line(), undefined)
  assert.equal(all(r.host, '[role="alert"]').length, 0)
  assert.equal(r.upserts.length, 0)
})

test('planmåltider i dag: ingen linje, selv om næste uge er sendt', async t => {
  const r = await mount(t, { planFrom: plus(2), todayPlan: true })
  assert.match(r.card().textContent, /Frokost <syntetisk> som planlagt/)
  assert.equal(r.line(), undefined)
})

test('model: previewDates og readNextPlanStart', async () => {
  assert.deepEqual(previewDates(date), [date, plus(1), plus(2), plus(3)])
  assert.deepEqual(previewDates(date, plus(2)), [date, plus(1), plus(2), plus(3)])
  assert.deepEqual(previewDates(date, plus(13)), [date, plus(1), plus(2), plus(3), plus(13)])
  for (const bad of [plus(14), date, plus(-1), 'bad', undefined]) assert.deepEqual(previewDates(date, bad), [date, plus(1), plus(2), plus(3)])
  assert.equal(await readNextPlanStart({ client: null, athleteId, today: date }), null)
  assert.equal(await readNextPlanStart({ client: { from() { throw Error('syntetisk') } }, athleteId, today: date }), null)
})
