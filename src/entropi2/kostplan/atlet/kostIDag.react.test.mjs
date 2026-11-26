import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { friUge } from '../friPulje.mjs'
import { statusLinje, hurtigeMaaltider, forslag, detaljerNoegle, laesDetaljer, gemDetaljer } from './kostIDagModel.mjs'

// 1899 (Marc 19. nov.): Kost er simpel at indtaste; detaljerne er et lag, man åbner.
const meal = (day, name, kcal = 500, protein = 30) => ({ athlete_id: athleteId, date: day, meal: name, kcal, protein, carb: 50, fat: 15,
  created_at: day + 'T10:00:00Z' })
const foods = [{ id: 'syntetisk-kylling', name: 'Kyllingebryst', kcal100: 110, protein100: 23, carb100: 0, fat100: 2 },
  { id: 'frida55:1', name: 'Kylling Frida', kcal100: 100, protein100: 20, carb100: 0, fat100: 2 }]

test('model: én statuslinje, hurtige måltider uden dubletter, forslag uden Frida og lagets valg pr. atlet', () => {
  assert.equal(statusLinje({ loaded: false }), 'Henter dagens tal…')
  const s = { loaded: true, totals: { kcal: 1130, protein: 72 }, targets: { kcal: 2600, protein: 170 } }
  assert.equal(statusLinje(s), 'I dag 1.130 af 2.600 kcal · 72 af 170 g protein')
  assert.equal(statusLinje(s, [{ values: { kcal: 200, protein: 20 } }]), 'I dag 1.330 af 2.600 kcal · 92 af 170 g protein (gemmer)')
  assert.equal(statusLinje({ ...s, targets: {} }), 'I dag 1.130 kcal · 72 g protein')
  assert.match(statusLinje({ loaded: true, totals: null }), /kan ikke lægges sammen/)
  const a = { meal: 'A', kcal: 1, protein: 1, carb: 1, fat: 1 }, b = { ...a, meal: 'B' }, c = { ...a, meal: 'C' }
  assert.deepEqual(hurtigeMaaltider({ loaded: true, favorites: [a], yesterday: [a, b], recent: [b, c, { ...a, meal: 'D' }, { ...a, meal: 'E' }] }).map(m => m.meal), ['A', 'B', 'C', 'D'])
  const f = forslag({ loaded: true, favorites: [], recent: [{ ...a, meal: 'Kyllingesalat' }], foods }, 'kyll')
  assert.deepEqual(f.meals.map(m => m.meal), ['Kyllingesalat'])
  assert.deepEqual(f.foods.map(item => item.food.name), ['Kyllingebryst'])
  assert.deepEqual(forslag({ loaded: true, foods }, 'k'), { meals: [], foods: [] })
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }
  assert.equal(laesDetaljer(storage, 'x'), false)
  gemDetaljer(storage, 'x', true)
  assert.equal(values.get(detaljerNoegle('x')), '1'); assert.equal(laesDetaljer(storage, 'x'), true); assert.equal(laesDetaljer(storage, 'y'), false)
  assert.equal(laesDetaljer({ getItem() { throw Error('nej') } }, 'x'), false)
})

async function mount(t, options = {}) {
  if (!t.mockedDate) { t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') }); t.mockedDate = true }
  const f = fixture(options); f.approve()
  if (options.igaar) options.igaar.forEach((navn, i) => f.rows.push({ ...meal('2026-11-04', navn, 500, 30), id: `y${i + 1}`, created_at: `2026-11-04T${String(10 + i).padStart(2, '0')}:00:00Z` }))
  else f.rows.push({ ...meal('2026-11-04', 'Havregrød med skyr', 520, 35), id: 'y1' }, { ...meal('2026-11-04', 'Rugbrød med æg', 610, 34), id: 'y2', created_at: '2026-11-04T12:00:00Z' })
  if (options.extraRows) f.rows.push(...options.extraRows)
  if (options.open) f.values.set(detaljerNoegle(athleteId), '1')
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: f.storage })
  const warnings = [], original = console.error
  console.error = (...args) => warnings.push(args.map(String).join(' '))
  let alive = true
  const unmount = () => act(async () => { if (alive) { alive = false; root.unmount(); await tick() } })
  t.after(async () => { try { await unmount(); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  const weight = { input: '', saved: [] }
  const props = () => ({ enabled: true, athlete: { id: athleteId, kcal_target: 2600, protein_target: 160 }, date, client: f.client, foods,
    weightLogs: [], weightInput: weight.input, onWeightInput: v => { weight.input = v }, async logWeight() { weight.saved.push(weight.input); weight.input = '' },
    currentDay: () => date })
  const render = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props()))); for (let i = 0; i < 8; i++) await tick() })
  await render()
  const card = () => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kost i dag')
  const layer = () => all(dom.host, '[data-kost-detaljer]')[0]
  const labelled = (label, host = card()) => all(host, 'button').find(n => n.getAttribute('aria-label') === label)
  const press = async node => { assert.ok(node); await act(async () => { await propsOf(node).onClick(); for (let i = 0; i < 12; i++) await tick() }) }
  const inserts = () => f.calls.filter(c => c.action === 'insert')
  return { ...dom, f, weight, render, unmount, card, layer, labelled, press, inserts }
}

