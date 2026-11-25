import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { spistIgenMedPlannavn } from './kostIDagModel.mjs'

// 2359b (Marc 24. nov. kl. 19:11: "rent faktisk følger planerne"): "Spist igen" logger under planmåltidets navn, når maden svarer til et åbent planmåltid.
// Fixturens planmåltider: Frokost <syntetisk> 200 kcal / 20 g protein, Aftensmad 300 kcal / 30 g protein.
const foods = []
const hist = (navn, kcal, protein, i) => ({ athlete_id: athleteId, date: '2026-11-04', meal: navn, kcal, protein, carb: 20, fat: 5, id: `h${i}`, created_at: `2026-11-04T1${i}:00:00Z` })

async function mount(t, { rows, plan = true } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture(); if (plan) f.approve()
  f.rows.push(...rows)
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const warnings = [], original = console.error
  console.error = (...args) => warnings.push(args.map(String).join(' '))
  t.after(async () => { try { await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  const props = () => ({ enabled: true, athlete: { id: athleteId, kcal_target: 2600, protein_target: 160 }, date, client: f.client, foods,
    weightLogs: [], weightInput: '', onWeightInput() {}, async logWeight() {}, currentDay: () => date })
  await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props()))); for (let i = 0; i < 8; i++) await tick() })
  const card = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kost i dag')
  const labelled = label => all(card(), 'button').find(n => n.getAttribute('aria-label') === label)
  const press = async node => { assert.ok(node); await act(async () => { await propsOf(node).onClick(); for (let i = 0; i < 12; i++) await tick() }) }
  const inserts = () => f.calls.filter(c => c.action === 'insert').map(c => c.value.meal)
  return { f, card, labelled, press, inserts }
}

test('Spist igen 2359b: inden for 10 % af et åbent planmåltid gemmes rækken under planmåltidets navn, med besked', async t => {
  const r = await mount(t, { rows: [hist('Skyr med nødder', 210, 21, 0)] })
  await r.press(r.labelled('Spist igen: Skyr med nødder'))
  assert.deepEqual(r.inserts(), ['Frokost <syntetisk>'])
  assert.match(r.card().textContent, /Gemt som Frokost <syntetisk>/)
  assert.equal(!!r.labelled('Frokost <syntetisk>: spist som planlagt'), false)
})

test('Spist igen 2359b: uden for 10 % eller uden plan er adfærden uændret', async t => {
  const ude = await mount(t, { rows: [hist('Skyr med nødder', 250, 21, 0)] })
  await ude.press(ude.labelled('Spist igen: Skyr med nødder'))
  assert.deepEqual(ude.inserts(), ['Skyr med nødder'])
  assert.ok(ude.labelled('Frokost <syntetisk>: spist som planlagt'))
})

test('Spist igen 2359b: uden plan logges under eget navn', async t => {
  const r = await mount(t, { rows: [hist('Skyr med nødder', 210, 21, 0)], plan: false })
  await r.press(r.labelled('Spist igen: Skyr med nødder'))
  assert.deepEqual(r.inserts(), ['Skyr med nødder'])
})

test('Spist igen 2359b: et planmåltid, der allerede er logget i dag, matches ikke igen', async t => {
  const r = await mount(t, { rows: [hist('Skyr med nødder', 210, 21, 0), { ...hist('Frokost <syntetisk>', 200, 20, 1), date, id: 'i1' }] })
  await r.press(r.labelled('Spist igen: Skyr med nødder'))
  assert.deepEqual(r.inserts(), ['Skyr med nødder'])
})

test('model 2359b: nærmeste åbne planmåltid vinder; kcal og protein skal begge passe', () => {
  const aabne = [{ name: 'A', values: { kcal: 200, protein: 20 } }, { name: 'B', values: { kcal: 210, protein: 22 } }]
  assert.equal(spistIgenMedPlannavn({ meal: 'X', kcal: 209, protein: 22 }, aabne).plannavn, 'B')
  assert.equal(spistIgenMedPlannavn({ meal: 'X', kcal: 200, protein: 30 }, aabne).plannavn, null)
  assert.equal(spistIgenMedPlannavn({ meal: 'X', kcal: 200, protein: 20 }, []).plannavn, null)
})
