import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import { fixture as dayFixture } from './daySession.fixture.mjs'
import { shoppingFixture, today, dates, athleteId, tableNames, gate } from './approvedShopping.fixture.mjs'
import { all, byKey, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const section = host => all(host, 'section').find(n => n.getAttribute('aria-label') === 'Indkøb fra kostplanen')
const list = host => all(section(host), 'ul').find(n => n.getAttribute('aria-label') === 'Samlet bruttobehov')
async function mounted(t, { route = false, ...extra } = {}) {
  const f = shoppingFixture(), day = dayFixture(), dom = hostFixture(), root = createRoot(dom.host), warnings = []
  for (const name of tableNames) day.plan.data[name] = f.data[name]
  let clipboard = [], alive = true
  dom.globals({ localStorage: day.storage, navigator: { clipboard: { writeText: text => { clipboard.push(text) } } } })
  const original = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
  const props = route ? { enabled: true, athlete: { id: athleteId }, date: today, client: day.client,
    foods: [{ id: 'synthetic-search', name: 'Syntetisk søgemad', kcal100: 20, protein100: 0, carb100: 0, fat100: 0 }],
    weightLogs: [], currentDay: () => today, ...extra }
    : { enabled: true, athleteId, today, client: f.client, clipboard: { writeText: text => { clipboard.push(text) } }, ...extra }
  const render = async () => act(async () => { root.render(h(StrictMode, null, h(route ? Entropi2Kost : ApprovedPlanShopping, props))); await tick() })
  const click = async text => {
    const n = button(section(dom.host), text); assert.ok(n, text)
    await act(async () => { await propsOf(n).onClick(); await tick() })
  }
  const choose = async (date, checked) => {
    const n = all(section(dom.host), 'input').find(n => n.getAttribute('aria-label') === `Indkøb ${date}`)
    assert.ok(n, date)
    await act(async () => { propsOf(n).onChange({ currentTarget: { checked } }); await tick() })
  }
  const unmount = async () => { if (alive) { alive = false; await act(async () => { root.unmount(); await tick() }) } }
  t.after(async () => { try { await unmount(); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  await render()
  return { ...dom, f, day, props, root, render, click, choose, unmount, warnings, clipboard }
}

test('mounted actual StrictMode athlete Kost: usable shopping, unchanged today tracker/drafts, indexed static NodeList, explicit copy', async t => {
  const r = await mounted(t, { route: true })
  const nodes = r.host.querySelectorAll('section')
  assert.equal(Object.prototype.toString.call(nodes), '[object NodeList]'); assert.equal(nodes.find, undefined)
  assert.equal(nodes.item(0), nodes[0]); const count = nodes.length
  const testNode = r.doc.createElement('section'); r.host.append(testNode)
  assert.equal(nodes.length, count, 'querySelectorAll result is static'); testNode.remove()
  assert.equal(list(r.host).children.length, 5); assert.match(list(r.host).textContent, /Linser: 450 g/)
  assert.equal(r.clipboard.length, 0, 'no clipboard work on mount/read')
  const checkboxes = all(section(r.host), 'input')
  assert.deepEqual(checkboxes.map(n => propsOf(n).checked), [false, true, true, true])
  const manualInput = byKey(r.host, 'field-Måltid'), searchInput = byKey(r.host, 'food-search')
  assert.ok(manualInput); assert.ok(searchInput)
  manualInput.value = 'Ugemt syntetisk kladde'; manualInput.dispatch('input', { target: manualInput })
  searchInput.value = 'Bevaret søgning'; searchInput.dispatch('input', { target: searchInput })
  await act(async () => { await tick() })
  // Imperative input handlers may redraw during setup. Measure DOM identity
  // after those handlers, then change only shopping state.
  const tracker = all(r.host, '[data-entropi2-kost]')[0]
  const manual = byKey(r.host, 'field-Måltid'), search = byKey(r.host, 'food-search')
  const writes = [...r.day.writes], bytes = [...r.day.values], logs = r.day.calls.length
  await r.choose(dates[1], false)
  assert.match(list(r.host).textContent, /Linser: 300 g/)
  assert.ok(all(r.host, '[data-entropi2-kost]')[0] === tracker, 'tracker identity')
  assert.ok(byKey(r.host, 'field-Måltid') === manual, 'manual identity'); assert.equal(manual.value, 'Ugemt syntetisk kladde')
  assert.equal(search.value, 'Bevaret søgning')
  assert.equal(tracker.parentElement.parentElement.getAttribute('hidden'), null)
  await r.click('Kopiér indkøbsliste')
  assert.equal(r.clipboard.length, 1); assert.match(section(r.host).textContent, /Kopieret\./)
  assert.match(r.clipboard[0], /2026-11-08/); assert.match(r.clipboard[0], /2026-11-10/)
  assert.doesNotMatch(r.clipboard[0], /2026-11-09/)
  await r.choose(dates[1], true); assert.doesNotMatch(section(r.host).textContent, /Kopieret\./)
  assert.deepEqual(r.day.writes, writes); assert.deepEqual([...r.day.values], bytes)
  assert.equal(r.day.calls.length, logs); assert.equal(r.day.rows.length, 0)
  assert.equal(r.day.plan.writes().length, 0)
})

test('real clipboard denial/unavailable: bounded readOnly selectable fallback, honest success/retry, failed refresh removes text/list', async t => {
  const r = await mounted(t, { clipboard: { writeText: async () => { throw Error('Synthetic browser denied') } } })
  await r.click('Kopiér indkøbsliste')
  assert.match(section(r.host).textContent, /Kopiering kunne ikke bekræftes/)
  assert.doesNotMatch(section(r.host).textContent, /Kopieret\./)
  let textarea = all(section(r.host), 'textarea')[0]
  assert.equal(propsOf(textarea).readOnly, true); assert.equal(propsOf(textarea).rows, 8)
  assert.ok(propsOf(textarea).value.length <= 200000); assert.match(propsOf(textarea).value, /Linser: 450 g/)
  let selected = 0; textarea.select = () => selected++
  propsOf(textarea).onFocus({ currentTarget: textarea }); assert.equal(selected, 1)
  r.props.clipboard = null; await r.render(); await r.click('Kopiér indkøbsliste')
  assert.ok(all(section(r.host), 'textarea')[0])
  r.f.options.error = '42501'; await r.click('Hent indkøbsgrundlag igen')
  assert.equal(list(r.host), undefined); assert.equal(all(section(r.host), 'textarea').length, 0)
  assert.equal(button(section(r.host), 'Kopiér indkøbsliste'), undefined)
  for (const date of dates) assert.match(section(r.host).textContent, new RegExp(date))
  r.f.options.error = null; await r.click('Hent indkøbsgrundlag igen')
  assert.match(list(r.host).textContent, /Linser: 450 g/)
})

test('pending clipboard and stale callbacks across date selection cannot acknowledge or copy new evidence', async t => {
  const g = gate(), copies = []
  const r = await mounted(t, { clipboard: { writeText: async text => { copies.push(text); await g.promise } } })
  const retained = propsOf(button(section(r.host), 'Kopiér indkøbsliste')).onClick
  let pending
  await act(async () => { pending = retained(); await tick() })
  assert.match(section(r.host).textContent, /Kopierer/)
  await r.choose(dates[1], false)
  assert.equal(propsOf(button(section(r.host), 'Kopiér indkøbsliste')).disabled, true)
  assert.equal(await retained(), false); assert.equal(copies.length, 1)
  await act(async () => { g.resolve(); assert.equal(await pending, false); await tick() })
  assert.doesNotMatch(section(r.host).textContent, /Kopieret\./)
  assert.equal(await retained(), false, 'old button is bound to the old immutable result')
  assert.equal(copies.length, 1)
  await r.click('Kopiér indkøbsliste'); assert.equal(copies.length, 2)
  assert.doesNotMatch(copies[1], /2026-11-09/)
})

for (const changed of ['athlete', 'today', 'client', 'readOnly', 'OFF', 'dispose'])
  test('actual StrictMode scope: ' + changed + ' retires late clipboard success and retained actions', async t => {
    const g = gate(), copies = [], r = await mounted(t, { clipboard: { writeText: async text => { copies.push(text); await g.promise } } })
    const retained = propsOf(button(section(r.host), 'Kopiér indkøbsliste')).onClick
    const retry = propsOf(button(section(r.host), 'Hent indkøbsgrundlag igen')).onClick
    let pending; await act(async () => { pending = retained(); await tick() })
    if (changed === 'athlete') r.props.athleteId = 'synthetic-second-athlete'
    if (changed === 'today') r.props.today = dates[0]
    if (changed === 'client') r.props.client = shoppingFixture().client
    if (changed === 'readOnly') r.props.readOnly = true
    if (changed === 'OFF') r.props.enabled = false
    if (changed === 'dispose') await r.unmount(); else await r.render()
    const oldCount = r.f.calls.length
    assert.equal(await retained(), false); assert.equal(await retry(), false)
    await act(async () => { g.resolve(); assert.equal(await pending, false); await tick() })
    assert.doesNotMatch(r.host.textContent, /Kopieret\./); assert.equal(copies.length, 1)
    assert.equal(r.f.calls.length, oldCount)
    if (['readOnly', 'OFF', 'dispose'].includes(changed)) assert.equal(r.host.textContent, '')
    if (changed === 'athlete') assert.equal(list(r.host), undefined)
  })

test('late version response after owner/client/day switch and overlapping date reads never publishes old list', async t => {
  const r = await mounted(t), g = gate(); let blocked = false
  r.f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
  let pending
  await act(async () => { pending = propsOf(button(section(r.host), 'Hent indkøbsgrundlag igen')).onClick(); await tick() })
  assert.equal(blocked, true); assert.equal(list(r.host), undefined)
  await r.choose(dates[0], false)
  assert.match(list(r.host).textContent, /Linser: 375 g/)
  await act(async () => { g.resolve(); await pending; await tick() })
  assert.match(list(r.host).textContent, /Linser: 375 g/)
  r.props.athleteId = 'synthetic-second'; await r.render()
  assert.equal(list(r.host), undefined); assert.match(section(r.host).textContent, /Ingen godkendt plan/)
})

test('today included explicitly, all deselected, invalid dates, current day revocation and OFF do no writes', async t => {
  let day = today
  const r = await mounted(t, { currentDay: () => day })
  await r.choose(today, true)
  assert.equal(list(r.host), undefined); assert.match(section(r.host).textContent, /2026-11-07: Ingen godkendt plan/)
  await r.choose(today, false)
  for (const d of dates) await r.choose(d, false)
  assert.match(section(r.host).textContent, /Vælg mindst én dag/); assert.equal(list(r.host), undefined)
  const count = r.f.calls.length
  assert.equal(all(section(r.host), 'input').length, 4)
  await r.choose(dates[0], true)
  const retained = propsOf(button(section(r.host), 'Kopiér indkøbsliste')).onClick
  day = dates[0]; assert.equal(await retained(), false); await r.render()
  assert.equal(list(r.host), undefined); assert.equal(button(section(r.host), 'Kopiér indkøbsliste'), undefined)
  assert.ok(r.f.calls.length > count); assert.equal(r.f.writes().length, 0); assert.equal(r.clipboard.length, 0)
})

for (const changed of ['athleteId', 'client', 'today'])
  test('pending actual version read is retired on ' + changed + ' remount', async t => {
    const r = await mounted(t), g = gate(); let blocked = false
    r.f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
    let pending
    await act(async () => { pending = propsOf(button(section(r.host), 'Hent indkøbsgrundlag igen')).onClick(); await tick() })
    assert.ok(blocked)
    r.props[changed] = changed === 'athleteId' ? 'synthetic-replacement' : changed === 'client' ? shoppingFixture().client : dates[0]
    await r.render(); const confirmed = r.host.textContent
    await act(async () => { g.resolve(); assert.equal(await pending, false); await tick() })
    assert.equal(r.host.textContent, confirmed)
    assert.equal(r.f.writes().length, 0)
  })

for (const kind of ['missing-plan', 'capability'])
  test('actual ' + kind + ' state names dates, offers no partial list, and explicit retry recovers', async t => {
    const r = await mounted(t)
    const saved = structuredClone(r.f.data[tableNames[1]])
    if (kind === 'missing-plan') r.f.data[tableNames[1]].splice(0, 1)
    else r.f.options.missing = tableNames[1]
    await r.click('Hent indkøbsgrundlag igen')
    assert.equal(list(r.host), undefined); assert.equal(button(section(r.host), 'Kopiér indkøbsliste'), undefined)
    assert.match(section(r.host).textContent, /2026-11-08/)
    assert.match(section(r.host).textContent, kind === 'capability' ? /tabeller er ikke tilgængelige/ : /Ingen godkendt plan/)
    r.f.data[tableNames[1]] = saved; r.f.options.missing = false
    await r.click('Hent indkøbsgrundlag igen'); assert.match(list(r.host).textContent, /Linser: 450 g/)
  })
