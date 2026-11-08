import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { createWaterDayLog, waterDayKey, waterLimits } from './waterDayLogModel.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { all, button, propsOf, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const key = waterDayKey(athleteId, date)
const entry = (id = 19, ml = 250, hour = '08') => ({ id, ml, at: `${date}T${hour}:00:00.000Z` })
const raw = entries => JSON.stringify({ schema: 'entropi2-water-day/v1', athleteId, date, entries })
const water = host => all(host, 'details').find(n => all(n, 'summary')[0]?.textContent === 'Væske i dag')
const row = (host, id) => all(water(host), 'li').find(n => all(n, 'button').some(b => b.getAttribute('aria-label')?.startsWith(`Ret mængde for vandregistrering ${id}:`)))
const editInput = host => all(water(host), 'input').find(n => n.getAttribute('aria-label')?.startsWith('Ret vandmængde'))
const addInput = host => all(water(host), 'input').find(n => n.getAttribute('aria-label') === 'Drukket vand i milliliter')

async function mount(t, { entries = [entry()], configure } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00Z') })
  const f = fixture(); f.approve(); f.values.set(key, raw(entries))
  f.values.set('synthetic-foreign-water', 'original foreign bytes')
  const device = configure?.(f) || f.storage
  const dom = hostFixture(), root = createRoot(dom.host), warnings = []
  dom.globals({ localStorage: device })
  const original = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
  let today = date, alive = true
  const props = { enabled: true, athlete: { id: athleteId }, date, client: f.client, foods: [],
    weightLogs: [], weightInput: '', onWeightInput() {}, logWeight() {}, currentDay: () => today }
  const render = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); await tick() })
  const unmount = () => act(async () => { if (alive) { alive = false; root.unmount(); await tick() } })
  const invoke = callback => act(async () => { callback(); await tick() })
  const click = (label, host = water(dom.host)) => {
    const node = button(host, label); assert.ok(node, label)
    return invoke(propsOf(node).onClick)
  }
  const type = (value, node = editInput(dom.host)) => {
    assert.ok(node, 'labelled input')
    return invoke(() => propsOf(node).onChange({ currentTarget: { value } }))
  }
  const select = () => all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
  const choose = day => invoke(() => propsOf(select()).onChange({ currentTarget: { value: day } }))
  t.after(async () => { try { await unmount(); assert.deepEqual(warnings, []) } finally { console.error = original; dom.restore() } })
  await render()
  return { ...dom, f, props, render, unmount, invoke, click, type, select, choose, setToday(value) { today = value } }
}

test('normal Entropi2Kost/StrictMode: explicit edit changes only chosen ml; original id/time/order, total, add draft and reload', async t => {
  const entries = [entry(19), entry(4, 500, '09'), entry(81, 750, '10')], r = await mount(t, { entries })
  const calls = r.f.calls.length, foreign = [...r.f.values].filter(([k]) => k !== key)
  assert.equal(propsOf(water(r.host)).open, undefined, 'legacy uncontrolled disclosure')
  await r.type('417', addInput(r.host))
  await r.click('Ret mængde', row(r.host, 19))
  assert.equal(propsOf(editInput(r.host)).value, '250')
  assert.equal(r.f.writes.length, 0)
  await r.type('300'); assert.equal(r.f.writes.length, 0)
  for (const n of [...all(water(r.host), 'button'), ...all(water(r.host), 'input')]) {
    assert.ok(propsOf(n).style.minHeight >= 44); assert.ok(propsOf(n).style.minWidth >= 44)
  }
  await r.click('Gem rettelse')
  const expected = raw([{ ...entries[0], ml: 300 }, ...entries.slice(1)])
  assert.equal(r.f.values.get(key), expected); assert.deepEqual(r.f.writes, [key])
  assert.equal(editInput(r.host), undefined); assert.equal(propsOf(addInput(r.host)).value, '417')
  assert.match(water(r.host).textContent, /1550 ml/)
  assert.match(row(r.host, 19).textContent, /300 ml · 09[.:]00/)
  assert.match(water(r.host).textContent, /Gemt på denne enhed\. Deles ikke med din coach/)
  assert.equal(r.f.calls.length, calls); assert.equal(r.f.rows.length, 0); assert.equal(r.f.plan.writes().length, 0)
  for (const [k, v] of foreign) assert.equal(r.f.values.get(k), v)
  r.props.enabled = false; await r.render(); r.props.enabled = true; await r.render()
  assert.equal(r.f.values.get(key), expected); assert.equal(r.f.writes.length, 1)
  assert.match(water(r.host).textContent, /1550 ml/)
  await r.click('Ret mængde', row(r.host, 4)); await r.type('1'); await r.click('Gem rettelse')
  assert.deepEqual(JSON.parse(r.f.values.get(key)).entries, [{ ...entries[0], ml: 300 }, { ...entries[1], ml: 1 }, entries[2]])
})

