import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

// 1914: set-mærket skrives, når atleten ser den sendte uges planmåltider i "Kost i dag"
// eller åbner det gamle kort bag "Vis detaljer". Syntetisk atlet, ingen database.
const SEEN = 'kostplan_v1_seen'
const tomorrow = '2026-11-06', foods = []

async function mount(t, { seenTable = true, planFrom = date } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture(); f.approve()
  f.plan.data.kostplan_v1_plans[0].valid_from = planFrom
  f.plan.data.kostplan_v1_versions[0].effective_from = planFrom
  // Set-tabellen: upsert som ON CONFLICT DO NOTHING; mangler den, svarer den som PostgREST uden tabel.
  const seen = [], upserts = []
  const client = { from(table) {
    if (table === SEEN) return { async upsert(rows, options) {
      upserts.push({ rows, options })
      if (!seenTable) return { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }
      for (const row of rows) if (!seen.some(r => r.athlete_id === row.athlete_id && r.version_id === row.version_id)) seen.push(row)
      return { data: null, error: null }
    } }
    const q = f.client.from(table)
    // Den syntetiske plantabel kender ikke gte; ugens nedre grænse er altid opfyldt her.
    if (!q.gte) q.gte = () => q
    return q
  } }
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const warnings = [], original = console.error
  console.error = (...args) => warnings.push(args.map(String).join(' '))
  t.after(async () => {
    try { await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() }
  })
  const props = () => ({ enabled: true, athlete: { id: athleteId, kcal_target: 2600, protein_target: 160 }, date, client, foods,
    weightLogs: [], weightInput: '', onWeightInput() {}, async logWeight() {}, currentDay: () => date })
  const render = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props()))); for (let i = 0; i < 12; i++) await tick() })
  await render()
  const card = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kost i dag')
  const layer = () => all(dom.host, '[data-kost-detaljer]')[0]
  const press = async node => { assert.ok(node); await act(async () => { await propsOf(node).onClick(); for (let i = 0; i < 12; i++) await tick() }) }
  return { ...dom, f, seen, upserts, render, card, layer, press }
}

test('atleten ser planmåltiderne i Kost i dag: én set-række for den sendte version, laget forbliver lukket', async t => {
  const r = await mount(t)
  assert.match(r.card().textContent, /Frokost <syntetisk> som planlagt/)
  assert.equal(r.layer().getAttribute('data-kost-detaljer'), 'lukket')
  assert.equal(r.upserts.length, 1)
  assert.deepEqual(r.upserts[0].options, { onConflict: 'athlete_id,version_id', ignoreDuplicates: true })
  assert.deepEqual(r.seen, [{ athlete_id: athleteId, plan_id: r.f.plan.data.kostplan_v1_plans[0].id, version_id: r.f.plan.data.kostplan_v1_versions[0].id }])
  // Ny gengivelse og et planmåltid spist: ingen nye skrivninger.
  await r.render()
  await r.press(all(r.card(), 'button').find(n => n.getAttribute('aria-label') === 'Frokost <syntetisk>: spist som planlagt'))
  assert.equal(r.upserts.length, 1)
  assert.equal(r.seen.length, 1)
})

test('tabellen mangler (som i produktion i dag): ingen fejl, intet nyt for atleten', async t => {
  const r = await mount(t, { seenTable: false })
  assert.equal(r.upserts.length, 1)
  assert.equal(r.seen.length, 0)
  assert.match(r.card().textContent, /Frokost <syntetisk> som planlagt/)
  assert.equal(r.layer().getAttribute('data-kost-detaljer'), 'lukket')
  assert.equal(all(r.host, '[role="alert"]').length, 0)
  assert.doesNotMatch(r.host.textContent, /kostplan_v1_seen|PGRST205|Set af/)
})

test('ugen starter i morgen: intet mærke ved åbning af Kost; åbner atleten Vis detaljer, skrives én række', async t => {
  const r = await mount(t, { planFrom: tomorrow })
  assert.ok(r.card())
  assert.doesNotMatch(r.card().textContent, /som planlagt/)
  assert.equal(r.upserts.length, 0)
  await r.press(button(r.host, 'Vis detaljer'))
  assert.equal(r.layer().getAttribute('data-kost-detaljer'), 'aaben')
  assert.equal(r.upserts.length, 1)
  assert.equal(r.seen.length, 1)
  await r.press(button(r.host, 'Skjul detaljer'))
  await r.press(button(r.host, 'Vis detaljer'))
  assert.equal(r.upserts.length, 1)
})
