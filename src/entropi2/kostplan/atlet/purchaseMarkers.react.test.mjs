import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { shoppingFixture, athleteId, today, dates, tableNames, gate } from './approvedShopping.fixture.mjs'
import { fixture as dayFixture } from './daySession.fixture.mjs'
import { all, byKey, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const marks = host => all(host, 'button').filter(n => n.getAttribute('role') === 'checkbox')
const checked = host => marks(host).map(n => propsOf(n)['aria-checked'])
const shop = host => all(host, 'section').find(n => n.getAttribute('aria-label') === 'Indkøb fra kostplanen')
async function mounted(t, { route = false, denied = false } = {}) {
  const f = shoppingFixture(), day = dayFixture(), dom = hostFixture(), copies = [], data = new Map(), writes = [], warnings = []
  const storage = { getItem: k => data.get(k) ?? null, setItem(k, v) { if (denied) throw Error('quota'); writes.push(k); data.set(k, v) } }
  for (const table of tableNames) day.plan.data[table] = f.data[table]
  dom.globals({ localStorage: storage, navigator: { clipboard: { writeText: text => copies.push(text) } } })
  let root = createRoot(dom.host), live = true
  const originalError = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
  const props = route ? { enabled: true, athlete: { id: athleteId }, date: today, client: day.client, foods: [], weightLogs: [], currentDay: () => today }
    : { enabled: true, athleteId, today, client: f.client, storage: () => storage, clipboard: { writeText: text => copies.push(text) } }
  const render = () => act(async () => { root.render(h(StrictMode, null, h(route ? Entropi2Kost : ApprovedPlanShopping, props))); await tick() })
  const click = text => act(async () => { const n = button(shop(dom.host), text); assert.ok(n, text); await propsOf(n).onClick(); await tick() })
  const mark = i => act(async () => { await propsOf(marks(dom.host)[i]).onClick(); await tick() })
  const choose = (date, checked) => act(async () => {
    const n = all(shop(dom.host), 'input').find(n => n.getAttribute('aria-label') === `Indkøb ${date}`)
    propsOf(n).onChange({ currentTarget: { checked } }); await tick()
  })
  const unmount = async () => { if (live) { live = false; await act(async () => { root.unmount(); await tick() }) } }
  t.after(async () => { try { await unmount(); assert.deepEqual(warnings, []) } finally { console.error = originalError; dom.restore() } })
  await render()
  return { ...dom, f, day, data, writes, props, copies, render, mark, choose, click, unmount,
    remount: async () => { await unmount(); root = createRoot(dom.host); live = true; await render() } }
}

test('pinned missing-checkbox behavior: actual mounted consumer offers bought checkboxes and remaining count', async t => {
  const r = await mounted(t)
  assert.equal(marks(r.host).length, 5)
  assert.match(shop(r.host).textContent, /Mangler at købe: 5 af 5/)
  for (const n of marks(r.host)) {
    const p = propsOf(n); assert.equal(p.type, 'button'); assert.equal(p.style.minHeight, 44); assert.equal(p.style.minWidth, 44)
    assert.ok(p['aria-label'].includes('Tilberedning:')); assert.equal(p.tabIndex, undefined, 'native button keyboard focus')
    assert.equal(p.onKeyDown, undefined, 'native button Enter/Space click behavior')
  }
  await r.mark(0); assert.equal(checked(r.host)[0], true)
  assert.match(shop(r.host).textContent, /Mangler at købe: 4 af 5/)
  assert.match(shop(r.host).textContent, /ikke spist mad.*ikke lager.*ikke grambehov.*ikke til coachen/)
  assert.match(shop(r.host).textContent, /Linser: 450 g/)
  await r.remount(); assert.equal(checked(r.host)[0], true)
  await r.mark(0); assert.equal(checked(r.host)[0], false)
})

test('actual athlete route keeps tracker, search/draft and backend untouched while marks and full copy work', async t => {
  const r = await mounted(t, { route: true })
  const input = byKey(r.host, 'field-Måltid'); input.value = 'Syntetisk bevaret kladde'; input.dispatch('input', { target: input })
  await act(async () => { await tick() })
  const manual = byKey(r.host, 'field-Måltid'), tracker = all(r.host, '[data-entropi2-kost]')[0]
  const bytes = JSON.stringify(r.day.plan.data), logs = r.day.calls.length, drafts = [...r.day.values], localWrites = [...r.day.writes]
  await r.mark(0); await r.mark(3)
  assert.ok(all(r.host, '[data-entropi2-kost]')[0] === tracker)
  assert.ok(byKey(r.host, 'field-Måltid') === manual); assert.equal(manual.value, 'Syntetisk bevaret kladde')
  assert.equal(r.day.calls.length, logs); assert.deepEqual([...r.day.values], drafts); assert.deepEqual(r.day.writes, localWrites)
  assert.equal(JSON.stringify(r.day.plan.data), bytes); assert.equal(r.day.plan.writes().length, 0); assert.equal(r.day.rows.length, 0)
  await r.click('Kopiér indkøbsliste')
  assert.match(r.copies[0], /Linser: 450 g/); assert.match(r.copies[0], /Ris: 900 g/)
  for (const date of dates) assert.ok(r.copies[0].includes(date))
})

test('quota denied keeps session checkmarks, full list/copy and manual fallback; refresh retains session, reopen resets honestly', async t => {
  const r = await mounted(t, { denied: true })
  await r.mark(0); assert.equal(checked(r.host)[0], true)
  assert.match(shop(r.host).textContent, /kun i denne åbne visning/)
  await r.click('Hent indkøbsgrundlag igen'); assert.equal(checked(r.host)[0], true)
  r.props.clipboard = null; await r.render(); await r.click('Kopiér indkøbsliste')
  assert.match(propsOf(all(shop(r.host), 'textarea')[0]).value, /Linser: 450 g/)
  await r.remount(); assert.equal(checked(r.host)[0], false)
})

for (const changed of ['athlete', 'client', 'today', 'midnight', 'OFF', 'readOnly', 'unmount'])
  test(`StrictMode ${changed}: no stale checkmarks before confirmed current access and no retained marker writes`, async t => {
    const r = await mounted(t); await r.mark(0)
    const retained = propsOf(marks(r.host)[0]).onClick, g = gate(); let blocked = false, day = today
    const newFixture = shoppingFixture()
    newFixture.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
    if (changed === 'athlete') r.props.athleteId = 'synthetic-other'
    if (changed === 'client') r.props.client = newFixture.client
    if (changed === 'today') r.props.today = dates[0]
    if (changed === 'midnight') { r.props.currentDay = () => day; await r.render(); day = dates[0] }
    if (changed === 'OFF') r.props.enabled = false
    if (changed === 'readOnly') r.props.readOnly = true
    if (changed === 'unmount') await r.unmount(); else await r.render()
    const n = r.writes.length; assert.equal(await retained(), false); assert.equal(r.writes.length, n)
    if (changed !== 'today') assert.equal(marks(r.host).length, 0)
    if (changed === 'today') assert.ok(checked(r.host).every(v => v === false))
    g.resolve(); if (changed === 'client') await act(async () => { await tick() })
  })

test('loading, late response, errors, no selection and missing identity never expose or accept stale marks', async t => {
  const r = await mounted(t); await r.mark(0)
  const old = propsOf(marks(r.host)[0]).onClick, g = gate(); let blocked = false
  r.f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
  let pending; await act(async () => { pending = propsOf(button(shop(r.host), 'Hent indkøbsgrundlag igen')).onClick(); await tick() })
  assert.equal(marks(r.host).length, 0); assert.equal(await old(), false)
  await r.choose(dates[0], false); assert.ok(checked(r.host).every(v => !v))
  const content = r.host.textContent
  await act(async () => { g.resolve(); await pending; await tick() }); assert.equal(r.host.textContent, content)
  r.f.options.error = '42501'; await r.click('Hent indkøbsgrundlag igen'); assert.equal(marks(r.host).length, 0)
  assert.equal(button(shop(r.host), 'Kopiér indkøbsliste'), undefined)
  r.f.options.error = null
  await r.choose(dates[1], false); await r.choose(dates[2], false)
  assert.equal(marks(r.host).length, 0); assert.match(shop(r.host).textContent, /Vælg mindst én dag/)
  r.props.athleteId = ''; await r.render(); assert.equal(marks(r.host).length, 0)
})