test('Kost i dag: ét tryk for planmåltid, i går og seneste; nyt måltid på tre tryk; vand i den ene væskelog; detaljerne er skjult men monteret', async t => {
  const r = await mount(t)
  assert.ok(r.card(), 'kortet vises')
  assert.equal(all(r.host, 'section')[0], r.card(), 'kortet står øverst')
  // Detaljerne er lukket som standard, men alt er stadig monteret i laget.
  assert.equal(r.layer().getAttribute('data-kost-detaljer'), 'lukket')
  assert.equal(r.layer().getAttribute('hidden') !== null, true)
  for (const name of ['Dagens kostvane', 'Kostplan fra din coach', 'Dagens kostplan'])
    assert.ok(all(r.layer(), 'section').some(n => n.getAttribute('aria-label') === name), name)
  assert.ok(all(r.layer(), 'summary').some(n => n.textContent === 'Kostlog og vejning'))
  assert.ok(button(r.layer(), 'Log mad'))
  assert.match(r.card().textContent, /I dag 0 af .* kcal · 0 af .* g protein/)

  await r.press(r.labelled('Frokost <syntetisk>: spist som planlagt'))
  assert.deepEqual(r.inserts().map(c => c.value.meal), ['Frokost <syntetisk>'])
  assert.equal(!!r.labelled('Frokost <syntetisk>: spist som planlagt'), false)
  assert.match(r.card().textContent, /Spist: Frokost <syntetisk>/)

  await r.press(r.labelled('Spist igen: Rugbrød med æg'))
  assert.deepEqual(r.inserts().map(c => [c.value.meal, c.value.date]), [['Frokost <syntetisk>', date], ['Rugbrød med æg', date]])
  assert.match(r.card().textContent, /Rugbrød med æg gemt\./)
  // Et forkert tryk fortrydes med kostloggens egen Fortryd.
  const rows = r.f.rows.filter(row => row.date === date).length
  await r.press(button(r.card(), 'Fortryd'))
  assert.equal(r.f.rows.filter(row => row.date === date).length, rows - 1)
  assert.match(r.card().textContent, /Rugbrød med æg er fortrudt\./)
  await r.press(r.labelled('Spist igen: Rugbrød med æg'))

  // Nyt måltid: skriv, vælg forslaget, Log. Frida-fødevarer foreslås ikke her.
  const field = all(r.card(), 'input').find(n => n.getAttribute('aria-label') === 'Nyt måltid')
  await act(async () => { propsOf(field).onChange({ currentTarget: { value: 'kyll' } }); await tick() })
  assert.equal(!!r.labelled('Vælg Kylling Frida'), false)
  await r.press(r.labelled('Vælg Kyllingebryst'))
  await r.press(r.labelled('Log Kyllingebryst'))
  const last = r.inserts().at(-1).value
  assert.equal(r.inserts().length, 4)
  assert.equal(last.meal, 'Kyllingebryst · 1 stk (150 g)'); assert.equal(last.kcal, 165)

  // Vand: én væskelog; kompakt i kortet, ingen anden væskevisning.
  assert.equal(all(r.host, '[data-water-goal]').length, 0)
  const before = r.f.writes.length
  await r.press(r.labelled('Drukket 250 ml vand'))
  assert.equal(r.f.writes.length, before + 1)
  assert.match(all(r.card(), '[data-water-compact]')[0].textContent, /250 ml/)

  // Vægt: samme logWeight som kostloggen.
  const vaegt = all(r.card(), 'input').find(n => n.getAttribute('aria-label') === 'Vægt i kg')
  await act(async () => { propsOf(vaegt).onChange({ currentTarget: { value: '82,4' } }); await tick() })
  await r.render()
  const form = all(r.card(), 'form')[0]
  await act(async () => { await propsOf(form).onSubmit({ preventDefault() {} }); for (let i = 0; i < 4; i++) await tick() })
  await r.render()
  assert.deepEqual(r.weight.saved, ['82,4'])
  assert.match(r.card().textContent, /Vægt gemt: 82,4 kg/)
})

test('Kost i dag: tallet vises straks som ventende, og en fejlet gemning siger det tydeligt med Prøv igen', async t => {
  let release, fail = true
  const r = await mount(t, { beforeLog: call => call.action === 'insert'
    && new Promise(resolve => { release = resolve }).then(() => { if (fail) throw Error('syntetisk netfejl') }) })
  const knap = r.labelled('Spist igen: Havregrød med skyr')
  assert.ok(knap, r.card().textContent)
  await act(async () => { propsOf(knap).onClick(); for (let i = 0; i < 6; i++) await tick() })
  assert.match(r.card().textContent, /I dag 520 af .* kcal · 35 af .* g protein \(gemmer\)/)
  assert.match(r.card().textContent, /Gemmer Havregrød med skyr…/)
  await act(async () => { release(); for (let i = 0; i < 12; i++) await tick() })
  const alert = all(r.card(), '[role="alert"]')[0]
  assert.match(alert.textContent, /Havregrød med skyr blev ikke gemt/)
  assert.match(r.card().textContent, /I dag 0 af .* kcal/)
  assert.doesNotMatch(r.card().textContent, /\(gemmer\)/)
  fail = false
  const retry = button(r.card(), 'Prøv igen')
  await act(async () => { propsOf(retry).onClick(); for (let i = 0; i < 4; i++) await tick() })
  await act(async () => { release(); for (let i = 0; i < 12; i++) await tick() })
  assert.match(r.card().textContent, /Havregrød med skyr gemt\./)
  assert.match(r.card().textContent, /I dag 520 af/)
})

