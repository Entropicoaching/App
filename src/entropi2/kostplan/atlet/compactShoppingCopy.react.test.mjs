import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { formatApprovedShopping, shoppingNumber, maxShoppingText } from './approvedShoppingModel.mjs'
import { FRIDA_FOODS } from '../foedevarer/frida55.mjs'
import { createPlanSnapshot } from '../planSnapshot.mjs'
import { historyFixture, uuid } from '../dailyReference.fixture.mjs'
import { fixture as dayFixture } from './daySession.fixture.mjs'
import { shoppingFixture, today, dates, athleteId, tableNames, mealNames, gate } from './approvedShopping.fixture.mjs'
import { all, byKey, propsOf, button, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

function official() {
  const f = historyFixture(), parent = f.plan(96000, today, 'godkendt', athleteId)
  const foods = FRIDA_FOODS.slice(0, 26).concat(FRIDA_FOODS.at(-1))
  let i = 0
  const snapshot = createPlanSnapshot({ goal: 'vedligehold', intensity: .3,
    meals: mealNames.map((name, mi) => ({ name, portions: Array.from({ length: mi < 3 ? 5 : 4 }, () => ({
      grams: i === 0 ? .1 : i + .125, food: foods[i++],
    })) })) })
  const meals = structuredClone(snapshot.meals)
  meals[0].portions.push({ grams: .2, food: foods[0] })
  f.data[tableNames[1]].push({ id: uuid(96001), plan_id: parent.id, version_no: 1,
    effective_from: today, portion_guidance: null, ...snapshot, meals })
  f.approve(96001, parent.id, today + 'T11:00:00Z', athleteId)
  return f
}
const make = (f, extra = {}) => createApprovedShopping({ enabled: true, athleteId, today, client: f.client, storage: () => null, ...extra })
const digest = text => createHash('sha256').update(text).digest('hex')

test('pinned official 27-food full export repeats official tuples; immutable golden baseline', async t => {
  const f = official(), raw = JSON.stringify(f.data), c = make(f); t.after(c.dispose)
  assert.equal(await c.load(), true)
  assert.equal(c.snapshot().result.items.length, 27)
  const full = formatApprovedShopping(c.snapshot().result)
  assert.equal(full.split('[ParameterID,Source,SourceFood]=').length - 1, 27)
  console.log(`OFFICIAL_BASELINE bytes=${Buffer.byteLength(full)} sha256=${digest(full)}`)
  assert.equal(digest(full), '31920f24d6188bfad05d736144034cf2f80ff1cd9086d09f2cf667eb432bc106')
  assert.equal(JSON.stringify(f.data), raw); assert.equal(f.writes().length, 0)
})

import { formatCompactShopping } from './compactShoppingText.mjs'
const shortLabel = 'Kopiér kort indkøbsliste'
const fullLabel = 'Kopiér indkøbsliste'
const section = host => all(host, 'section').find(n => n.getAttribute('aria-label') === 'Indkøb fra kostplanen')
const marks = host => all(section(host), 'button').filter(n => n.getAttribute('role') === 'checkbox')
async function mount(t, { f = official(), route = false, ...extra } = {}) {
  const dom = hostFixture(), day = dayFixture(), copies = [], warnings = [], root = createRoot(dom.host)
  for (const table of tableNames) day.plan.data[table] = f.data[table]
  const boundary = { writeText(text) { copies.push(text) }, readText() { assert.fail('No readback permission/access') } }
  // Entire navigator is synthetic; never use the machine clipboard.
  dom.globals({ localStorage: day.storage, navigator: { clipboard: boundary } })
  const original = console.error; console.error = (...a) => warnings.push(a.map(String).join(' '))
  const props = route ? { enabled: true, athlete: { id: athleteId }, date: today, client: day.client,
    foods: [], weightLogs: [], currentDay: () => today, ...extra }
    : { enabled: true, athleteId, today, client: f.client, storage: () => day.storage, clipboard: boundary, ...extra }
  let alive = true
  const render = () => act(async () => { root.render(h(StrictMode, null, h(route ? Entropi2Kost : ApprovedPlanShopping, props))); await tick() })
  const click = label => act(async () => { const n = button(section(dom.host), label); assert.ok(n, label); await propsOf(n).onClick(); await tick() })
  const choose = (date, checked) => act(async () => {
    const n = all(section(dom.host), 'input').find(n => n.getAttribute('aria-label') === `Indkøb ${date}`)
    propsOf(n).onChange({ currentTarget: { checked } }); await tick()
  })
  const unmount = async () => { if (alive) { alive = false; await act(async () => { root.unmount(); await tick() }) } }
  t.after(async () => { try { await unmount(); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  await render()
  return { ...dom, f, props, day, copies, render, click, choose, unmount }
}

test('official 27 foods: explicit short action preserves every exact gross row/order and full golden bytes before/after purchases', async t => {
  const r = await mount(t), c = make(r.f); t.after(c.dispose); await c.load()
  const result = c.snapshot().result, full = formatApprovedShopping(result), short = formatCompactShopping(result)
  assert.equal(digest(full), '31920f24d6188bfad05d736144034cf2f80ff1cd9086d09f2cf667eb432bc106')
  assert.equal(r.copies.length, 0)
  const control = button(section(r.host), shortLabel), p = propsOf(control)
  assert.equal(control.tagName, 'BUTTON'); assert.equal(p.type, 'button'); assert.equal(p.style.minHeight, 44)
  assert.equal(p.tabIndex, undefined); assert.equal(p.onKeyDown, undefined)
  control.focus(); assert.equal(r.doc.activeElement, control)
  await r.click(fullLabel); assert.equal(r.copies.at(-1), full)
  await r.click(shortLabel); assert.equal(r.copies.at(-1), short)
  assert.match(section(r.host).textContent, /Kort indkøbsliste kopieret/)
  assert.match(short, /Valgte datoer: 08\/11\/2026, 09\/11\/2026, 10\/11\/2026/)
  assert.match(short, /Bruttobehov – lager ikke fratrukket/)
  const rows = short.split('\n').slice(3)
  assert.equal(rows.length, 27)
  result.items.forEach((item, i) => assert.equal(rows[i], `${item.names.join(' / ')}: ${shoppingNumber(item.grams)} g. Tilberedning: ${item.preparation}.`))
  assert.match(rows[0], /0,9 g/); assert.match(rows.at(-1), /Ris, kogte/)
  assert.doesNotMatch(short, /ParameterID|https:|godkendt version|næringsdækning|kcal|protein/)
  assert.ok(short.length < full.length / 3)
  console.log(`OFFICIAL_SHORT bytes=${Buffer.byteLength(short)} fullBytes=${Buffer.byteLength(full)}`)
  await act(async () => { propsOf(marks(r.host)[0]).onClick(); await tick() })
  assert.equal(propsOf(marks(r.host)[0])['aria-checked'], true)
  await r.click(shortLabel); assert.equal(r.copies.at(-1), short)
  await r.click(fullLabel); assert.equal(r.copies.at(-1), full)
  await r.click('Hent indkøbsgrundlag igen')
  assert.equal(propsOf(marks(r.host)[0])['aria-checked'], true)
  await r.click(fullLabel); assert.equal(r.copies.at(-1), full)
  assert.equal(r.f.writes().length, 0)
})

test('legacy independent quantities, aliases and duplicate identities stay ordered; exact food IDs and rows disambiguate', async t => {
  const f = shoppingFixture(), c = make(f); t.after(c.dispose); await c.load()
  const result = c.snapshot().result, before = formatApprovedShopping(result)
  const short = formatCompactShopping(result), rows = short.split('\n').slice(3)
  assert.equal(rows.length, 5)
  for (const [i, grams] of ['450', '900', '42', '66', '78'].entries()) assert.ok(rows[i].includes(`: ${grams} g.`))
  assert.ok(rows[0].includes('fødevare-id: synthetic:lentils; række 1'))
  assert.ok(rows[4].includes('fødevare-id: synthetic:lentils; række 5'))
  assert.ok(rows[1].includes('fødevare-id: synthetic:rice; række 2'))
  assert.ok(rows[3].includes('fødevare-id: synthetic:rice-other; række 4'))
  assert.match(rows[2], /Tilberedning: rå\./)
  const copied = []
  await c.copyCompact({ writeText(text) { copied.push(text) } }); c.markBought(4, true)
  await c.copy({ writeText(text) { copied.push(text) } })
  assert.deepEqual(copied, [short, before]); assert.equal(formatApprovedShopping(result), before)
  const alias = structuredClone(result)
  alias.items[0].names = ['Linser / røde', 'Ærter æøå']
  assert.match(formatCompactShopping(alias), /Linser \/ røde \/ Ærter æøå/)
})

test('selected dates include today and only checked calendar days, full evidence unchanged, empty selection unavailable', async t => {
  const r = await mount(t)
  await r.choose(today, true); await r.choose(dates[1], false); await r.click(shortLabel)
  assert.match(r.copies.at(-1), /07\/11\/2026, 08\/11\/2026, 10\/11\/2026/)
  assert.doesNotMatch(r.copies.at(-1), /09\/11\/2026/)
  await r.click(fullLabel); assert.match(r.copies.at(-1), /2026-11-07: godkendt version/)
  for (const date of [today, dates[0], dates[2]]) await r.choose(date, false)
  assert.equal(button(section(r.host), shortLabel), undefined)
  assert.equal(button(section(r.host), fullLabel), undefined)
  assert.match(r.host.textContent, /Vælg mindst én dag/)
})

for (const kind of ['null', 'missing', 'throw', 'reject', 'unknown']) test('short clipboard '+kind+': exact bounded selectable fallback without claiming success or reading clipboard', async t => {
  const boundary = kind === 'null' ? null : kind === 'missing' ? {} : {
    writeText() { if (kind === 'throw') throw Error('synthetic denial'); if (kind === 'reject') return Promise.reject(Error('synthetic denial')); return { status: 'readback-unknown' } },
    readText() { assert.fail('No readback') },
  }
  const r = await mount(t, { clipboard: boundary }), c = make(r.f); t.after(c.dispose); await c.load()
  const expected = formatCompactShopping(c.snapshot().result)
  await r.click(shortLabel)
  assert.doesNotMatch(section(r.host).textContent, /Kort indkøbsliste kopieret\./)
  assert.match(section(r.host).textContent, /Kopiering af den korte liste kunne ikke bekræftes/)
  const area = all(section(r.host), 'textarea')[0], p = propsOf(area)
  assert.equal(all(section(r.host), 'textarea').length, 1)
  assert.equal(p.value, expected); assert.equal(p.readOnly, true); assert.equal(p.maxLength, maxShoppingText)
  assert.ok(p.value.length <= maxShoppingText)
  let selections = 0; area.select = () => selections++; p.onFocus({ currentTarget: area }); assert.equal(selections, 1)
  assert.equal(r.copies.length, 0)
  r.props.clipboard = { writeText(text) { r.copies.push(text) } }; await r.render(); await r.click(shortLabel)
  assert.equal(r.copies.at(-1), expected); assert.equal(all(section(r.host), 'textarea').length, 0)
})

for (const changed of ['athlete', 'date', 'client', 'OFF', 'readOnly', 'unmount', 'currentDay']) test('pending short copy retires across '+changed+'; retained callbacks cannot copy old evidence', async t => {
  const g = gate(), copies = []; let currentDate = today
  const r = await mount(t, { clipboard: { async writeText(text) { copies.push(text); await g.promise } }, currentDay: () => currentDate })
  const retained = propsOf(button(section(r.host), shortLabel)).onClick
  let pending
  await act(async () => { pending = retained(); await tick() })
  assert.equal(propsOf(button(section(r.host), fullLabel)).disabled, true)
  if (changed === 'athlete') r.props.athleteId = 'synthetic-other'
  if (changed === 'date') r.props.today = dates[0]
  if (changed === 'client') r.props.client = official().client
  if (changed === 'OFF') r.props.enabled = false
  if (changed === 'readOnly') r.props.readOnly = true
  if (changed === 'currentDay') currentDate = dates[0]
  if (changed === 'unmount') await r.unmount(); else await r.render()
  const before = r.host.textContent
  assert.equal(await retained(), false)
  await act(async () => { g.resolve(); assert.equal(await pending, false); await tick() })
  assert.equal(r.host.textContent, before); assert.equal(copies.length, 1)
  assert.equal(all(r.host, 'textarea').length, 0)
})

test('date/result changes and overlapping copy modes serialize; late rejection cannot disclose stale short text', async t => {
  const g = gate(), copies = []
  const r = await mount(t, { clipboard: { async writeText(text) { copies.push(text); await g.promise; throw Error('synthetic late rejection') } } })
  const retained = propsOf(button(section(r.host), shortLabel)).onClick
  const full = propsOf(button(section(r.host), fullLabel)).onClick
  let pending; await act(async () => { pending = retained(); await tick() })
  assert.equal(await full(), false)
  await r.choose(dates[0], false)
  assert.equal(await retained(), false)
  assert.equal(propsOf(button(section(r.host), shortLabel)).disabled, true)
  await act(async () => { g.resolve(); await pending; await tick() })
  assert.equal(all(section(r.host), 'textarea').length, 0)
  assert.equal(await retained(), false)
  r.props.clipboard = { writeText(text) { copies.push(text) } }; await r.render()
  await r.click(shortLabel); assert.doesNotMatch(copies.at(-1), /08\/11\/2026/)
  await r.click(fullLabel); assert.doesNotMatch(copies.at(-1), /2026-11-08: godkendt/)
})

for (const kind of ['partial', 'failed', 'loading']) test(kind+' scope never exposes a short export or stale fallback', async t => {
  const r = await mount(t, { clipboard: null })
  const retained = propsOf(button(section(r.host), shortLabel)).onClick
  await r.click(shortLabel); assert.equal(all(section(r.host), 'textarea').length, 1)
  const g = gate(); let blocked = false, pending
  if (kind === 'partial') r.f.data[tableNames[1]][0].effective_from = dates[1]
  if (kind === 'failed') r.f.options.error = '42501'
  if (kind === 'loading') r.f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
  await act(async () => { pending = propsOf(button(section(r.host), 'Hent indkøbsgrundlag igen')).onClick(); await tick() })
  assert.equal(button(section(r.host), shortLabel), undefined); assert.equal(all(section(r.host), 'textarea').length, 0)
  assert.equal(await retained(), false); assert.equal(r.copies.length, 0)
  assert.match(r.host.textContent, /ufuldstændig/)
  if (kind === 'loading') await act(async () => { g.resolve(); await pending; await tick() })
})

for (const changed of ['athlete', 'date', 'client', 'OFF', 'unmount', 'selection']) test('late result read cannot enable old short action after '+changed, async t => {
  const r = await mount(t), g = gate(); let blocked = false
  const retained = propsOf(button(section(r.host), shortLabel)).onClick
  r.f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
  let pending; await act(async () => { pending = propsOf(button(section(r.host), 'Hent indkøbsgrundlag igen')).onClick(); await tick() })
  assert.equal(button(section(r.host), shortLabel), undefined)
  if (changed === 'athlete') r.props.athleteId = 'synthetic-other'
  if (changed === 'date') r.props.today = dates[0]
  if (changed === 'client') r.props.client = official().client
  if (changed === 'OFF') r.props.enabled = false
  if (changed === 'unmount') await r.unmount()
  else if (changed === 'selection') await r.choose(dates[2], false)
  else await r.render()
  const before = r.host.textContent
  await act(async () => { g.resolve(); assert.equal(await pending, false); await tick() })
  assert.equal(r.host.textContent, before); assert.equal(await retained(), false); assert.equal(r.copies.length, 0)
})

test('reentrant injected clipboard getter revokes current evidence before any write', async t => {
  const c = make(official()); t.after(c.dispose); await c.load()
  let writes = 0
  const adapter = { get writeText() { c.dispose(); return () => writes++ } }
  assert.equal(await c.copyCompact(adapter), false); assert.equal(writes, 0)
})

test('formatter rejects oversized, incomplete and empty data without truncating or substituting technical export', () => {
  assert.throws(() => formatCompactShopping({ complete: false }))
  assert.throws(() => formatCompactShopping({ complete: true, dates: [], days: [], items: [] }))
  const large = { complete: true, dates, days: [], items: [{ names: ['x'.repeat(maxShoppingText)], foodId: 'x', preparation: 'rå', grams: '0.3', source: { citation: 'x', verification: 'x' } }] }
  assert.throws(() => formatCompactShopping(large))
})

test('actual athlete route short copy and bought marks preserve typed intake draft, Today/Future state, all source data and writes', async t => {
  const r = await mount(t, { route: true })
  const manual = byKey(r.host, 'field-Måltid'); assert.ok(manual)
  manual.value = 'Kortliste-kladden æøå'; manual.dispatch('input', { target: manual }); await act(async () => { await tick() })
  const tracker = all(r.host, '[data-entropi2-kost]')[0], before = JSON.stringify(r.f.data)
  const writes = [...r.day.writes], storage = [...r.day.values], logs = r.day.calls.length
  await r.click(fullLabel); const full = r.copies.at(-1)
  const datePicker = all(r.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
  await act(async () => { propsOf(datePicker).onChange({ currentTarget: { value: dates[1] } }); await tick() })
  const preview = all(r.host, 'section').find(n => n.getAttribute('aria-label') === 'Kommende kostplan')
  assert.ok(preview); const previewBytes = preview.textContent
  assert.equal(tracker.parentElement.parentElement.getAttribute('hidden'), '')
  await r.click(shortLabel); assert.match(r.copies.at(-1), /^Kort indkøbsliste/)
  assert.equal(preview.textContent, previewBytes)
  assert.equal(tracker.parentElement.parentElement.getAttribute('hidden'), '')
  await act(async () => { propsOf(datePicker).onChange({ currentTarget: { value: today } }); await tick() })
  assert.equal(r.day.calls.length, logs)
  await act(async () => { propsOf(marks(r.host)[0]).onClick(); await tick() })
  await r.click(shortLabel); await r.click(fullLabel); assert.equal(r.copies.at(-1), full)
  assert.ok(all(r.host, '[data-entropi2-kost]')[0] === tracker)
  assert.ok(byKey(r.host, 'field-Måltid') === manual); assert.equal(manual.value, 'Kortliste-kladden æøå')
  assert.equal(tracker.parentElement.parentElement.getAttribute('hidden'), null)
  assert.deepEqual(r.day.writes, writes); assert.equal(r.day.rows.length, 0); assert.equal(r.day.plan.writes().length, 0)
  // Only the existing purchase namespace may change on the explicit bought action.
  for (const [key, value] of storage) assert.equal(r.day.values.get(key), value)
  assert.equal(JSON.stringify(r.f.data), before)
})

test('both clipboard modes share pending exclusion; full-mode late completion cannot replace newer short fallback', async t => {
  const c = make(official()); t.after(c.dispose); await c.load()
  const g = gate(), copies = []
  const pending = c.copy({ async writeText(text) { copies.push(text); await g.promise } })
  assert.equal(await c.copyCompact({ writeText() { assert.fail('pending full copy') } }), false)
  await c.choose([dates[2]])
  g.resolve(); assert.equal(await pending, false)
  const requested = formatCompactShopping(c.snapshot().result)
  assert.equal(await c.copyCompact(null), false)
  assert.equal(c.snapshot().compactCopyText, requested); assert.equal(c.snapshot().compactCopyStatus, 'failed')
  assert.equal(c.snapshot().copyText, ''); assert.equal(copies.length, 1)
})

test('display-identical alias labels and source-only identity differences are never merged or ambiguous', async t => {
  const c = make(shoppingFixture()); t.after(c.dispose); await c.load()
  const r = structuredClone(c.snapshot().result)
  r.items[0].names = ['Ris / Linser']; r.items[1].names = ['Ris', 'Linser']
  r.items[0].preparation = r.items[1].preparation = 'kogte'
  const rows = formatCompactShopping(r).split('\n').slice(3)
  assert.ok(rows[0].includes('[fødevare-id: synthetic:lentils; række 1]'))
  assert.ok(rows[1].includes('[fødevare-id: synthetic:rice; række 2]'))
  assert.equal(rows.length, 5)
})
