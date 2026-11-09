import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { kostdageIUgen, feedbackLinje, ugeLinje, weekStart, kostvane } from './kostvaneModel.mjs'

// date = 2026-11-05 er en torsdag; ugen starter mandag 2026-11-02.
const meal = (day, name, kcal = 500, protein = 30) => ({ athlete_id: athleteId, date: day, meal: name, kcal, protein, carb: 50, fat: 15,
  created_at: day + 'T10:00:00Z' })

test('kostvanen: kostdage tælles pr. uge fra mandag, og feedback bruger kun coachens mål', () => {
  assert.equal(weekStart(date), '2026-11-02')
  const rows = [meal('2026-11-01', 'a'), meal('2026-11-02', 'b'), meal('2026-11-02', 'c'), meal('2026-11-04', 'd')]
  assert.deepEqual(kostdageIUgen(rows, date), ['2026-11-02', '2026-11-04'])
  assert.match(ugeLinje(['2026-11-02', '2026-11-04'], date), /^2 af 4 kostdage i denne uge\. I dag tæller med.*2 dage mere/)
  assert.equal(ugeLinje(['a', 'b', 'c', date], date), 'Ugens mål er nået: 4 kostdage.')
  assert.equal(feedbackLinje({ totals: { kcal: 1800, protein: 120 }, targets: { kcal: 2600, protein: 160 } }),
    'Protein 120 af 160 g, 40 g mangler. Energi 1.800 af 2.600 kcal.')
  assert.equal(feedbackLinje({ totals: { kcal: 2550, protein: 158 }, targets: { kcal: 2600, protein: 160 } }),
    'Protein ramt: 158 af 160 g. Energi tæt på målet: 2.550 af 2.600 kcal.')
  assert.match(feedbackLinje({ totals: { kcal: 900, protein: 50 }, targets: { kcal: null, protein: null } }), /ikke sat dagsmål/)
  assert.deepEqual(kostvane({ loaded: false }), { phase: 'loading' })
})

test('Kost-siden: kortet står øverst, "Jeg spiste som i går" logger gårsdagens måltider i den samme kostlog, og dagen tjekkes ind', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
  const f = fixture()
  f.rows.push({ ...meal('2026-11-04', 'Havregrød med skyr', 520, 35), id: 'y1' }, { ...meal('2026-11-04', 'Kylling og ris', 700, 50), id: 'y2', created_at: '2026-11-04T18:00:00Z' },
    { ...meal('2026-11-03', 'Rugbrød', 400, 20), id: 'y3' })
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const warnings = [], original = console.error
  console.error = (...args) => warnings.push(args.map(String).join(' '))
  t.after(async () => { try { await act(async () => { root.unmount(); await tick() }) } finally { console.error = original; dom.restore() } })
  const props = { enabled: true, athlete: { id: athleteId, kcal_target: 2600, protein_target: 160 }, date, client: f.client,
    foods: [], weightLogs: [], weightInput: '', onWeightInput() {}, logWeight() {}, currentDay: () => date }
  const render = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); for (let i = 0; i < 6; i++) await tick() })
  await render()
  const card = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Dagens kostvane')
  assert.ok(card(), 'kortet vises')
  // Kortet står før kostplanen, væsken og selve kostloggen.
  const order = all(dom.host, 'section').map(n => n.getAttribute('aria-label'))
  assert.equal(order[0], 'Dagens kostvane')
  assert.equal(card().getAttribute('data-kostvane-trin'), '1')
  assert.match(card().textContent, /2 af 4 kostdage i denne uge/)
  const repeat = button(card(), 'Jeg spiste som i går (2 måltider)')
  assert.ok(repeat)
  const inserts = () => f.calls.filter(c => c.action === 'insert')
  assert.equal(inserts().length, 0)
  await act(async () => { await propsOf(repeat).onClick(); for (let i = 0; i < 10; i++) await tick() })
  assert.deepEqual(inserts().map(c => [c.value.meal, c.value.date, c.value.kcal]),
    [['Havregrød med skyr', date, 520], ['Kylling og ris', date, 700]])
  assert.equal(card().getAttribute('data-kostvane-trin'), '2')
  assert.match(card().textContent, /2 måltider logget i dag/)
  assert.match(card().textContent, /Protein 85 af 160 g, 75 g mangler\. Energi 1\.220 af 2\.600 kcal\./)
  assert.match(card().textContent, /3 af 4 kostdage i denne uge\. Én dag mere/)
  await act(async () => { propsOf(button(card(), 'Færdig for i dag')).onClick(); await tick() })
  assert.equal(card().getAttribute('data-kostvane-trin'), '3')
  assert.match(card().textContent, /Dagen er tjekket ind/)
  assert.ok([...f.values.keys()].some(k => k.startsWith('entropi2:kostvane-faerdig:v1:')))
  // Den almindelige "Log mad"-indgang og kostloggen er der stadig.
  assert.ok(button(dom.host, 'Log mad'))
  assert.deepEqual(warnings, [])
})