test('labelled current draft, invalid integers, cancel and retained canceled save never write', async t => {
  const r = await mount(t), bytes = r.f.values.get(key)
  await r.click('Ret mængde')
  for (const value of ['', ' ', '0', '-1', '1.5', '1,5', '1e3', 'NaN', '10001']) {
    await r.type(value)
    const save = button(water(r.host), 'Gem rettelse')
    assert.equal(propsOf(save).disabled, true, value)
    await r.invoke(propsOf(save).onClick)
    assert.equal(r.f.values.get(key), bytes); assert.equal(r.f.writes.length, 0)
    assert.match(water(r.host).textContent, /Angiv hele ml fra 1 til 10000/)
  }
  await r.type('10000')
  assert.equal(propsOf(button(water(r.host), 'Gem rettelse')).disabled, false)
  const oldSave = propsOf(button(water(r.host), 'Gem rettelse')).onClick
  await r.click('Annuller'); await r.invoke(oldSave)
  assert.equal(editInput(r.host), undefined); assert.equal(r.f.values.get(key), bytes); assert.equal(r.f.writes.length, 0)
  await r.click('Ret mængde'); assert.equal(propsOf(editInput(r.host)).value, '250')
  await r.type('10000'); await r.click('Gem rettelse')
  assert.equal(JSON.parse(r.f.values.get(key)).entries[0].ml, 10000)
})

test('actual pending draft survives unrelated render, today reselect, add and removal of another entry', async t => {
  const r = await mount(t, { entries: [entry(), entry(2, 500)] })
  await r.click('Ret mængde', row(r.host, 19)); await r.type('379')
  r.props.weightInput = '81,2'; await r.render(); await r.choose(date)
  assert.equal(propsOf(editInput(r.host)).value, '379'); assert.equal(r.f.writes.length, 0)
  await r.type('417', addInput(r.host)); await r.click('Tilføj drukket vand')
  assert.equal(propsOf(editInput(r.host)).value, '379')
  await r.click('Fjern registrering', row(r.host, 2))
  assert.equal(propsOf(editInput(r.host)).value, '379')
  await r.click('Gem rettelse')
  assert.deepEqual(JSON.parse(r.f.values.get(key)).entries.map(e => [e.id, e.ml]), [[19, 379], [20, 417]])
})

test('switching edited entry or removing it retires its captured open/change/save without recreation', async t => {
  const r = await mount(t, { entries: [entry(), entry(2, 500)] })
  const oldOpen = propsOf(button(row(r.host, 19), 'Ret mængde')).onClick
  await r.click('Ret mængde', row(r.host, 19)); await r.type('300')
  const oldSave = propsOf(button(water(r.host), 'Gem rettelse')).onClick
  const oldChange = propsOf(editInput(r.host)).onChange
  await r.click('Ret mængde', row(r.host, 2))
  await r.invoke(() => { oldSave(); oldChange({ currentTarget: { value: '999' } }) })
  assert.equal(propsOf(editInput(r.host)).value, '500'); assert.equal(r.f.writes.length, 0)
  await r.click('Ret mængde', row(r.host, 19)); await r.type('301')
  const removedSave = propsOf(button(water(r.host), 'Gem rettelse')).onClick
  await r.click('Fjern registrering', row(r.host, 19))
  await r.invoke(() => { removedSave(); oldSave(); oldOpen() })
  assert.deepEqual(JSON.parse(r.f.values.get(key)).entries, [entry(2, 500)])
  assert.equal(r.f.writes.length, 1); assert.equal(editInput(r.host), undefined)
})