test('Vis detaljer: åbner laget med alt det gamle og huskes pr. atlet', async t => {
  const r = await mount(t)
  await r.press(button(r.host, 'Vis detaljer'))
  assert.equal(r.layer().getAttribute('hidden') !== null, false)
  assert.equal(r.f.values.get(detaljerNoegle(athleteId)), '1')
  // Med laget åbent står det fulde væskemål og rettelser, og kun én væskevisning.
  assert.equal(all(r.host, '[data-water-compact]').length, 0)
  assert.equal(all(r.host, '[data-water-goal]').length, 1)
  assert.ok(button(r.host, 'Skjul detaljer'))
})

test('Vis detaljer: et husket åbent lag står åbent ved næste besøg og kan lukkes igen', async t => {
  const s = await mount(t, { open: true })
  assert.equal(s.layer().getAttribute('hidden') !== null, false)
  await s.press(button(s.host, 'Skjul detaljer'))
  assert.equal(s.layer().getAttribute('hidden') !== null, true)
  assert.equal(s.f.values.get(detaljerNoegle(athleteId)), '0')
})

test('Kost i dag: en uafklaret planregistrering siges som uafklaret og prøves ikke blindt igen', async t => {
  const r = await mount(t, { lostInsert: true })
  await r.press(r.labelled('Frokost <syntetisk>: spist som planlagt'))
  const alert = all(r.card(), '[role="alert"]')[0]
  assert.match(alert?.textContent ?? r.card().textContent, /Frokost <syntetisk>: .*Se kostplanen under Vis detaljer\./)
  assert.equal(!!button(r.card(), 'Prøv igen'), false)
  assert.equal(!!button(r.card(), 'Hent dagen igen'), true)
  const igen = r.labelled('Frokost <syntetisk>: spist som planlagt')
  assert.equal(!igen || igen.getAttribute('disabled') !== null, true, 'ingen blind gentagelse')
})

// 1918 (Marc 19. nov.: Kost skal være rigtig simpelt): "Ikke fundet: notér med egne tal" må ikke svigte tavst.
test('Ikke fundet: notér med egne tal siger fra, når kostloggen ikke er klar, og et nyt tryk prøver igen', async t => {
  let slip = null
  const r = await mount(t, { beforeLog: call => call.action !== 'insert' ? undefined : new Promise(resolve => { slip = resolve }) })
  const field = all(r.card(), 'input').find(n => n.getAttribute('aria-label') === 'Nyt måltid')
  await act(async () => { propsOf(field).onChange({ currentTarget: { value: 'zzzz ukendt ret' } }); await tick() })
  const egne = () => button(r.card(), 'Ikke fundet: notér med egne tal')
  const besked = () => all(r.card(), '[role="status"]').find(n => /Kostloggen er ikke klar\. Prøv igen om lidt\./.test(n.textContent))
  // Uden hængende gem åbner knappen kostloggen som i dag: ingen besked.
  await r.press(egne())
  assert.equal(!!besked(), false, 'ingen besked, når kostloggen er klar')
  assert.equal(r.layer().getAttribute('hidden') !== null, false, 'laget er åbnet')
  // Et måltidsgem er i gang: kostloggen er ikke skrivbar, og openFoodLog giver false.
  act(() => { propsOf(r.labelled('Spist igen: Rugbrød med æg')).onClick() })
  await act(async () => { for (let i = 0; i < 6; i++) await tick() })
  await r.press(egne())
  assert.ok(besked(), 'synlig besked i stedet for tavshed')
  // Gemmet er færdigt; et nyt tryk prøver igen, og beskeden forsvinder.
  slip?.({ error: null, data: null })
  await act(async () => { for (let i = 0; i < 12; i++) await tick() })
  await r.press(egne())
  assert.equal(!!besked(), false, 'nyt tryk prøver igen og lykkes')
})

