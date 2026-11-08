import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import WaterDayLog from './WaterDayLog.mjs'
import { createWaterDayLog, waterDayKey, waterLimits, waterQuantity } from './waterDayLogModel.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, byKey, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const key = waterDayKey(athleteId, date)
const water = host => all(host, 'details').find(n => all(n, 'summary')[0]?.textContent === 'Væske i dag')
const entry = (ml = 250, id = 1) => ({ id, ml, at: date + 'T11:00:00.000Z' })
const raw = (entries = [entry()], extra = {}) => JSON.stringify({ schema: 'entropi2-water-day/v1', athleteId, date, entries, ...extra })
const clock = t => t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00+01:00') })
async function mount(t, { route = true, setup, storage } = {}) {
  clock(t)
  const f = fixture(); f.approve(); setup?.(f)
  const dom = hostFixture(), root = createRoot(dom.host), warnings = [], reads = []
  const device = storage || { getItem(k) { reads.push(k); return f.storage.getItem(k) }, setItem: f.storage.setItem }
  dom.globals({ localStorage: device })
  const original = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
  const props = route ? { enabled: true, athlete: { id: athleteId }, date, client: f.client,
    foods: [{ id: 'synthetic-water-food', name: 'Syntetisk mad', kcal100: 100, protein100: 1, carb100: 2, fat100: 3 }],
    weightLogs: [], weightInput: '', onWeightInput() {}, logWeight() {}, currentDay: () => date }
    : { enabled: true, athleteId, date, client: f.client, currentDay: () => date }
  const Component = route ? Entropi2Kost : WaterDayLog
  let alive = true
  const render = () => act(async () => { root.render(h(StrictMode, null, h(Component, props))); await tick() })
  const unmount = () => act(async () => { if (alive) { alive = false; root.unmount(); await tick() } })
  const click = label => act(async () => {
    const n = button(water(dom.host), label); assert.ok(n, label)
    propsOf(n).onClick(); await tick()
  })
  const quantity = value => act(async () => {
    const n = all(water(dom.host), 'input')[0]; assert.ok(n)
    propsOf(n).onChange({ currentTarget: { value } }); await tick()
  })
  const choose = day => act(async () => {
    const n = all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
    propsOf(n).onChange({ currentTarget: { value: day } }); await tick()
  })
  t.after(async () => { try { await unmount(); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  await render()
  return { ...dom, f, props, reads, render, unmount, click, quantity, choose }
}

// The normal mounted route uses the original session, contracts, storage and
// imperative tracker. Only its external tables and DOM host are synthetic.
test('normal StrictMode Kost: collapsed water, explicit portions/add/remove, exact storage and reload without writes', async t => {
  const r = await mount(t), foreign = [...r.f.values], calls = r.f.calls.length
  const fold = water(r.host); assert.ok(fold); assert.equal(propsOf(fold).open, undefined)
  assert.match(fold.textContent, /Intet vand registreret/)
  assert.match(fold.textContent, /Deles ikke med din coach/)
  assert.doesNotMatch(fold.textContent, /kcal|elektrolyt|behov|mål på|liter/i)
  assert.equal(r.f.writes.length, 0)
  await r.click('250 ml portion'); assert.equal(r.f.writes.length, 0)
  assert.equal(propsOf(all(water(r.host), 'input')[0]).value, '250')
  await r.click('Tilføj drukket vand'); assert.equal(r.f.writes.length, 1)
  await r.click('500 ml portion'); assert.equal(r.f.writes.length, 1)
  await r.click('Tilføj drukket vand')
  assert.match(water(r.host).textContent, /750 ml/)
  assert.match(water(r.host).textContent, /250 ml · 12.00|250 ml · 12:00/)
  assert.match(water(r.host).textContent, /Gemt på denne enhed/)
  assert.deepEqual(r.f.writes, [key, key]); assert.equal(r.f.calls.length, calls)
  const saved = JSON.parse(r.f.values.get(key)); assert.deepEqual(saved.entries.map(e => e.ml), [250, 500])
  assert.equal(r.f.rows.length, 0); assert.equal(r.f.plan.writes().length, 0)
  for (const [k, v] of foreign) assert.equal(r.f.values.get(k), v)
  for (const n of [...all(water(r.host), 'button'), ...all(water(r.host), 'input'), ...all(water(r.host), 'summary')]) {
    assert.ok(propsOf(n).style.minHeight >= 44); assert.ok(propsOf(n).style.minWidth >= 44)
    assert.ok(n.getAttribute('aria-label') || n.textContent)
  }
  const count = r.f.writes.length, bytes = r.f.values.get(key)
  await r.choose('2026-11-06'); assert.equal(water(r.host), undefined)
  await r.choose(date)
  assert.equal(r.f.values.get(key), bytes); assert.equal(r.f.writes.length, count)
  assert.match(water(r.host).textContent, /750 ml/)
  r.props.enabled = false; await r.render()
  r.props.enabled = true; await r.render()
  assert.match(water(r.host).textContent, /750 ml/)
  assert.equal(r.f.values.get(key), bytes); assert.equal(r.f.writes.length, count)
  await r.click('Fjern registrering')
  assert.deepEqual(JSON.parse(r.f.values.get(key)).entries.map(e => e.ml), [500])
  await r.click('Fjern registrering')
  assert.match(water(r.host).textContent, /Intet vand registreret/)
  assert.deepEqual(JSON.parse(r.f.values.get(key)).entries, [])
})

test('normal route: actual typed food/search/weight/template drafts and purchase bytes survive future, water actions and return', async t => {
  const r = await mount(t, { setup: f => f.rows.push({ id: 'synthetic-water-existing', athlete_id: athleteId, date, meal: 'Vand-test måltid', kcal: 20, protein: 1, carb: 2, fat: 0 }) })
  const template = button(r.host, 'Gem som skabelon: Vand-test måltid'); assert.ok(template)
  await act(async () => { template.click(); await tick() })
  await act(async () => { button(r.host, 'Tilføj ingrediens').click(); await tick() })
  const values = { 'field-Måltid': 'Bevaret måltid', 'food-search': 'Bevaret søgning', 'field-Vægt (kg)': '81,2', 'template-ingredients-0-0-name': 'Bevaret ingrediens' }
  for (const [focus, value] of Object.entries(values)) {
    const n = byKey(r.host, focus); assert.ok(n, focus); n.value = value; n.dispatch('input', { target: n })
  }
  const purchased = all(r.host, 'button').find(n => n.getAttribute('aria-label')?.startsWith('Købt:'))
  assert.ok(purchased, 'actual shopping purchase control')
  await act(async () => { propsOf(purchased).onClick(); await tick() })
  const bytes = [...r.f.values], ids = Object.fromEntries(Object.keys(values).map(k => [k, byKey(r.host, k)]))
  await r.quantity('375'); await r.click('Tilføj drukket vand')
  await r.choose('2026-11-07'); await r.choose(date)
  for (const [focus, value] of Object.entries(values)) { assert.strictEqual(byKey(r.host, focus), ids[focus]); assert.equal(ids[focus].value, value) }
  for (const [k, v] of bytes) assert.equal(r.f.values.get(k), v)
  assert.match(water(r.host).textContent, /375 ml/)
})

for (const changed of ['future', 'athlete', 'date', 'client', 'OFF', 'unmount', 'midnight', 'currentDay']) {
  test('normal route: retained add/remove become inert after ' + changed, async t => {
    const r = await mount(t)
    await r.quantity('250'); await r.click('Tilføj drukket vand'); await r.quantity('500')
    const add = propsOf(button(water(r.host), 'Tilføj drukket vand')).onClick
    const remove = propsOf(button(water(r.host), 'Fjern registrering')).onClick
    if (changed === 'future') await r.choose('2026-11-06')
    if (changed === 'athlete') r.props.athlete = { id: 'synthetic-water-other' }
    if (changed === 'date') r.props.date = '2026-11-06'
    if (changed === 'client') r.props.client = fixture().client
    if (changed === 'OFF') r.props.enabled = false
    if (changed === 'unmount') await r.unmount()
    if (changed === 'midnight') t.mock.timers.setTime(new Date('2026-11-05T23:00:00.000Z').getTime())
    if (changed === 'currentDay') r.props.currentDay = () => '2026-11-06'
    if (!['future', 'unmount', 'midnight'].includes(changed)) await r.render()
    const bytes = [...r.f.values], writes = r.f.writes.length, calls = r.f.calls.length
    await act(async () => { add(); remove(); await tick() })
    assert.deepEqual([...r.f.values], bytes); assert.equal(r.f.writes.length, writes); assert.equal(r.f.calls.length, calls)
    if (changed === 'future') {
      assert.equal(water(r.host), undefined)
      await r.choose(date)
      await act(async () => { add(); remove(); await tick() })
      assert.equal(r.f.writes.length, writes); assert.match(water(r.host).textContent, /250 ml/)
    }
  })
}

for (const mode of ['denied-read', 'quota', 'silent-drop', 'readback-replaced', 'concurrent-replaced']) {
  test('mounted storage: honest ' + mode + ', no foreign reads or automatic repair', async t => {
    const values = new Map([['foreign-old-water', 'untouched']]), reads = [], writes = []
    let didSet = false
    const storage = {
      getItem(k) {
        reads.push(k); assert.equal(k, key)
        if (mode === 'denied-read') throw Error('synthetic denied')
        if (mode === 'readback-replaced' && didSet) return raw([entry(900)])
        return values.get(k) ?? null
      },
      setItem(k, v) {
        assert.equal(k, key); writes.push(k); didSet = true
        if (mode === 'quota') throw Error('synthetic quota')
        if (mode !== 'silent-drop') values.set(k, v)
      },
    }
    const r = await mount(t, { route: false, storage })
    assert.equal(writes.length, 0)
    if (mode === 'concurrent-replaced') values.set(key, raw([entry(700)]))
    await r.quantity('250'); await r.click('Tilføj drukket vand')
    assert.match(water(r.host).textContent, /250 ml/)
    assert.match(water(r.host).textContent, /kunne ikke bekræftes/)
    assert.doesNotMatch(water(r.host).textContent, /Gemt på denne enhed/)
    assert.equal(values.get('foreign-old-water'), 'untouched')
    const count = writes.length
    await r.quantity('500'); await r.click('Tilføj drukket vand')
    assert.equal(writes.length, count, 'failed confirmation stops further writes in this view')
    assert.ok(reads.length >= 2, 'StrictMode read/reopen is read only')
  })
}

test('schema and bounds: actual model rejects malformed records/quantities without cleanup or foreign reads', t => {
  clock(t)
  const bad = ['{', 'x'.repeat(waterLimits.text + 1), 'null', raw([], { athleteId: 'other' }), raw([], { date: '2026-11-06' }), raw([], { extra: 'x' }),
    raw([entry(0)]), raw([entry(1.5)]), raw([entry(Infinity)]), raw([entry(10001)]), raw([{ ...entry(), ml: '250' }]),
    raw([entry(), entry()]), raw([{ ...entry(), at: '2026-11-06T11:00:00.000Z' }]), raw(Array.from({ length: 101 }, (_, i) => entry(1, i + 1)))]
  for (const bytes of bad) {
    const writes = [], reads = [], device = { getItem(k) { reads.push(k); return bytes }, setItem(...args) { writes.push(args) } }
    const c = createWaterDayLog({ enabled: true, athleteId, date, storage: device })
    assert.equal(c.snapshot().status, 'unreadable'); assert.equal(c.add('250'), true)
    assert.equal(c.snapshot().status, 'unconfirmed'); assert.deepEqual(writes, []); assert.deepEqual(reads, [key]); c.dispose()
  }
  for (const value of ['', ' ', '0', '-1', '1.2', '1,2', '1e3', 'Infinity', NaN, Infinity, '10001', {}, true]) assert.equal(waterQuantity(value), null)
  const values = new Map(), writes = []
  const storage = { getItem: k => values.get(k) ?? null, setItem(k, v) { values.set(k, v); writes.push(k) } }
  const c = createWaterDayLog({ enabled: true, athleteId, date, storage })
  for (let i = 0; i < 100; i++) assert.equal(c.add('1'), true)
  assert.equal(c.add('1'), false); assert.equal(writes.length, 100); assert.equal(c.snapshot().totalMl, 100)
  assert.ok(values.get(key).length <= waterLimits.text)
  const loaded = createWaterDayLog({ enabled: true, athleteId, date, storage })
  assert.equal(loaded.snapshot().entries.length, 100); assert.equal(writes.length, 100)
  c.dispose(); loaded.dispose()
})

test('actual model: exact actor/day namespace; OFF, invalid dates and midnight cannot even read; stale owner and disposed never write', t => {
  clock(t)
  const reads = [], writes = [], values = new Map()
  const storage = { getItem(k) { reads.push(k); return values.get(k) ?? null }, setItem(k, v) { writes.push(k); values.set(k, v) } }
  for (const extra of [{ enabled: false }, { athleteId: '' }, { athleteId: '\ud800' }, { athleteId: 'x'.repeat(129) }, { date: '2026-02-30' }, { date: '2026-11-06' }, { currentDay: () => '2026-11-06' }, { currentDay: () => { throw Error('clock') } }]) {
    assert.equal(createWaterDayLog({ enabled: true, athleteId, date, storage, ...extra }), null)
  }
  assert.deepEqual(reads, [])
  assert.notEqual(waterDayKey('actor:a', date), waterDayKey('actor%3Aa', date))
  let active = true
  const c = createWaterDayLog({ enabled: true, athleteId, date, storage, isCurrent: () => active })
  assert.equal(c.add('250'), true); active = false
  assert.equal(c.add('500'), false); assert.equal(c.remove(1), false); active = true
  c.dispose(); assert.equal(c.add('250'), false); assert.equal(c.remove(1), false)
  const d = createWaterDayLog({ enabled: true, athleteId, date, storage, currentDay: () => date })
  t.mock.timers.setTime(new Date('2026-11-05T23:00:00.000Z').getTime())
  assert.equal(d.add('1'), false); assert.equal(d.remove(1), false); d.dispose()
  assert.deepEqual(writes, [key])
})

test('SSR is storage-free, OFF absent; opening/reopening valid record performs no writes or plan inference', async t => {
  const r = await mount(t, { route: false, setup: f => f.values.set(key, raw()) })
  assert.match(water(r.host).textContent, /250 ml/); assert.equal(r.f.writes.length, 0)
  const bytes = r.f.values.get(key)
  await r.render(); assert.equal(r.f.writes.length, 0); assert.equal(r.f.values.get(key), bytes)
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('SSR must not read') } })
  try {
    assert.equal(renderToStaticMarkup(h(WaterDayLog, { enabled: false, athleteId, date })), '')
    assert.match(renderToStaticMarkup(h(WaterDayLog, { enabled: true, athleteId, date })), /Væske i dag/)
  } finally { Object.defineProperty(globalThis, 'localStorage', original) }
})