for (const mode of ['changed', 'removed', 'corrupt', 'same-data-new-bytes']) {
  test('concurrent store ' + mode + ': draft survives rerender; save reports stale and leaves replacement exact', async t => {
    const r = await mount(t)
    await r.click('Ret mængde'); await r.type('275'); await r.click('Gem rettelse')
    assert.match(water(r.host).textContent, /Gemt på denne enhed/)
    await r.click('Ret mængde'); await r.type('300')
    const replacement = mode === 'changed' ? raw([entry(19, 700)]) : mode === 'removed' ? raw([])
      : mode === 'corrupt' ? '{bad synthetic' : JSON.stringify(JSON.parse(r.f.values.get(key)), null, 2)
    r.f.values.set(key, replacement)
    r.props.weightInput = '82'; await r.render()
    assert.equal(propsOf(editInput(r.host)).value, '300')
    await r.click('Gem rettelse')
    assert.equal(r.f.values.get(key), replacement); assert.equal(r.f.writes.length, 1)
    assert.match(water(r.host).textContent, /ændret eller fjernet/)
    assert.match(water(r.host).textContent, /Rettelsen er ikke gemt/)
    assert.doesNotMatch(water(r.host).textContent, /Gemt på denne enhed/)
    await r.click('Gem rettelse'); assert.equal(r.f.writes.length, 1)
  })
}

for (const mode of ['quota', 'silent-drop', 'readback-replaced', 'read-fails']) {
  test('actual edit storage ' + mode + ': retains correction through repeated failure, explicit recovery and reload', async t => {
    let failing = false, didSet = false, attempts = 0
    const entries = [entry(19), entry(2, 500)]
    entries[0].at = date + 'T08:01:02.345Z'; entries[1].at = date + 'T09:04:05.678Z'
    const r = await mount(t, { entries, configure: f => ({
      getItem(k) {
        if (k === key && failing && mode === 'read-fails') throw Error('synthetic read failure')
        if (k === key && failing && didSet && mode === 'readback-replaced') return raw([entry(19, 900)])
        return f.storage.getItem(k)
      },
      setItem(k, v) {
        if (k !== key) return f.storage.setItem(k, v)
        attempts++; didSet = true
        if (failing && mode === 'quota') throw Error('synthetic quota')
        if (!(failing && mode === 'silent-drop')) f.storage.setItem(k, v)
      },
    }) })
    await r.type('750', addInput(r.host)); await r.click('Ret mængde', row(r.host, 19)); await r.type('301')
    failing = true; await r.click('Gem rettelse')
    assert.ok(editInput(r.host), 'failed confirmation must retain the actual mounted correction')
    assert.equal(propsOf(editInput(r.host)).value, '301')
    assert.match(row(r.host, 19).textContent, /250 ml/)
    assert.match(water(r.host).textContent, /kunne ikke bekræftes/)
    assert.doesNotMatch(water(r.host).textContent, /Gemt på denne enhed/)
    assert.equal(propsOf(addInput(r.host)).value, '750')
    let count = attempts
    await r.render(); assert.equal(attempts, count, 'no automatic retry')
    await r.click('Gem rettelse')
    assert.equal(propsOf(editInput(r.host)).value, '301', 'failed explicit retry keeps draft')
    assert.doesNotMatch(water(r.host).textContent, /Gemt på denne enhed/)
    count = attempts; failing = false
    await r.render(); assert.equal(attempts, count, 'storage recovery alone never writes')
    const save = propsOf(button(water(r.host), 'Gem rettelse')).onClick
    await r.invoke(() => { save(); save() })
    assert.equal(attempts, count + 1, 'one confirmed explicit retry, captured save retired synchronously')
    assert.equal(editInput(r.host), undefined)
    assert.deepEqual(JSON.parse(r.f.values.get(key)).entries, [{ ...entries[0], ml: 301 }, entries[1]])
    assert.match(water(r.host).textContent, /801 ml/)
    assert.match(water(r.host).textContent, /Gemt på denne enhed/)
    assert.equal(propsOf(addInput(r.host)).value, '750')
    assert.equal(r.f.values.get('synthetic-foreign-water'), 'original foreign bytes')
    assert.equal(r.f.plan.writes().length, 0); assert.equal(r.f.rows.length, 0)
    count = attempts; r.props.enabled = false; await r.render(); r.props.enabled = true; await r.render()
    assert.equal(attempts, count); assert.match(water(r.host).textContent, /801 ml/)
    await r.click('Ret mængde', row(r.host, 19)); assert.equal(propsOf(editInput(r.host)).value, '301')
  })
}