// 1921 (Marc 19. nov.: en træls gentagelig handling lidt nemmere): samme måltid med en anden mængde.
test('Kost i dag: Ret g logger samme fødevare med en anden mængde på tre tryk uden at søge', async t => {
  const r = await mount(t, { extraRows: [{ ...meal('2026-11-04', 'Kyllingebryst · 150 g', 165, 35), id: 'y3', created_at: '2026-11-04T13:00:00Z' }] })
  assert.equal(!!r.labelled('Anden mængde: Rugbrød med æg'), false, 'ingen knap, når fødevaren ikke findes i listen')
  await r.press(r.labelled('Anden mængde: Kyllingebryst · 150 g'))
  const field = all(r.card(), 'input').find(n => n.getAttribute('aria-label') === 'Mængde Kyllingebryst')
  assert.equal(propsOf(field).value, '150', 'mængden står udfyldt')
  assert.equal(r.inserts().length, 0, 'intet er gemt endnu')
  await act(async () => { propsOf(field).onChange({ currentTarget: { value: '200' } }); await tick() })
  await r.press(r.labelled('Log Kyllingebryst'))
  const last = r.inserts().at(-1).value
  assert.equal(r.inserts().length, 1)
  assert.equal(last.meal, 'Kyllingebryst · 200 g'); assert.equal(last.kcal, 220)
})

// 1923 (Marc 19. nov.: en træls gentagelig handling lidt nemmere): et logget måltid rettes i samme række.
test('Kost i dag: tryk på et logget måltid retter mængden i samme række; en fejl beholder den gamle', async t => {
  let fail = true
  const r = await mount(t, { extraRows: [{ ...meal(date, 'Kyllingebryst · 150 g', 165, 35), id: 'i-dag-1' }],
    beforeLog: call => { if (call.action === 'update' && fail) throw Error('syntetisk netfejl') } })
  const raekker = () => r.f.rows.filter(row => row.date === date)
  assert.match(r.card().textContent, /I dag 165 af/)
  await r.press(r.labelled('Ret mængde: Kyllingebryst · 150 g'))
  const field = () => all(r.card(), 'input').find(n => n.getAttribute('aria-label') === 'Ny mængde Kyllingebryst')
  assert.equal(propsOf(field()).value, '150', 'mængden står udfyldt')
  await act(async () => { propsOf(field()).onChange({ currentTarget: { value: '200' } }); await tick() })
  await r.press(r.labelled('Gem Kyllingebryst'))
  // Fejl: beskeden står, og rækken og dagens tal er de gamle.
  assert.match(all(r.card(), '[role="alert"]')[0]?.textContent ?? '', /Kyllingebryst · 200 g blev ikke gemt/)
  assert.deepEqual(raekker().map(row => [row.meal, row.kcal]), [['Kyllingebryst · 150 g', 165]])
  assert.match(r.card().textContent, /I dag 165 af/)
  fail = false
  await r.press(button(r.card(), 'Prøv igen'))
  assert.deepEqual(raekker().map(row => [row.id, row.meal, row.kcal]), [['i-dag-1', 'Kyllingebryst · 200 g', 220]], 'én række med ny mængde')
  assert.equal(r.inserts().length, 0, 'ingen ny række')
  assert.match(r.card().textContent, /I dag 220 af/)
  assert.match(r.card().textContent, /Kyllingebryst · 200 g gemt\./)
  assert.ok(r.labelled('Ret mængde: Kyllingebryst · 200 g'))
})

// 1924 (Marc 19. nov.: en træls gentagelig handling lidt nemmere): et spist planmåltid rettes i samme række og står stadig som spist.
test('Kost i dag: tryk på et spist planmåltid retter mængden i samme række; det står stadig som spist; en fejl beholder den gamle', async t => {
  let fail = true
  const r = await mount(t, { beforeLog: call => { if (call.action === 'update' && fail) throw Error('syntetisk netfejl') } })
  await r.press(r.labelled('Frokost <syntetisk>: spist som planlagt'))
  const plan = () => r.f.rows.filter(row => row.date === date)
  const kvittering = () => [...r.f.values.entries()].find(([key]) => key.startsWith('entropi2:kostplan:atlet:v1:'))?.[1]
  assert.deepEqual(plan().map(row => [row.meal, row.kcal]), [['Frokost <syntetisk>', 200]])
  assert.equal(!!r.labelled('Ret mængde: Frokost <syntetisk>'), true)
  assert.match(r.card().textContent, /Spist: Frokost <syntetisk> · 200 g/)
  const gammel = kvittering()
  await r.press(r.labelled('Ret mængde: Frokost <syntetisk>'))
  const field = () => all(r.card(), 'input').find(n => n.getAttribute('aria-label') === 'Ny mængde Frokost <syntetisk>')
  assert.equal(propsOf(field()).value, '200', 'mængden står udfyldt')
  await act(async () => { propsOf(field()).onChange({ currentTarget: { value: '300' } }); await tick() })
  assert.match(r.labelled('Gem Frokost <syntetisk>').textContent, /Gem · 300 kcal/)
  await r.press(r.labelled('Gem Frokost <syntetisk>'))
  // Fejl: rækken og kvitteringen er de gamle, og måltidet står stadig som spist.
  assert.match(all(r.card(), '[role="alert"]')[0]?.textContent ?? '', /Frokost <syntetisk> · 300 g blev ikke gemt/)
  assert.deepEqual(plan().map(row => [row.meal, row.kcal]), [['Frokost <syntetisk>', 200]])
  assert.equal(kvittering(), gammel)
  assert.match(r.card().textContent, /Spist: Frokost <syntetisk> · 200 g/)
  assert.doesNotMatch(r.card().textContent, /skal kontrolleres/)
  fail = false
  await r.press(button(r.card(), 'Prøv igen'))
  assert.deepEqual(plan().map(row => [row.meal, row.kcal, row.protein]), [['Frokost <syntetisk>', 300, 30]], 'én række med ny mængde')
  assert.equal(r.inserts().length, 1, 'ingen ny række ud over Spist')
  assert.notEqual(kvittering(), gammel)
  // Efter kostplanens egen genindlæsning: stadig spist med den nye mængde, ikke "skal kontrolleres".
  assert.match(r.card().textContent, /Spist: Frokost <syntetisk> · 300 g/)
  assert.doesNotMatch(r.card().textContent, /skal kontrolleres/)
  assert.match(r.card().textContent, /Frokost <syntetisk> · 300 g gemt\./)
  assert.match(r.card().textContent, /I dag 300 af/)
})

