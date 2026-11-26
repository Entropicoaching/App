import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { KostplanAtletView } from './KostplanAtlet.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { setup } from './day.fixture.mjs'
import { all, propsOf, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

// 2387 (de tre niveau 3 stop fra 2384): Alt fra i går med andre retter end planen, Marcs faste mål i headeren og hele kcal i "Tilbage i dag".
// Fixturens planmåltider: Frokost <syntetisk> 200 kcal / 20 g protein, Aftensmad 300 kcal / 30 g protein (dagens plan 500 kcal); profilmål 2600 kcal.
const hist = (navn, kcal, protein, i) => ({ athlete_id: athleteId, date: '2026-11-04', meal: navn, kcal, protein, carb: 20, fat: 5, id: `h${i}`, created_at: `2026-11-04T1${i}:00:00Z` })
const andre = [hist('Frokost <syntetisk>', 500, 30, 0), hist('Aftensmad', 700, 30, 1)]
const somPlanen = [hist('Frokost <syntetisk>', 200, 20, 0), hist('Aftensmad', 300, 30, 1)]

async function mount(t, { rows }) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture(); f.approve()
  f.rows.push(...rows)
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const warnings = [], original = console.error
  console.error = (...args) => warnings.push(args.map(String).join(' '))
  t.after(async () => { try { await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  const props = () => ({ enabled: true, athlete: { id: athleteId, kcal_target: 2600, protein_target: 160 }, date, client: f.client, foods: [],
    weightLogs: [], weightInput: '', onWeightInput() {}, async logWeight() {}, currentDay: () => date })
  await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props()))); for (let i = 0; i < 8; i++) await tick() })
  const card = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kost i dag')
  const iGaar = () => all(card(), 'button').find(n => /fra i går|som i går/i.test(n.textContent))
  const press = async node => { assert.ok(node); await act(async () => { await propsOf(node).onClick(); for (let i = 0; i < 12; i++) await tick() }) }
  const inserts = () => f.calls.filter(c => c.action === 'insert').map(c => [c.value.meal, c.value.kcal, c.value.protein])
  return { f, card, iGaar, press, inserts }
}

test('2387 stop 2: andre retter end planen står tydeligt på knappen, planlisten består, og de samme rækker skrives', async t => {
  const r = await mount(t, { rows: andre })
  assert.equal(r.iGaar().textContent, 'Spis som i går (andre retter end planen)')
  await r.press(r.iGaar())
  assert.deepEqual(r.inserts(), [['Frokost <syntetisk>', 500, 30], ['Aftensmad', 700, 30]])
  assert.match(r.card().textContent, /Fra din kostplan/)
  assert.match(r.card().textContent, /Syntetisk mad 200 g/, 'dagens planlinje med varer står stadig')
  assert.match(r.card().textContent, /andre retter end planen/)
})

test('2387 stop 2: samme retter som planen giver knappen som før', async t => {
  const r = await mount(t, { rows: somPlanen })
  assert.equal(r.iGaar().textContent, 'Alt fra i går (2)')
})

test('2387 stop 3: headeren viser Marcs faste mål og dagens plan under, ikke planens kcal som mål', async t => {
  const r = await mount(t, { rows: andre })
  const tekst = r.card().textContent
  assert.match(tekst, /I dag 0 af 2\.600 kcal/)
  assert.match(tekst, /Mål 2\.600 kcal/)
  assert.match(tekst, /Dagens plan 500 kcal/)
  assert.doesNotMatch(tekst, /af 500 kcal/)
})

test('2387 stop 4: Tilbage i dag viser hele kcal', async () => {
  const f = setup(); await f.model.load()
  const html = renderToStaticMarkup(h(KostplanAtletView, { enabled: true, snapshot: { ...f.model.snapshot(), remaining: { kcal: 0.4, protein: 0 } }, onRetry() {} }))
  assert.match(html, /Tilbage i dag: 0 kcal/)
  assert.doesNotMatch(html, /0,4/)
  const hel = renderToStaticMarkup(h(KostplanAtletView, { enabled: true, snapshot: { ...f.model.snapshot(), remaining: { kcal: 1234.6, protein: 12.5 } }, onRetry() {} }))
  assert.match(hel, /Tilbage i dag: 1\.235 kcal · 12,5 g protein/)
})