// A failed edit never grants ownership of a same-id replacement or removed record.
for (const mode of ['replacement', 'timestamp', 'removed', 'foreign-owner', 'foreign-date']) {
  test('unconfirmed correction then external ' + mode + ': retry fails closed and cancel never writes', async t => {
    let fail = true, attempts = 0
    const entries = [entry(19), entry(2, 500)]
    const r = await mount(t, { entries, configure: f => ({
      getItem: k => f.storage.getItem(k),
      setItem(k, v) { if (k !== key) return f.storage.setItem(k, v); attempts++; if (fail) throw Error('synthetic quota'); f.storage.setItem(k, v) },
    }) })
    await r.type('750', addInput(r.host)); await r.click('Ret mængde', row(r.host, 19)); await r.type('301'); await r.click('Gem rettelse')
    assert.equal(propsOf(editInput(r.host)).value, '301'); fail = false
    const replacement = mode === 'replacement' ? raw([{ ...entries[0], ml: 812 }, entries[1]])
      : mode === 'timestamp' ? raw([{ ...entries[0], at: date + 'T08:00:00.001Z' }, entries[1]])
        : mode === 'removed' ? raw([entries[1]])
          : JSON.stringify({ schema: 'entropi2-water-day/v1', athleteId: mode === 'foreign-owner' ? 'other-athlete' : athleteId,
            date: mode === 'foreign-date' ? '2026-11-06' : date, entries })
    r.f.values.set(key, replacement)
    await r.click('Gem rettelse'); await r.click('Gem rettelse')
    assert.equal(attempts, 1); assert.equal(r.f.values.get(key), replacement)
    assert.equal(propsOf(editInput(r.host)).value, '301'); assert.equal(propsOf(addInput(r.host)).value, '750')
    assert.match(water(r.host).textContent, /Rettelsen er ikke gemt/)
    const save = propsOf(button(water(r.host), 'Gem rettelse')).onClick
    await r.click('Annuller'); await r.invoke(save)
    assert.equal(editInput(r.host), undefined); assert.equal(attempts, 1); assert.equal(r.f.values.get(key), replacement)
  })
}

test('unconfirmed correction cancel is explicit, write-free, retires retained callbacks and preserves add draft', async t => {
  let attempts = 0
  const r = await mount(t, { configure: f => ({ getItem: k => f.storage.getItem(k), setItem() { attempts++; throw Error('synthetic quota') } }) })
  await r.type('750', addInput(r.host)); await r.click('Ret mængde'); await r.type('301'); await r.click('Gem rettelse')
  const save = propsOf(button(water(r.host), 'Gem rettelse')).onClick, change = propsOf(editInput(r.host)).onChange
  const bytes = r.f.values.get(key)
  await r.click('Annuller'); await r.invoke(() => { save(); change({ currentTarget: { value: '900' } }) })
  assert.equal(attempts, 1); assert.equal(r.f.values.get(key), bytes); assert.equal(editInput(r.host), undefined)
  assert.equal(propsOf(addInput(r.host)).value, '750')
  await r.click('Ret mængde'); assert.equal(propsOf(editInput(r.host)).value, '250')
})