test('Kost i dag: et planmåltid, som coachen har navngivet "· N g", står kun under Spist, ikke under Logget i dag', async t => {
  const r = await mount(t, { lunchName: 'Frokost · 200 g' })
  await r.press(r.labelled('Frokost · 200 g: spist som planlagt'))
  assert.deepEqual(r.f.rows.filter(row => row.date === date).map(row => row.meal), ['Frokost · 200 g'])
  assert.doesNotMatch(r.card().textContent, /Logget i dag/)
  assert.equal(all(r.card(), 'button').filter(n => n.getAttribute('aria-label') === 'Ret mængde: Frokost · 200 g').length, 1)
  assert.match(r.card().textContent, /Spist: Frokost · 200 g · 200 g/)
})

// 1933 (Marc 19. nov.): et fejltryk på "Alt fra i går" skal kunne fortrydes med ét tryk.
test('Kost i dag: Alt fra i går kan fortrydes med ét tryk og fjerner præcis de rækker, knappen lavede', async t => {
  const r = await mount(t)
  const alt = () => all(r.card(), 'button').find(n => /^(Alt fra i går \(\d+\)|Spis som i går \(andre retter end planen\))$/.test(n.textContent))
  const idag = () => r.f.rows.filter(row => row.date === date)
  const foer = idag().map(row => row.id)
  await r.press(alt())
  assert.equal(r.inserts().length, 2)
  assert.equal(idag().length, foer.length + 2)
  const nye = idag().map(row => row.id).filter(id => !foer.includes(id))
  assert.ok(button(r.card(), 'Fortryd'), 'Fortryd vises for hele gruppen')
  await r.press(button(r.card(), 'Fortryd'))
  assert.deepEqual(idag().map(row => row.id), foer, 'kun gruppens to rækker er fjernet')
  assert.equal(r.f.calls.filter(c => c.action === 'delete' || c.action === 'remove').length >= 2, true)
  assert.match(r.card().textContent, /2 måltider fra i går er fortrudt\./)
  assert.equal(nye.length, 2)
  assert.equal(!!button(r.card(), 'Fortryd'), false)
})

// 1934 (Marc 19. nov.): "Prøv igen" efter delvis fejl på "Alt fra i går" må ikke logge de gemte rækker igen.
test('Kost i dag: Prøv igen efter delvis fejl på Alt fra i går logger kun de manglende rækker, og Fortryd fjerner alle gemte', async t => {
  let failing = true, inserts = 0
  const r = await mount(t, { extraRows: [{ ...meal('2026-11-04', 'Aftensmad med ris', 700, 40), id: 'y3', created_at: '2026-11-04T18:00:00Z' }],
    beforeLog: call => { if (call.action === 'insert' && ++inserts === 2 && failing) throw Error('Synthetic insert failure') } })
  const alt = () => all(r.card(), 'button').find(n => /^(Alt fra i går \(\d+\)|Spis som i går \(andre retter end planen\))$/.test(n.textContent))
  const idag = () => r.f.rows.filter(row => row.date === date)
  const foer = idag().map(row => row.id)
  await r.press(alt())
  assert.equal(idag().length, foer.length + 1, 'første række gemt, anden fejlede')
  failing = false
  await r.press(button(r.card(), 'Prøv igen'))
  const nye = idag().filter(row => !foer.includes(row.id))
  assert.deepEqual(nye.map(row => row.meal).sort(), ['Aftensmad', 'Aftensmad med ris', 'Frokost <syntetisk>'], 'hver række præcis én gang (de to første får dagens plannavne, 2154)')
  await r.press(button(r.card(), 'Fortryd'))
  assert.deepEqual(idag().map(row => row.id), foer, 'Fortryd fjerner alle tre gemte rækker')
})

