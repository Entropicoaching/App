// Actual imported ReactDOM/StrictMode, component and controller. Only transport,
// storage, clipboard and document are synthetic. No native layout/AT claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { preparationSuffix, shoppingItemText, formatApprovedShopping } from './approvedShoppingModel.mjs'
import { formatCompactShopping } from './compactShoppingText.mjs'
import { purchaseNamespace, purchaseScope } from './purchaseMarkers.mjs'
import { createPlanSnapshot } from '../planSnapshot.mjs'
import { FRIDA_FOODS } from '../foedevarer/frida55.mjs'
import { FOODS } from '../foedevarer/catalog.mjs'
import { historyFixture, uuid } from '../dailyReference.fixture.mjs'
import { today, dates, athleteId, tableNames, food, gate } from './approvedShopping.fixture.mjs'
import { all, propsOf, button, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const digest = text => createHash('sha256').update(text).digest('hex')
const marks = host => all(host, 'button').filter(n => n.getAttribute('role') === 'checkbox')
const list = host => all(host, 'ul').find(n => n.getAttribute('aria-label') === 'Samlet bruttobehov')
const key = `${purchaseNamespace}:${encodeURIComponent(athleteId)}`
const officialFoods = () => FRIDA_FOODS.slice(0, 26).concat(FRIDA_FOODS.at(-1))

function fixture(foods, { official = false, aliases = false } = {}) {
  const f = historyFixture(), parent = f.plan(96000, today, 'godkendt', athleteId)
  const portions = foods.map((food, i) => ({ grams: official ? (i === 0 ? .1 : i + .125) : (i === 5 ? 11 : 10), food }))
  if (official) portions.push({ grams: .2, food: foods[0] })
  if (aliases) for (let i = 0; i < 6; i++) portions.push({ grams: 1,
    food: { ...foods[0], name: 'Syntetisk dansk varenavn med fuld beskrivelse af den samme vare ' + i } })
  // Six named meals for the official golden; bounded chunks for the ordinary 200.
  const names = ['Morgenmad', 'Formiddag', 'Frokost', 'Før træning', 'Aftensmad', 'Aftenmåltid']
  let offset = 0
  const meals = official ? names.map((name, i) => {
    const count = i < 3 ? 5 : 4, selected = portions.slice(offset, offset + count); offset += count
    return { name, portions: selected }
  }) : Array.from({ length: Math.ceil(portions.length / 20) }, (_, i) => ({ name: 'Syntetisk måltid ' + i, portions: portions.slice(i * 20, i * 20 + 20) }))
  if (official) meals[0].portions.push(...portions.slice(27))
  const snapshot = createPlanSnapshot({ goal: 'vedligehold', intensity: .3, meals })
  const version = { id: uuid(96001), plan_id: parent.id, version_no: 1, effective_from: today, portion_guidance: null, ...snapshot }
  f.data[tableNames[1]].push(version); f.approve(96001, parent.id, today + 'T11:00:00Z', athleteId)
  return { f, version }
}

async function mount(t, data, seed) {
  const { f, version } = data, dom = hostFixture(), copies = [], writes = [], warnings = []
  const values = new Map([['other-app', 'unchanged'], ...(seed ? [[key, seed]] : [])])
  const storage = { getItem: k => values.get(k) ?? null, setItem(k, v) { writes.push([k, v]); values.set(k, v) } }
  const storageBoundary = () => storage
  dom.globals({ localStorage: storage })
  const originalError = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
  let root = createRoot(dom.host), alive = true, current = today
  const props = { enabled: true, athleteId, today, client: f.client, storage: storageBoundary,
    currentDay: () => current, clipboard: { writeText(text) { copies.push(text) } } }
  const c = createApprovedShopping({ enabled: true, athleteId, today, client: f.client, storage: () => null })
  const render = () => act(async () => { root.render(h(StrictMode, null, h(ApprovedPlanShopping, props))); await tick() })
  const invoke = n => act(async () => { assert.ok(n); await propsOf(n).onClick(); await tick() })
  const choose = (date, checked) => act(async () => {
    const n = all(dom.host, 'input').find(n => n.getAttribute('aria-label') === `Indkøb ${date}`)
    assert.ok(n); propsOf(n).onChange({ currentTarget: { checked } }); await tick()
  })
  const unmount = async () => { if (alive) { alive = false; await act(async () => { root.unmount(); await tick() }) } }
  t.after(async () => {
    try { await unmount(); c.dispose(); assert.deepEqual(warnings, []) }
    finally { console.error = originalError; dom.restore() }
  })
  await render(); assert.equal(await c.load(), true)
  return { ...dom, f, version, props, c, copies, writes, values, render, invoke, choose,
    midnight: () => { current = dates[0] }, unmount,
    reopen: async () => { await unmount(); root = createRoot(dom.host); alive = true; await render() } }
}

// Oracle starts with actual visible text, independently of the production label
// expression. Full source must stay inside an explicit, default-closed disclosure.
function contract(r) {
  const result = r.c.snapshot().result, controls = marks(r.host), rows = list(r.host)
  assert.equal(controls.length, result.items.length); assert.equal(rows.children.length, controls.length)
  const checkboxNames = [], summaryNames = []
  for (const [i, item] of result.items.entries()) {
    const row = rows.children[i], visible = all(row, 'span')[0].textContent
    const details = all(row, 'details')[0], summary = all(details, 'summary')[0], checkbox = controls[i]
    assert.equal(visible, `${item.names.join(' / ')}: ${String(item.grams).replace('.', ',')} g.${preparationSuffix(item.preparation)}`)
    const tail = `${visible} Vare ${i + 1} af ${controls.length}.`
    assert.equal(checkbox.getAttribute('aria-label'), 'Købt: ' + tail)
    assert.equal(summary.getAttribute('aria-label'), 'Kilde og varegrundlag: ' + tail)
    assert.equal(summary.textContent, 'Kilde og varegrundlag')
    assert.equal(details.getAttribute('open'), null)
    assert.equal(all(details, 'p')[0].textContent, shoppingItemText(item))
    assert.equal(all(summary, 'button, input, a, summary').length, 0)
    assert.equal(all(checkbox, 'details, summary, button, input').length, 0)
    assert.equal(details.contains(checkbox), false)
    for (const node of [checkbox, summary]) {
      assert.doesNotMatch(node.getAttribute('aria-label'), /ParameterID|SourceFood|doi\.org|Fødevare-id:|Kilde:|10000000-0000|abcdef0123456789/)
      assert.equal(node.getAttribute('aria-describedby'), null)
      assert.equal(node.getAttribute('title'), null)
      assert.equal(propsOf(node).style.minHeight, 44)
      assert.equal(propsOf(node).tabIndex, undefined); assert.equal(propsOf(node).onKeyDown, undefined)
      assert.equal(propsOf(node).style.outline, undefined)
      node.focus(); assert.equal(r.doc.activeElement, node)
    }
    assert.equal(propsOf(checkbox).style.minWidth, 44)
    assert.equal(checkbox.tagName, 'BUTTON'); assert.equal(summary.tagName, 'SUMMARY')
    checkboxNames.push(checkbox.getAttribute('aria-label')); summaryNames.push(summary.getAttribute('aria-label'))
  }
  assert.equal(new Set(checkboxNames).size, controls.length); assert.equal(new Set(summaryNames).size, controls.length)
  return checkboxNames
}

test('official 27 mounted foods on three/four days: short unique names, exact full evidence and both copy bytes, persistent marks', async t => {
  const data = fixture(officialFoods(), { official: true }), raw = JSON.stringify(data.f.data), r = await mount(t, data)
  for (const count of [3, 4]) {
    if (count === 4) { await r.choose(today, true); await r.c.choose([today, ...dates]) }
    const names = contract(r), gross = r.c.snapshot().result
    assert.equal(names.length, 27); assert.ok(names.every(n => n.length < 200))
    console.log(JSON.stringify({ accessibilityDays: count, items: names.length, minNameLength: Math.min(...names.map(n => n.length)), maxNameLength: Math.max(...names.map(n => n.length)) }))
    const full = formatApprovedShopping(gross), short = formatCompactShopping(gross)
    if (count === 3) assert.equal(digest(full), '31920f24d6188bfad05d736144034cf2f80ff1cd9086d09f2cf667eb432bc106')
    const evidence = gross.dates.map(date => ({ date, planId: r.version.plan_id, versionId: r.version.id,
      versionNumber: 1, effectiveFrom: today, meals: r.version.meals }))
    await r.invoke(marks(r.host)[26]); assert.equal(propsOf(marks(r.host)[26])['aria-checked'], true)
    const saved = r.values.get(key), writeCount = r.writes.length
    assert.equal(JSON.parse(saved).scope, purchaseScope({ athleteId, today, evidence, result: gross }))
    const details = all(list(r.host), 'details')[26]
    await act(async () => { details.setAttribute('open', ''); details.dispatch('toggle', { target: details }); await tick() })
    assert.equal(all(details, 'p')[0].textContent, shoppingItemText(gross.items[26]))
    assert.equal(r.writes.length, writeCount)
    for (const label of ['Kopiér indkøbsliste', 'Kopiér kort indkøbsliste']) await r.invoke(button(r.host, label))
    assert.deepEqual(r.copies.slice(-2), [full, short]); assert.equal(r.values.get(key), saved)
    await r.invoke(button(r.host, 'Hent indkøbsgrundlag igen'))
    assert.equal(propsOf(marks(r.host)[26])['aria-checked'], true)
    await r.reopen()
    if (count === 4) await r.choose(today, true)
    assert.equal(propsOf(marks(r.host)[26])['aria-checked'], true)
    assert.deepEqual(contract(r), names); assert.equal(r.writes.length, writeCount)
  }
  assert.equal(JSON.stringify(r.f.data), raw); assert.equal(r.f.writes().length, 0)
  assert.equal(r.values.get('other-app'), 'unchanged')
})

test('ordinary 200 actual catalogue foods retain whole visible labels and unique control names', async t => {
  const r = await mount(t, fixture(FOODS.slice(0, 200))), names = contract(r)
  assert.equal(names.length, 200); assert.equal(r.writes.length, 0); assert.equal(r.copies.length, 0)
  for (const label of ['Kopiér indkøbsliste', 'Kopiér kort indkøbsliste']) await r.invoke(button(r.host, label))
  assert.deepEqual(r.copies, [formatApprovedShopping(r.c.snapshot().result), formatCompactShopping(r.c.snapshot().result)])
  assert.equal(r.writes.length, 0); assert.equal(r.f.writes().length, 0)
})

test('same human labels with distinct references, source, verification, preparation and grams keep exact row identities', async t => {
  const a = food('identity-a', 'Røde linser æøå', 'kogte'), citation = 'Public evidence ' + 'abcdef0123456789'.repeat(36) + ' sluttet'
  const foods = [a, { ...a, id: 'identity-b' }, { ...a, source: { ...a.source, citation } },
    { ...a, source: { ...a.source, verification: 'Anden syntetisk verifikation' } },
    { ...a, preparation: 'rå' }, { ...a, id: 'different-grams' },
    food('alias-array', 'Linser / røde', 'kogte'), food('alias-string', 'Linser / røde / grønne', 'kogte')]
  const data = fixture(foods)
  const portions = structuredClone(data.version.meals[0].portions)
  // Different names on the same identity join to the same visible string as row 8.
  portions[7] = { ...portions[7], grams: 11 }
  const alias = { grams: 1, food: { ...foods[6], name: 'grønne' } }
  data.f.data[tableNames[1]][0] = { ...data.version, meals: [{ ...data.version.meals[0], portions: [...portions, alias] }] }
  const r = await mount(t, data), names = contract(r), result = r.c.snapshot().result
  assert.equal(result.items.length, 8)
  assert.equal(all(list(r.host).children[0], 'span')[0].textContent, all(list(r.host).children[1], 'span')[0].textContent)
  assert.equal(all(list(r.host).children[6], 'span')[0].textContent, all(list(r.host).children[7], 'span')[0].textContent)
  assert.notEqual(names[6], names[7])
  assert.notEqual(names[0], names[1]); assert.notEqual(names[0], names[2]); assert.notEqual(names[0], names[3])
  assert.ok(names[4].includes('Tilberedning: rå.')); assert.ok(names[5].includes('33 g.'))
  assert.equal(result.items[2].source.citation, citation)
  const keys = result.items.map(i => i.key), full = formatApprovedShopping(result), short = formatCompactShopping(result)
  for (let i = 0; i < 4; i++) await r.invoke(marks(r.host)[i])
  assert.deepEqual(marks(r.host).map(n => propsOf(n)['aria-checked']), [true, true, true, true, false, false, false, false])
  const saved = r.values.get(key); await r.reopen()
  assert.deepEqual(contract(r), names); assert.equal(r.values.get(key), saved); assert.equal(r.writes.length, 4)
  await r.invoke(button(r.host, 'Kopiér indkøbsliste')); await r.invoke(button(r.host, 'Kopiér kort indkøbsliste'))
  assert.deepEqual(r.copies, [full, short]); assert.deepEqual(r.c.snapshot().result.items.map(i => i.key), keys)
  assert.equal(r.f.writes().length, 0)
})

test('literal HTML, long Danish differences and 600-character citation stay whole without technical control names', async t => {
  const long = 'Danske ærter og røde linser med fuld varebeskrivelse '.repeat(6)
  const citation = 'K'.repeat(600)
  const r = await mount(t, fixture([food('long-a', long + 'A', 'kogte og afdryppede', citation),
    food('long-b', long + 'B', 'kogte og afdryppede', citation),
    food('html', '<script>aldrig()</script> & <b>Ærter</b>', 'rå <img src=x>', citation)]))
  const names = contract(r)
  assert.ok(names[0].includes(long + 'A')); assert.ok(names[1].includes(long + 'B'))
  assert.notEqual(names[0], names[1]); assert.equal(all(r.host, 'script, img, b').length, 0)
  for (const item of r.c.snapshot().result.items) assert.equal(item.source.citation, citation)
  assert.equal(r.writes.length, 0); assert.equal(r.f.writes().length, 0)
})

test('1228-character baseline mechanism: full official evidence with synthetic aliases is available only on explicit source choice', async t => {
  const longest = [...FRIDA_FOODS].sort((a, b) => b.source.citation.length + 2 * b.name.length - a.source.citation.length - 2 * a.name.length).slice(0, 27)
  const r = await mount(t, fixture(longest, { official: true, aliases: true })), result = r.c.snapshot().result
  const names = contract(r), canonical = shoppingItemText(result.items[0])
  assert.equal(('Købt: ' + canonical).length, 1228)
  assert.ok(names[0].length < canonical.length)
  for (const name of result.items[0].names) assert.ok(names[0].includes(name), 'no hard truncation of distinct visible foods')
  console.log(JSON.stringify({ aliasBaselineNameLength: 1228, finalNameLength: names[0].length }))
})

for (const change of ['athlete', 'client', 'day', 'midnight', 'OFF', 'readOnly', 'unmount'])
  test('mounted concise control retains late-read and stale purchase guards: ' + change, async t => {
    const r = await mount(t, fixture(officialFoods(), { official: true }))
    contract(r)
    const retained = propsOf(marks(r.host)[0]).onClick, g = gate(); let blocked = false, pending
    r.f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
    try {
      await act(async () => { pending = propsOf(button(r.host, 'Hent indkøbsgrundlag igen')).onClick(); await tick() })
      assert.equal(blocked, true); assert.equal(marks(r.host).length, 0)
      if (change === 'athlete') r.props.athleteId = 'synthetic-other'
      if (change === 'client') r.props.client = fixture(officialFoods(), { official: true }).f.client
      if (change === 'day') r.props.today = dates[0]
      if (change === 'midnight') r.midnight()
      if (change === 'OFF') r.props.enabled = false
      if (change === 'readOnly') r.props.readOnly = true
      if (change === 'unmount') await r.unmount(); else await r.render()
      const shown = r.host.textContent
      assert.equal(await retained(), false)
      await act(async () => { g.resolve(); assert.equal(await pending, false); await tick() })
      assert.equal(r.host.textContent, shown); assert.equal(r.writes.length, 0); assert.equal(r.copies.length, 0)
      assert.equal(r.f.writes().length, 0)
    } finally { await act(async () => { g.resolve(); await pending; await tick() }) }
  })

test('empty selection removes item controls and sources; initial OFF/readOnly does not access synthetic boundaries', async t => {
  const r = await mount(t, fixture(officialFoods(), { official: true }))
  for (const date of dates) await r.choose(date, false)
  assert.equal(marks(r.host).length, 0); assert.equal(list(r.host), undefined)
  assert.equal(all(r.host, 'details').length, 0)
  assert.match(r.host.textContent, /Vælg mindst én dag/)
  await r.unmount()
  for (const flags of [{ enabled: false }, { enabled: true, readOnly: true }]) {
    const dom = hostFixture(), root = createRoot(dom.host)
    const client = Object.defineProperty({}, 'from', { get() { assert.fail('inactive client read') } })
    try {
      await act(async () => { root.render(h(StrictMode, null, h(ApprovedPlanShopping, { ...flags, athleteId, today, client,
        storage: () => assert.fail('inactive storage read') }))); await tick() })
      assert.equal(dom.host.textContent, '')
    } finally { await act(async () => root.unmount()); dom.restore() }
  }
  assert.equal(r.writes.length, 0); assert.equal(r.f.writes().length, 0)
})