for (const changed of ['future', 'athlete', 'date', 'client', 'OFF', 'unmount', 'midnight', 'provider-value', 'provider-identity', 'provider-throws']) {
  test('normal route: retained edit/open/save/change/cancel inert across ' + changed, async t => {
    const r = await mount(t)
    const open = propsOf(button(water(r.host), 'Ret mængde')).onClick
    await r.click('Ret mængde'); await r.type('300')
    const save = propsOf(button(water(r.host), 'Gem rettelse')).onClick
    const cancel = propsOf(button(water(r.host), 'Annuller')).onClick
    const change = propsOf(editInput(r.host)).onChange
    if (changed === 'future') await r.choose('2026-11-06')
    if (changed === 'athlete') r.props.athlete = { id: 'synthetic-other-water-actor' }
    if (changed === 'date') r.props.date = '2026-11-06'
    if (changed === 'client') r.props.client = fixture().client
    if (changed === 'OFF') r.props.enabled = false
    if (changed === 'unmount') await r.unmount()
    if (changed === 'midnight') t.mock.timers.setTime(new Date('2026-11-05T23:00:00Z').getTime())
    if (changed === 'provider-value') r.setToday('2026-11-06')
    if (changed === 'provider-identity') r.props.currentDay = () => '2026-11-06'
    if (changed === 'provider-throws') r.props.currentDay = () => { throw Error('synthetic provider') }
    if (['athlete', 'date', 'client', 'OFF', 'provider-identity', 'provider-throws'].includes(changed)) await r.render()
    const bytes = [...r.f.values], writes = r.f.writes.length, calls = r.f.calls.length
    await r.invoke(() => { open(); change({ currentTarget: { value: '900' } }); save(); cancel() })
    assert.deepEqual([...r.f.values], bytes); assert.equal(r.f.writes.length, writes); assert.equal(r.f.calls.length, calls)
    if (changed === 'future') {
      assert.equal(water(r.host), undefined)
      await r.choose(date); await r.invoke(() => { open(); save() })
      assert.equal(editInput(r.host), undefined); assert.equal(r.f.writes.length, writes)
      assert.match(water(r.host).textContent, /250 ml/)
    }
  })
}

test('preview selection retires edit handlers synchronously before React commits; return cannot apply old draft', async t => {
  const r = await mount(t)
  const open = propsOf(button(water(r.host), 'Ret mængde')).onClick
  await r.click('Ret mængde'); await r.type('300')
  const save = propsOf(button(water(r.host), 'Gem rettelse')).onClick
  const change = propsOf(editInput(r.host)).onChange
  const select = propsOf(r.select()).onChange, bytes = r.f.values.get(key)
  await r.invoke(() => { select({ currentTarget: { value: '2026-11-06' } }); save(); open(); change({ currentTarget: { value: '500' } }) })
  assert.equal(water(r.host), undefined); assert.equal(r.f.values.get(key), bytes); assert.equal(r.f.writes.length, 0)
  await r.choose(date); await r.invoke(save)
  assert.equal(r.f.values.get(key), bytes); assert.equal(editInput(r.host), undefined)
})

test('actual model update: exact snapshot membership, limits, immutable other entries, stale and disposed callbacks', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00Z') })
  const entries = Array.from({ length: waterLimits.entries }, (_, i) => entry(i + 1, 10000))
  const f = fixture(); f.values.set(key, raw(entries))
  const c = createWaterDayLog({ enabled: true, athleteId, date, storage: f.storage })
  try {
    const before = c.snapshot(), target = before.entries[50]
    for (const value of [0, -1, 1.5, 10001, NaN, Infinity, {}, true, '1e3']) assert.equal(c.update(target, value), false)
    assert.equal(c.update({ ...target }, '300'), false)
    assert.equal(c.update(target, '1'), true)
    const after = c.snapshot()
    assert.equal(after.entries.length, 100); assert.equal(after.totalMl, 990001)
    for (let i = 0; i < entries.length; i++) {
      assert.deepEqual(after.entries[i], i === 50 ? { ...entries[i], ml: 1 } : entries[i])
      if (i !== 50) assert.strictEqual(after.entries[i], before.entries[i])
    }
    assert.equal(Object.isFrozen(after.entries[50]), true)
    assert.equal(c.update(target, '500'), false, 'old draft cannot update the newer snapshot')
    assert.equal(c.remove(51), true); assert.equal(c.update(after.entries[50], '500'), false)
    const latest = c.snapshot().entries[0]; c.dispose(); assert.equal(c.update(latest, '2'), false)
    assert.equal(f.writes.length, 2); assert.ok(f.values.get(key).length <= waterLimits.text)
  } finally { c.dispose() }
})