// 1936 (Marc 19. nov.: en træls gentagelig handling lidt nemmere): et forkert logget måltid fjernes direkte i Kost i dag.
test('Kost i dag: Fjern tager et logget måltid væk med ét tryk, rører kun den række og kan fortrydes', async t => {
  const r = await mount(t, { extraRows: [{ ...meal(date, 'Syntetisk snack', 300, 12), id: 'i-dag-1' }, { ...meal(date, 'Syntetisk frokost uden gram', 450, 25), id: 'i-dag-2', created_at: date + 'T12:00:00Z' }] })
  const idag = () => r.f.rows.filter(row => row.date === date).map(row => row.id).sort()
  const sletninger = () => r.f.calls.filter(c => c.action === 'delete')
  assert.match(r.card().textContent, /I dag 750 af/)
  await r.press(r.labelled('Fjern måltid: Syntetisk snack'))
  assert.deepEqual(idag(), ['i-dag-2'], 'kun den ene række er væk')
  assert.equal(sletninger().length, 1)
  assert.ok(sletninger()[0].filters.some(([k, , v]) => k === 'id' && v === 'i-dag-1'), 'sletningen går på rækkens eget id')
  assert.ok(sletninger()[0].filters.some(([k, , v]) => k === 'athlete_id' && v === athleteId), 'og atletens eget id')
  assert.match(r.card().textContent, /Syntetisk snack er fjernet\./)
  assert.match(r.card().textContent, /I dag 450 af/)
  assert.equal(!!r.labelled('Fjern måltid: Syntetisk snack'), false)
  assert.ok(r.labelled('Fjern måltid: Syntetisk frokost uden gram'), 'rækker uden gram kan også fjernes')
  await r.press(button(r.card(), 'Fortryd'))
  assert.deepEqual(r.f.rows.filter(row => row.date === date).map(row => [row.meal, row.kcal, row.protein]).sort(),
    [['Syntetisk frokost uden gram', 450, 25], ['Syntetisk snack', 300, 12]])
  assert.match(r.card().textContent, /Syntetisk snack er sat tilbage\./)
  assert.match(r.card().textContent, /I dag 750 af/)
  assert.equal(!!button(r.card(), 'Fortryd'), false)
})

// 1940 (Marc 19. nov.: rigtig simpelt og overskueligt): hvert logget måltid står ét sted, med Ret og Fjern i samme række.
test('Kost i dag: ét logget måltid er én række med Ret og Fjern, under én overskrift', async t => {
  const r = await mount(t, { extraRows: [{ ...meal(date, 'Kyllingebryst · 150 g', 165, 35), id: 'i-dag-1' }, { ...meal(date, 'Syntetisk frokost uden gram', 450, 25), id: 'i-dag-2', created_at: date + 'T12:00:00Z' }] })
  const tekst = r.card().textContent
  assert.equal(tekst.split('Logget i dag').length - 1, 1, 'én overskrift')
  assert.doesNotMatch(tekst, /Fjern et forkert måltid/)
  const lister = all(r.card(), 'ul')
  assert.equal(lister.length, 1, 'én liste')
  const raekker = all(lister[0], 'li')
  assert.equal(raekker.length, 2, 'én række pr. måltid')
  for (const raekke of raekker) assert.equal(all(raekke, 'button').filter(b => /^Fjern måltid:/.test(b.getAttribute('aria-label'))).length, 1, 'Fjern i samme række')
  assert.equal(all(raekker.find(x => /Kyllingebryst/.test(x.textContent)), 'button').filter(b => /^Ret mængde: Kyllingebryst/.test(b.getAttribute('aria-label'))).length, 1, 'Ret i samme række')
  assert.equal(all(r.card(), 'button').filter(b => b.getAttribute('aria-label') === 'Fjern måltid: Kyllingebryst · 150 g').length, 1, 'Fjern findes kun ét sted')
  await r.press(r.labelled('Fjern måltid: Kyllingebryst · 150 g'))
  assert.deepEqual(r.f.rows.filter(row => row.date === date).map(row => row.id), ['i-dag-2'])
  assert.equal(all(r.card(), 'ul li').length, 1)
})

test('Kost i dag: en fejlet fjernelse beholder rækken og dagens tal og siger det', async t => {
  let fail = true
  const r = await mount(t, { extraRows: [{ ...meal(date, 'Syntetisk snack', 300, 12), id: 'i-dag-1' }],
    beforeLog: call => { if (call.action === 'delete' && fail) throw Error('syntetisk netfejl') } })
  await r.press(r.labelled('Fjern måltid: Syntetisk snack'))
  assert.match(all(r.card(), '[role="alert"]')[0]?.textContent ?? '', /Syntetisk snack blev ikke fjernet\. Det er stadig gemt\./)
  assert.deepEqual(r.f.rows.filter(row => row.date === date).map(row => row.id), ['i-dag-1'])
  assert.match(r.card().textContent, /I dag 300 af/)
  fail = false
  await r.press(button(r.card(), 'Prøv igen'))
  assert.deepEqual(r.f.rows.filter(row => row.date === date), [])
  assert.match(r.card().textContent, /I dag 0 af/)
})