test('normal route: selecting preview retires retained writes synchronously before the React commit', async t => {
  const r = await mount(t)
  await r.quantity('250'); await r.click('Tilføj drukket vand'); await r.quantity('500')
  const add = propsOf(button(water(r.host), 'Tilføj drukket vand')).onClick
  const remove = propsOf(button(water(r.host), 'Fjern registrering')).onClick
  const select = all(r.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
  const bytes = [...r.f.values], writes = r.f.writes.length
  await act(async () => {
    propsOf(select).onChange({ currentTarget: { value: '2026-11-06' } })
    add(); remove(); await tick()
  })
  assert.deepEqual([...r.f.values], bytes); assert.equal(r.f.writes.length, writes)
  assert.equal(water(r.host), undefined)
})

test('portable public paths: exact water names have distinct casefold identities and real ESM exports', async () => {
  const root = new URL('../../../../', import.meta.url)
  const paths = []
  async function walk(url, prefix) {
    for (const entry of await readdir(url, { withFileTypes: true })) {
      const path = prefix + entry.name
      if (entry.isDirectory()) await walk(new URL(entry.name + '/', url), path + '/')
      else { assert.ok(entry.isFile(), path); paths.push(path) }
    }
  }
  // All directories in the pinned public source, including this feature.
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'node_modules') await walk(new URL(entry.name + '/', root), entry.name + '/')
    else if (entry.isFile()) paths.push(entry.name)
  }
  const folded = new Map()
  for (const path of paths) {
    assert.ok(!folded.has(path.toLowerCase()), `${folded.get(path.toLowerCase())} aliases ${path}`)
    folded.set(path.toLowerCase(), path)
  }
  const prefix = 'src/entropi2/kostplan/atlet/'
  for (const name of ['KostDayFrame.mjs', 'WaterDayLog.mjs', 'waterDayLogModel.mjs', 'waterDayLog.react.test.mjs']) {
    assert.ok(paths.includes(prefix + name), name)
  }
  assert.equal(paths.includes(prefix + 'waterDayLog.mjs'), false)
  const component = await import('./WaterDayLog.mjs'), model = await import('./waterDayLogModel.mjs')
  assert.equal(typeof component.default, 'function')
  assert.equal(typeof model.createWaterDayLog, 'function')
  assert.equal(typeof model.waterDayKey, 'function')
  assert.equal('default' in model, false)
  assert.equal('createWaterDayLog' in component, false)
  const source = await readFile(fileURLToPath(new URL('./WaterDayLog.mjs', import.meta.url)), 'utf8')
  assert.match(source, /from '\.\/waterDayLogModel\.mjs'/)
})

test('normal route: reselecting today preserves the water draft and usable explicit actions', async t => {
  const r = await mount(t)
  await r.quantity('379')
  await r.choose(date)
  assert.equal(propsOf(all(water(r.host), 'input')[0]).value, '379')
  assert.equal(r.f.writes.length, 0)
  await r.click('Tilføj drukket vand')
  assert.equal(r.f.writes.length, 1)
  assert.match(water(r.host).textContent, /379 ml/)
})

test('actor validation keeps all original control-character bounds without a control regex', () => {
  for (let code = 0; code < 32; code++) assert.equal(waterDayKey('a' + String.fromCharCode(code) + 'b', date), null)
  assert.equal(waterDayKey('a' + String.fromCharCode(127) + 'b', date), null)
  for (const actor of ['a b', 'a:b', 'a%b', 'æble', 'a😀b']) assert.ok(waterDayKey(actor, date))
})
