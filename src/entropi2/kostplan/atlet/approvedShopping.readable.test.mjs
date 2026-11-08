// Actual React/StrictMode and product controller; synthetic transport/host only.
// This host has no browser layout or native keyboard engine: assert the native
// semantic/style contract here; visual and screen-reader acceptance stays root's.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { shoppingItemText, formatApprovedShopping } from './approvedShoppingModel.mjs'
import { purchaseNamespace, purchaseScope } from './purchaseMarkers.mjs'
import { createPlanSnapshot } from '../planSnapshot.mjs'
import { historyFixture, uuid } from '../dailyReference.fixture.mjs'
import { fixture as dayFixture } from './daySession.fixture.mjs'
import { food, mealNames, tableNames, today, athleteId, dates, gate } from './approvedShopping.fixture.mjs'
import { all, byKey, propsOf, button, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

function groceries() {
  const f = historyFixture(), plan = f.plan(95000, today, 'godkendt', athleteId)
  let next = 0
  const snapshot = createPlanSnapshot({ goal: 'vedligehold', intensity: .2,
    meals: mealNames.map((name, mi) => ({ name, portions: Array.from({ length: mi < 3 ? 5 : 4 }, () => {
      const i = next++
      return { grams: i === 0 ? .1 : i + 1.125,
        food: food(`readable:${i < 3 ? 0 : i}`, i < 3 ? 'Linser æøå' : `Indkøbsvare ${i}`,
          i === 1 ? 'kogte og afdryppede' : 'rå',
          `Public synthetic source ${i}: public/catalog/edition-2026/ingredients-${i}.json; git=${'abcdef0123456789'.repeat(3)}; `
            + 'Exact public synthetic origin and preparation evidence. '.repeat(2)) }
    }) })) })
  // Decimal duplicate aggregates; same name/id with different preparation/source
  // remains three distinct groceries. A second name for one identity stays whole.
  const meals = structuredClone(snapshot.meals)
  meals[0].portions.push({ grams: .2, food: { ...structuredClone(meals[0].portions[0].food), name: 'Røde linser' } })
  const version = { id: uuid(95001), plan_id: plan.id, version_no: 1, effective_from: today,
    portion_guidance: null, ...snapshot, meals }
  f.data[tableNames[1]].push(version); f.approve(95001, plan.id, today + 'T10:00:00Z', athleteId)
  const evidence = dates.map(date => ({ date, versionId: version.id, planId: plan.id, versionNumber: 1,
    effectiveFrom: today, meals: version.meals }))
  return { f, evidence, version }
}

const shop = host => all(host, 'section').find(n => n.getAttribute('aria-label') === 'Indkøb fra kostplanen')
const list = host => all(shop(host), 'ul').find(n => n.getAttribute('aria-label') === 'Samlet bruttobehov')
const marks = host => all(shop(host), 'button').filter(n => n.getAttribute('role') === 'checkbox')
// Read only the summary of a closed disclosure; textContent itself includes
// hidden descendants and therefore cannot prove the default visual contract.
function visibleText(node) {
  if (node.tagName === 'DETAILS' && node.getAttribute('open') === null) return visibleText(node.children[0])
  if (node.nodeType === 3 || !node.children.length) return node.textContent
  return Array.from(node.children).map(visibleText).join(' ')
}
const disclosure = async (node, open) => act(async () => {
  if (open) node.setAttribute('open', ''); else node.removeAttribute('open')
  node.dispatch('toggle', { target: node }); await tick()
})

async function mounted(t, route = false) {
  const { f, evidence, version } = groceries(), dom = hostFixture(), day = dayFixture()
  for (const table of tableNames) day.plan.data[table] = f.data[table]
  const values = new Map([['unrelated', 'untouched']]), writes = [], copies = [], warnings = []
  const storage = { getItem: k => values.get(k) ?? null, setItem(k, v) { writes.push([k, v]); values.set(k, v) } }
  dom.globals({ localStorage: storage, navigator: { clipboard: { writeText: text => copies.push(text) } } })
  let root = createRoot(dom.host), alive = true
  const originalError = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
  const props = route ? { enabled: true, athlete: { id: athleteId }, date: today, client: day.client,
    foods: [], weightLogs: [], currentDay: () => today }
    : { enabled: true, athleteId, today, client: f.client, storage: () => storage,
      clipboard: { writeText: text => copies.push(text) } }
  const render = () => act(async () => { root.render(h(StrictMode, null, h(route ? Entropi2Kost : ApprovedPlanShopping, props))); await tick() })
  const click = n => act(async () => { assert.ok(n); await propsOf(n).onClick(); await tick() })
  const choose = (date, checked) => act(async () => {
    const n = all(shop(dom.host), 'input').find(n => n.getAttribute('aria-label') === `Indkøb ${date}`)
    propsOf(n).onChange({ currentTarget: { checked } }); await tick()
  })
  const unmount = async () => { if (alive) { alive = false; await act(async () => { root.unmount(); await tick() }) } }
  t.after(async () => {
    try { await unmount(); assert.deepEqual(warnings, []) } finally { console.error = originalError; dom.restore() }
  })
  await render()
  return { ...dom, f, day, evidence, version, props, copies, values, writes, render, click, choose,
    reopen: async () => { await unmount(); root = createRoot(dom.host); alive = true; await render() } }
}

test('27 actual StrictMode groceries: readable native disclosures, full evidence/copy and exact v2 marks across refresh/preview/reopen', async t => {
  const r = await mounted(t), raw = JSON.stringify(r.f.data)
  const c = createApprovedShopping({ enabled: true, athleteId, today, client: r.f.client, storage: () => null })
  t.after(() => c.dispose()); assert.equal(await c.load(), true)
  const gross = c.snapshot().result, expectedCopy = formatApprovedShopping(gross)
  assert.equal(gross.items.length, 27); assert.equal(list(r.host).children.length, 27)
  assert.equal(gross.items[0].grams, '0.9'); assert.equal(gross.items[1].grams, '6.375')
  console.log(`lead: 27 items, ${all(list(r.host), 'details').length} item disclosures; first full item ${shoppingItemText(gross.items[0]).length} characters`)
  assert.equal(all(list(r.host), 'details').length, 27, 'technical item evidence must be default-closed')
  const basis = all(shop(r.host), 'details').find(n => !list(r.host).contains(n))
  assert.ok(basis); assert.equal(basis.getAttribute('open'), null)
  assert.match(basis.children[0].textContent, /Dage, versioner og måltider/)
  assert.doesNotMatch(visibleText(shop(r.host)), /public\/catalog|abcdef0123456789|10000000-0000|Fødevare-id:|Kilde:/)
  for (const d of gross.days) assert.ok(basis.textContent.includes(
    `${d.date}: version ${d.versionNumber} (${d.versionId}), gældende fra ${d.effectiveFrom}. Måltider: ${d.mealNames.join(', ')}.`))
  for (const [i, item] of gross.items.entries()) {
    const row = list(r.host).children[i], toggle = marks(r.host)[i], details = all(row, 'details')[0], summary = details.children[0]
    assert.equal(details.getAttribute('open'), null); assert.equal(summary.tagName, 'SUMMARY')
    assert.equal(all(summary, 'button, input, a, summary').length, 0, 'no nested controls')
    assert.equal(all(toggle, 'details, summary, button, input').length, 0)
    assert.equal(details.contains(toggle), false)
    assert.equal(propsOf(toggle)['aria-label'], `Købt: ${item.names.join(' / ')}: ${String(item.grams).replace('.', ',')} g. Tilberedning: ${item.preparation}. Vare ${i + 1} af ${gross.items.length}.`)
    assert.equal(propsOf(toggle)['aria-checked'], false)
    assert.equal(summary.getAttribute('aria-label'), `Kilde og varegrundlag: ${item.names.join(' / ')}: ${String(item.grams).replace('.', ',')} g. Tilberedning: ${item.preparation}. Vare ${i + 1} af ${gross.items.length}.`)
    assert.match(summary.textContent, /Kilde og varegrundlag/)
    for (const n of [summary, toggle]) {
      const p = propsOf(n); assert.equal(p.style.minHeight, 44); assert.equal(p.tabIndex, undefined)
      assert.equal(p.onKeyDown, undefined); assert.equal(p.style.outline, undefined)
      n.focus(); assert.equal(r.doc.activeElement, n)
    }
    assert.equal(propsOf(toggle).style.minWidth, 44)
    assert.equal(all(details, 'p')[0].textContent, shoppingItemText(item), 'full evidence without substitutions')
    assert.ok(visibleText(row).includes(`${item.names.join(' / ')}: ${String(item.grams).replace('.', ',')} g.`))
    assert.ok(visibleText(row).includes(`Tilberedning: ${item.preparation}.`))
    const content = details.parentElement
    assert.equal(propsOf(content).style.minWidth, 0); assert.equal(propsOf(content).style.maxWidth, '100%')
    assert.equal(propsOf(content).style.flex, '1 1 16rem')
    assert.equal(propsOf(row).style.flexWrap, 'wrap'); assert.equal(propsOf(summary).style.whiteSpace, 'normal')
  }
  assert.equal(propsOf(shop(r.host)).style.overflowWrap, 'anywhere')
  assert.equal(propsOf(shop(r.host)).style.boxSizing, 'border-box')
  assert.equal(new Set(marks(r.host).map(n => propsOf(n)['aria-label'])).size, 27)
  assert.equal(r.writes.length, 0); assert.equal(r.copies.length, 0)
  await r.click(button(shop(r.host), 'Kopiér indkøbsliste')); assert.equal(r.copies.at(-1), expectedCopy)
  const originalToggle = marks(r.host)[0], first = all(list(r.host), 'details')[0]
  await disclosure(first, true); await disclosure(basis, true)
  assert.ok(visibleText(list(r.host)).includes(gross.items[0].source.citation))
  assert.ok(visibleText(basis).includes(r.version.id)); assert.equal(r.writes.length, 0)
  await r.click(originalToggle)
  assert.equal(marks(r.host)[0], originalToggle, 'stable keyed row and callback index')
  assert.equal(propsOf(marks(r.host)[0])['aria-checked'], true)
  assert.equal(propsOf(marks(r.host)[1])['aria-checked'], false, 'same name/different preparation remains separate')
  assert.equal(r.writes.length, 1)
  const key = `${purchaseNamespace}:${encodeURIComponent(athleteId)}`, saved = r.values.get(key)
  assert.equal(JSON.parse(saved).scope, purchaseScope({ athleteId, today, evidence: r.evidence, result: gross }))
  await disclosure(first, false); await disclosure(first, true); await disclosure(first, false); await disclosure(basis, false)
  assert.equal(propsOf(marks(r.host)[0])['aria-checked'], true); assert.equal(r.values.get(key), saved)
  await r.click(button(shop(r.host), 'Kopiér indkøbsliste')); assert.equal(r.copies.at(-1), expectedCopy)
  await r.click(button(shop(r.host), 'Hent indkøbsgrundlag igen'))
  assert.equal(propsOf(marks(r.host)[0])['aria-checked'], true)
  await r.choose(dates[0], false); assert.ok(marks(r.host).every(n => !propsOf(n)['aria-checked']))
  await r.choose(dates[0], true); assert.equal(propsOf(marks(r.host)[0])['aria-checked'], true)
  assert.equal(r.writes.length, 1); assert.equal(r.values.get(key), saved)
  await r.reopen(); assert.equal(propsOf(marks(r.host)[0])['aria-checked'], true)
  assert.ok(all(shop(r.host), 'details').every(n => n.getAttribute('open') === null))
  await r.click(button(shop(r.host), 'Kopiér indkøbsliste')); assert.equal(r.copies.at(-1), expectedCopy)
  assert.equal(r.writes.length, 1); assert.equal(r.values.get('unrelated'), 'untouched')
  r.props.clipboard = null; await r.render()
  await r.click(button(shop(r.host), 'Kopiér indkøbsliste'))
  const fallback = all(shop(r.host), 'textarea')[0]
  assert.equal(propsOf(fallback).value, expectedCopy); assert.equal(propsOf(fallback).readOnly, true)
  assert.match(visibleText(shop(r.host)), /Kopiering kunne ikke bekræftes/)
  assert.ok(all(shop(r.host), 'details').every(n => !n.contains(fallback)), 'copy failure remains outside disclosures')
  assert.equal(r.writes.length, 1)
  assert.equal(JSON.stringify(r.f.data), raw); assert.equal(r.f.writes().length, 0)
  assert.deepEqual(c.snapshot().result, gross)
})

test('mounted Kost entry: tracker survives readable disclosures; incomplete/loading/errors stay visible and retired actions cannot write', async t => {
  const r = await mounted(t, true)
  assert.equal(list(r.host).children.length, 27)
  const input = byKey(r.host, 'field-Måltid'); input.value = 'Bevaret syntetisk kladde'; input.dispatch('input', { target: input })
  await act(async () => { await tick() })
  const manual = byKey(r.host, 'field-Måltid'), tracker = all(r.host, '[data-entropi2-kost]')[0]
  const raw = JSON.stringify(r.f.data), diaryWrites = [...r.day.writes], drafts = [...r.day.values], calls = r.day.calls.length
  const details = all(list(r.host), 'details')[4]
  await disclosure(details, true); await r.click(marks(r.host)[4]); await disclosure(details, false)
  assert.equal(all(r.host, '[data-entropi2-kost]')[0], tracker)
  assert.equal(byKey(r.host, 'field-Måltid'), manual); assert.equal(manual.value, 'Bevaret syntetisk kladde')
  assert.deepEqual(r.day.writes, diaryWrites); assert.deepEqual([...r.day.values], drafts); assert.equal(r.day.calls.length, calls)
  assert.equal(r.day.rows.length, 0); assert.equal(r.day.plan.writes().length, 0)
  const retained = propsOf(marks(r.host)[4]).onClick, savedWrites = r.writes.length
  const g = gate(); let blocked = false, pending
  r.day.plan.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
  try {
    await act(async () => { pending = propsOf(button(shop(r.host), 'Hent indkøbsgrundlag igen')).onClick(); await tick() })
    assert.equal(blocked, true); assert.equal(list(r.host), undefined)
    assert.match(visibleText(shop(r.host)), /Henter godkendte planer.*ufuldstændig/)
    assert.equal(await retained(), false); assert.equal(r.writes.length, savedWrites)
  } finally { await act(async () => { g.resolve(); await pending; await tick() }) }
  r.day.plan.options.error = '42501'
  await r.click(button(shop(r.host), 'Hent indkøbsgrundlag igen'))
  assert.equal(list(r.host), undefined); assert.equal(all(shop(r.host), 'details').length, 0)
  assert.equal(button(shop(r.host), 'Kopiér indkøbsliste'), undefined)
  assert.match(visibleText(shop(r.host)), /Listen er ufuldstændig/)
  for (const date of dates) assert.ok(all(shop(r.host), '[role="alert"]')[0].textContent.includes(date))
  r.day.plan.options.error = null
  await r.click(button(shop(r.host), 'Hent indkøbsgrundlag igen'))
  const stale = propsOf(marks(r.host)[4]).onClick
  r.props.enabled = false; await r.render()
  assert.equal(r.host.textContent, ''); assert.equal(await stale(), false); assert.equal(r.writes.length, savedWrites)
  assert.equal(JSON.stringify(r.f.data), raw); assert.equal(r.f.writes().length, 0)
})