test('Kost i dag: et spist planmåltid fjernes direkte, står som åbent igen, og Fortryd sætter det tilbage som spist', async t => {
  const r = await mount(t)
  await r.press(r.labelled('Frokost <syntetisk>: spist som planlagt'))
  assert.match(r.card().textContent, /Spist: Frokost <syntetisk> · 200 g/)
  await r.press(r.labelled('Fjern måltid: Frokost <syntetisk>'))
  assert.deepEqual(r.f.rows.filter(row => row.date === date), [])
  assert.match(r.card().textContent, /I dag 0 af/)
  assert.ok(r.labelled('Frokost <syntetisk>: spist som planlagt'), 'planmåltidet kan spises som planlagt igen')
  assert.doesNotMatch(r.card().textContent, /Spist: Frokost/)
  await r.press(button(r.card(), 'Fortryd'))
  assert.deepEqual(r.f.rows.filter(row => row.date === date).map(row => [row.meal, row.kcal]), [['Frokost <syntetisk>', 200]])
  assert.match(r.card().textContent, /Spist: Frokost <syntetisk> · 200 g/)
  assert.doesNotMatch(r.card().textContent, /skal kontrolleres/)
})

// 2154 (Marc 24. nov.): "Alt fra i går" skal tælle ærligt i Basemåltider fulgt, også når planens navne skifter mellem dage.
async function altFraIGaar(t, options) {
  const r = await mount(t, options)
  await r.press(all(r.card(), 'button').find(n => /^(Alt fra i går \(\d+\)|Spis som i går \(andre retter end planen\))$/.test(n.textContent)))
  const idag = r.f.rows.filter(row => row.date === date)
  const plan = [options.lunchName ?? 'Frokost <syntetisk>', 'Aftensmad']
  const uge = friUge({ dage: [{ date, state: 'approved', friPct: 15, targets: { kcal: 2600 }, maaltider: plan }], raekker: idag })
  return { navne: idag.map(row => row.meal), uge }
}

test('Alt fra i går 2154: samme plannavne begge dage giver 2 af 2', async t => {
  const { uge } = await altFraIGaar(t, { igaar: ['Frokost <syntetisk>', 'Aftensmad'] })
  assert.deepEqual([uge.basis, uge.basisAf], [2, 2])
})

test('Alt fra i går 2154: omdøbt planmåltid i dag tæller stadig som fulgt, og rækken får dagens plannavn', async t => {
  const { navne, uge } = await altFraIGaar(t, { igaar: ['Frokost <syntetisk>', 'Aftensmad'], lunchName: 'Frokost 2' })
  assert.deepEqual(navne, ['Frokost 2', 'Aftensmad'])
  assert.deepEqual([uge.basis, uge.basisAf], [2, 2])
})

test('Alt fra i går 2154: flere måltider i går end i dag tæller aldrig dobbelt; overskuddet er ikke et basemåltid', async t => {
  const { navne, uge } = await altFraIGaar(t, { igaar: ['Morgenmad', 'Frokost <syntetisk>', 'Aftensmad'] })
  assert.equal(navne.length, 3)
  assert.ok(uge.basis <= uge.basisAf && uge.basis <= 2)
  assert.deepEqual([uge.basis, uge.basisAf], [2, 2])
})

// 2156 (Marc 24. nov.): "en fast base"; ét tryk for resten af dagens åbne planmåltider.
const alt2156 = r => all(r.card(), 'button').find(n => /^Alt som planlagt \(\d+\)$/.test(n.textContent))
const idag2156 = r => r.f.rows.filter(row => row.date === date)

test('Alt som planlagt 2156: tre åbne måltider giver tre rækker med plannavne og friUge 3 af 3', async t => {
  const r = await mount(t, { tredjeMaaltid: true })
  assert.equal(alt2156(r).textContent, 'Alt som planlagt (3)')
  await r.press(alt2156(r))
  assert.deepEqual(idag2156(r).map(row => row.meal), ['Frokost <syntetisk>', 'Aftensmad', 'Mellemmåltid'])
  assert.equal(r.inserts().length, 3)
  const uge = friUge({ dage: [{ date, state: 'approved', friPct: 15, targets: { kcal: 2600 }, maaltider: ['Frokost <syntetisk>', 'Aftensmad', 'Mellemmåltid'] }], raekker: idag2156(r) })
  assert.deepEqual([uge.basis, uge.basisAf], [3, 3])
  assert.equal(!!alt2156(r), false, 'knappen forsvinder, når intet er åbent')
  assert.match(r.card().textContent, /3 planmåltider gemt som planlagt\./)
})

test('Alt som planlagt 2156: ét åbent måltid giver ingen samlet knap', async t => {
  const r = await mount(t)
  assert.equal(alt2156(r).textContent, 'Alt som planlagt (2)')
  await r.press(r.labelled('Frokost <syntetisk>: spist som planlagt'))
  assert.equal(!!alt2156(r), false, 'ét åbent måltid giver ingen samlet knap')
})

