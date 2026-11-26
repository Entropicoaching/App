import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { planVarerLinje } from './kostIDagModel.mjs'

// 2369 (Marc 25. nov. kl. 18:26: "atleten følger den i appen uden at spørge"): én linje med varer og gram under hvert åbent planmåltid.
const mad = (navn, grams) => ({ id: navn, name: navn, grams })

test('Varer 2369: linjen viser varer og gram som i Vis detaljer', () => {
  assert.equal(planVarerLinje({ foods: [mad('Havregryn', 40), mad('Skyr', 205), mad('Banan', 240)] }), 'Havregryn 40 g · Skyr 205 g · Banan 240 g')
  assert.equal(planVarerLinje({ foods: [mad('Havregryn', 30.4)] }), 'Havregryn 30,4 g')
})

test('Varer 2369 (2392: grænsen er 6): over 6 varer vises de 5 første og + N mere', () => {
  const fire = [mad('A', 1), mad('B', 2), mad('C', 3), mad('D', 4)]
  assert.equal(planVarerLinje({ foods: fire }), 'A 1 g · B 2 g · C 3 g · D 4 g')
  assert.equal(planVarerLinje({ foods: [...fire, mad('E', 5), mad('F', 6)] }), 'A 1 g · B 2 g · C 3 g · D 4 g · E 5 g · F 6 g')
  assert.equal(planVarerLinje({ foods: [...fire, mad('E', 5), mad('F', 6), mad('G', 7)] }), 'A 1 g · B 2 g · C 3 g · D 4 g · E 5 g + 2 mere')
})

test('Varer 2369: tomt måltid giver ingen linje', () => {
  assert.equal(planVarerLinje({ foods: [] }), null)
  assert.equal(planVarerLinje(null), null)
})

async function mount(t, { rows = [] } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture(); f.approve(); f.rows.push(...rows)
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const warnings = [], original = console.error
  console.error = (...args) => warnings.push(args.map(String).join(' '))
  t.after(async () => { try { await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  const props = () => ({ enabled: true, athlete: { id: athleteId, kcal_target: 2600, protein_target: 160 }, date, client: f.client, foods: [],
    weightLogs: [], weightInput: '', onWeightInput() {}, async logWeight() {}, currentDay: () => date })
  await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props()))); for (let i = 0; i < 8; i++) await tick() })
  const card = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kost i dag')
  return { card }
}

test('Varer 2369: åbne planmåltider viser linjen i kortet', async t => {
  const r = await mount(t)
  assert.match(r.card().textContent, /Syntetisk mad 200 g/)
  assert.match(r.card().textContent, /Syntetisk mad 2 300 g/)
})

test('Varer 2369: loggede planmåltider viser ikke linjen', async t => {
  const r = await mount(t, { rows: [{ athlete_id: athleteId, date, meal: 'Frokost <syntetisk>', kcal: 200, protein: 20, carb: 24, fat: 4, id: 'i1', created_at: date + 'T10:00:00Z' }] })
  assert.doesNotMatch(r.card().textContent, /Syntetisk mad 200 g/)
  assert.match(r.card().textContent, /Syntetisk mad 2 300 g/)
})