test('Alt som planlagt 2156: ét spist i forvejen giver kun de åbne, uden dobbeltlogning', async t => {
  const r = await mount(t, { tredjeMaaltid: true })
  await r.press(r.labelled('Aftensmad: spist som planlagt'))
  assert.equal(alt2156(r).textContent, 'Alt som planlagt (2)')
  await r.press(alt2156(r))
  assert.deepEqual(idag2156(r).map(row => row.meal).sort(), ['Aftensmad', 'Frokost <syntetisk>', 'Mellemmåltid'])
  assert.equal(r.inserts().length, 3, 'Aftensmad logges ikke igen')
})

test('Alt som planlagt 2156: Fortryd fjerner præcis gruppens rækker, ikke andre', async t => {
  const r = await mount(t, { tredjeMaaltid: true, extraRows: [{ ...meal(date, 'Syntetisk snack', 100, 5), id: 'egen-snack' }] })
  await r.press(r.labelled('Aftensmad: spist som planlagt'))
  const foer = idag2156(r).map(row => row.id)
  await r.press(alt2156(r))
  assert.equal(idag2156(r).length, foer.length + 2)
  await r.press(button(r.card(), 'Fortryd'))
  assert.deepEqual(idag2156(r).map(row => row.id), foer, 'kun gruppens to rækker er fjernet; snack og Aftensmad står')
  assert.match(r.card().textContent, /2 planmåltider er fortrudt\./)
  assert.equal(alt2156(r).textContent, 'Alt som planlagt (2)', 'måltiderne står åbne igen')
})

test('Alt som planlagt 2156: delvis fejl og Prøv igen logger ingen dobbelt, og Fortryd fjerner alle', async t => {
  const r = await mount(t, { tredjeMaaltid: true })
  // Anden reservation kan ikke skrives: intet gemmes for det måltid, og det er sikkert at prøve igen.
  const ægte = r.f.storage.setItem
  let skrivninger = 0, fejler = true
  r.f.storage.setItem = (key, value) => { if (key.startsWith('entropi2:kostplan:atlet:v1:') && ++skrivninger === 3 && fejler) throw Error('syntetisk lager'); return ægte(key, value) }
  await r.press(alt2156(r))
  assert.equal(idag2156(r).length, 1, 'første gemt, andet fejlede')
  assert.equal(r.inserts().length, 1)
  assert.match(all(r.card(), '[role="alert"]')[0]?.textContent ?? '', /planmåltider blev ikke gemt/)
  fejler = false
  await r.press(button(r.card(), 'Prøv igen'))
  assert.deepEqual(idag2156(r).map(row => row.meal).sort(), ['Aftensmad', 'Frokost <syntetisk>', 'Mellemmåltid'], 'hver række præcis én gang')
  assert.equal(r.inserts().length, 3)
  await r.press(button(r.card(), 'Fortryd'))
  assert.deepEqual(idag2156(r), [])
})

test('Alt som planlagt 2156: en uafklaret registrering prøves ikke blindt igen', async t => {
  let inserts = 0
  const r = await mount(t, { tredjeMaaltid: true, beforeLog: call => { if (call.action === 'insert' && ++inserts === 2) throw Error('Synthetic lost response') } })
  await r.press(alt2156(r))
  assert.match(all(r.card(), '[role="alert"]')[0]?.textContent ?? '', /Se kostplanen under Vis detaljer/)
  assert.ok(button(r.card(), 'Hent dagen igen'))
  assert.equal(r.inserts().length, 2, 'ingen tredje række og ingen gentagelse af den uafklarede')
})

// 2348 (Marc 24. nov.: "rent faktisk følger planerne"): et planmåltid logget på anden vis står som logget og logges ikke igen.
test('Planmåltid logget 2348: Spist igen med plannavn giver logget, ingen som-planlagt-knap og ingen dobbeltlogning', async t => {
  const r = await mount(t, { igaar: ['Frokost <syntetisk>', 'Aftensmad'] })
  assert.equal(alt2156(r).textContent, 'Alt som planlagt (2)')
  await r.press(r.labelled('Spist igen: Frokost <syntetisk>'))
  assert.equal(!!r.labelled('Frokost <syntetisk>: spist som planlagt'), false)
  assert.match(r.card().textContent, /Logget: Frokost <syntetisk>/)
  assert.ok(r.labelled('Aftensmad: spist som planlagt'))
  assert.equal(!!alt2156(r), false, 'ét åbent måltid giver ingen samlet knap')
  assert.equal(r.inserts().length, 1)
})

test('Planmåltid logget 2348: tre planmåltider hvor kun ét er logget under plannavn giver Alt som planlagt (2) og tre rækker i alt', async t => {
  const r = await mount(t, { tredjeMaaltid: true, extraRows: [{ ...meal(date, 'Aftensmad', 700, 40), id: 'nyt-1' }] })
  assert.match(r.card().textContent, /Logget: Aftensmad/)
  assert.equal(alt2156(r).textContent, 'Alt som planlagt (2)')
  await r.press(alt2156(r))
  assert.deepEqual(idag2156(r).map(row => row.meal).sort(), ['Aftensmad', 'Frokost <syntetisk>', 'Mellemmåltid'])
  assert.equal(r.inserts().length, 2, 'den loggede Aftensmad logges ikke igen')
})
