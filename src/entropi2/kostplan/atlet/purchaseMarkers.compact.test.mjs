// One focused regression: lossless bounded scopes on realistic public synthetic
// plans, exercised through the actual controller and mounted React consumer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { foodKey, sumApprovedShopping, formatApprovedShopping } from './approvedShoppingModel.mjs'
import { openPurchaseMarkers, purchaseScope, purchaseNamespace, maxPurchaseBytes } from './purchaseMarkers.mjs'
import { createPlanSnapshot } from '../planSnapshot.mjs'
import { historyFixture, uuid } from '../dailyReference.fixture.mjs'
import { food, mealNames, tableNames, today, athleteId } from './approvedShopping.fixture.mjs'
import { all, propsOf, button, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const dates = ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']
const bytes = value => new TextEncoder().encode(value).length
const key = `${purchaseNamespace}:${encodeURIComponent(athleteId)}`
const oldKey = key.replace(':purchases:v2:', ':purchases:v1:')
function memory(raw = null) {
  const values = new Map([[oldKey, 'untouched-v1-record']]), reads = [], writes = []
  if (raw !== null) values.set(key, raw)
  return { values, reads, writes,
    getItem(k) { assert.equal(k, key); reads.push(k); return values.get(k) ?? null },
    setItem(k, v) { assert.equal(k, key); assert.ok(bytes(v) <= maxPurchaseBytes); writes.push(v); values.set(k, v) },
  }
}
function realistic() {
  const f = historyFixture(), plan = f.plan(92000, today, 'godkendt', athleteId)
  let i = 0
  const snapshot = createPlanSnapshot({ goal: 'vedligehold', intensity: .2,
    meals: mealNames.map((name, mi) => ({ name, portions: Array.from({ length: mi < 3 ? 5 : 4 }, () => {
      const n = i++
      return { grams: n === 0 ? .1 : n + 1.125,
        food: food(`compact:synthetic:${n}`, `Syntetisk råvare ${n}`, n % 2 ? 'kogt' : 'rå',
          `Public synthetic citation ${n}: https://example.invalid/food/${n}; edition 2026; `
          + 'Origin, preparation and verified sampling context for this synthetic identity. '.repeat(2)) }
    }) })) })
  const meals = structuredClone(snapshot.meals)
  meals[0].portions.push({ ...structuredClone(meals[0].portions[0]), grams: .2 })
  const version = { id: uuid(92001), plan_id: plan.id, version_no: 1, effective_from: today,
    portion_guidance: null, ...snapshot, meals }
  f.data[tableNames[1]].push(version); f.approve(92001, plan.id, today + 'T10:00:00Z', athleteId)
  const evidence = dates.map(date => ({ date, planId: plan.id, versionId: version.id,
    versionNumber: 1, effectiveFrom: today, meals: version.meals }))
  return { f, evidence }
}
const optionsFor = evidence => ({ athleteId, today, evidence,
  result: sumApprovedShopping(today, evidence.map(d => d.date), evidence) })
// Independent old representation is an oracle for exact, lossless expansion.
const expanded = o => [o.athleteId, o.today, [...o.result.dates].sort(),
  [...o.evidence].sort((a, b) => a.date.localeCompare(b.date)).map(d => [d.date, d.planId,
    d.versionId, d.versionNumber, d.effectiveFrom,
    d.meals.map(m => m.portions.map(p => [foodKey(p.food), String(p.grams)]))]),
  o.result.items.map(i => [i.key, i.grams, i.preparation])]

test('realistic 3/4-day scope is lossless, bounded and persistent through explicit React toggle/reopen with exact isolation', async () => {
  const { f, evidence } = realistic(), before = JSON.stringify(f.data)
  for (const count of [3, 4]) {
    const selected = evidence.slice(4 - count), o = optionsFor(selected), storage = memory()
    const legacyBytes = bytes(JSON.stringify(expanded(o))), scope = purchaseScope(o)
    console.log(`synthetic days=${count} meals=${count * 6} portions=${count * 28} identities=27 oldBytes=${legacyBytes} scopeBytes=${bytes(scope)}`)
    assert.ok(legacyBytes > maxPurchaseBytes / 2, 'pinned lead: healthy storage exceeded old scope budget')
    const c = createApprovedShopping({ enabled: true, client: f.client, ...o, dates: o.result.dates, storage: () => storage })
    try {
      assert.equal(await c.load(), true)
      assert.equal(c.snapshot().purchases.persistent, true, 'ordinary approved list must fit unchanged scope budget')
      assert.equal(storage.writes.length, 0)
      assert.equal(c.snapshot().result.items.length, 27)
      assert.equal(c.snapshot().result.items[0].grams, count === 3 ? '0.9' : '1.2')
      assert.equal(c.snapshot().result.items[1].grams, count === 3 ? '6.375' : '8.5')
      const compact = JSON.parse(scope), restored = structuredClone(compact)
      for (const day of restored[3]) for (const meal of day[5]) for (const portion of meal) {
        assert.ok(Number.isInteger(portion[0]), 'confirmed product ingredients use dictionary references')
        portion[0] = restored[4][portion[0]][0]
      }
      assert.deepEqual(restored, expanded(o), 'every original identity/date/version/ordered portion/decimal/gross sum survives')
      assert.equal(purchaseScope({ ...o, evidence: [...selected].reverse(), result: { ...o.result, dates: [...o.result.dates].reverse() } }), scope)

      const copy = formatApprovedShopping(c.snapshot().result)
      assert.equal(c.markBought(0, true), true)
      assert.equal(storage.writes.length, 1)
      assert.equal(formatApprovedShopping(c.snapshot().result), copy)
      const reopen = openPurchaseMarkers({ ...o, storage: () => storage })
      assert.deepEqual(reopen.snapshot(), { bought: [0], persistent: true })
      assert.equal(storage.values.get(oldKey), 'untouched-v1-record')
      for (const kind of ['actor', 'today', 'date', 'plan', 'version', 'number', 'effective', 'id', 'source', 'verification', 'prep', 'order', 'grams', 'gross', 'same-gross-key']) {
        const change = structuredClone(o), d = change.evidence[0], p = d.meals[0].portions[0]
        if (kind === 'actor') change.athleteId += '-other'
        if (kind === 'today') change.today = '2026-11-06'
        if (kind === 'date') { change.evidence.pop(); change.result = sumApprovedShopping(today, change.evidence.map(d => d.date), change.evidence) }
        if (kind === 'plan') d.planId = uuid(92002)
        if (kind === 'version') d.versionId = uuid(92003)
        if (kind === 'number') d.versionNumber++
        if (kind === 'effective') d.effectiveFrom = '2026-11-06'
        if (kind === 'id' || kind === 'same-gross-key') p.food.id += ':changed'
        if (kind === 'source') p.food.source.citation += ':changed'
        if (kind === 'verification') p.food.source.verification += ':changed'
        if (kind === 'prep') p.food.preparation += ':changed'
        if (kind === 'order') d.meals[0].portions.reverse()
        if (kind === 'grams') { p.grams = .15; d.meals[0].portions.at(-1).grams = .15 }
        if (kind === 'gross') change.result.items[0].grams = '9'
        if (['id', 'source', 'verification', 'prep'].includes(kind)) change.result = sumApprovedShopping(today, change.result.dates, change.evidence)
        assert.notEqual(purchaseScope(change), scope, kind)
        const foreignKey = `${purchaseNamespace}:${encodeURIComponent(change.athleteId)}`
        const isolated = openPurchaseMarkers({ ...change, storage: () => ({ getItem: k => { assert.equal(k, foreignKey); return storage.values.get(key) }, setItem() { assert.fail('no automatic writes') } }) })
        assert.deepEqual(isolated.snapshot().bought, [], kind)
      }

      const good = storage.values.get(key), record = JSON.parse(good), badRef = JSON.parse(record.scope)
      badRef[3][0][5][0][0][0] = badRef[4].length
      for (const bad of ['{', 'x'.repeat(maxPurchaseBytes + 1), JSON.stringify({ ...record, namespace: 'foreign' }),
        JSON.stringify({ ...record, scope: JSON.stringify(badRef) })]) {
        const s = memory(bad), m = openPurchaseMarkers({ ...o, storage: () => s })
        assert.equal(m.snapshot().persistent, false); m.set(1, true)
        assert.deepEqual(m.snapshot().bought, [1]); assert.equal(s.writes.length, 0); assert.equal(s.values.get(key), bad)
      }
      for (const mode of ['throw-read', 'quota', 'mismatch']) {
        const s = memory()
        if (mode === 'throw-read') s.getItem = () => { throw Error('denied') }
        if (mode === 'quota') s.setItem = () => { throw Error('quota') }
        if (mode === 'mismatch') s.setItem = () => {}
        const m = openPurchaseMarkers({ ...o, storage: () => s }); m.set(0, true)
        assert.deepEqual(m.snapshot(), { bought: [0], persistent: false }, mode)
      }
    } finally { c.dispose() }
  }

  // Bracket the unchanged UTF-8 scope cap with a long valid citation. No
  // truncation: one extra byte retires persistence before storage is resolved.
  const padded = n => {
    const e = structuredClone(evidence)
    for (const d of e) for (const m of d.meals) for (const p of m.portions) if (p.food.id === 'compact:synthetic:0') p.food.source.citation += 'æ'.repeat(n)
    return optionsFor(e)
  }
  let lo = 0, hi = 20000
  while (lo + 1 < hi) { const mid = Math.floor((lo + hi) / 2); if (bytes(purchaseScope(padded(mid))) <= maxPurchaseBytes / 2) lo = mid; else hi = mid }
  for (const [n, persistent] of [[lo, true], [hi, false]]) {
    const s = memory(), m = openPurchaseMarkers({ ...padded(n), storage: () => s })
    assert.equal(m.snapshot().persistent, persistent); assert.equal(s.writes.length, 0)
    assert.equal(s.reads.length, persistent ? 1 : 0); m.set(0, true)
    assert.deepEqual(m.snapshot(), { bought: [0], persistent })
    assert.equal(s.writes.length, persistent ? 1 : 0)
    console.log(`scope boundary bytes=${bytes(m.scope)} persistent=${persistent}`)
  }

  const dom = hostFixture(), storage = memory(), copies = [], warnings = []
  const previousError = console.error; console.error = (...args) => warnings.push(args.map(String).join(' '))
  const props = { enabled: true, athleteId, today, client: f.client, storage: () => storage, clipboard: { writeText: text => copies.push(text) } }
  let root = createRoot(dom.host), alive = true
  const marks = () => all(dom.host, 'button').filter(n => n.getAttribute('role') === 'checkbox')
  const render = () => act(async () => { root.render(h(StrictMode, null, h(ApprovedPlanShopping, props))); await tick() })
  const chooseToday = () => act(async () => {
    propsOf(all(dom.host, 'input').find(n => n.getAttribute('aria-label') === `Indkøb ${today}`)).onChange({ currentTarget: { checked: true } }); await tick()
  })
  const click = node => act(async () => { await propsOf(node).onClick(); await tick() })
  try {
    await render(); assert.equal(marks().length, 27); assert.equal(storage.writes.length, 0)
    assert.match(dom.host.textContent, /gemmes lokalt ved ændring/)
    await click(marks()[0]); assert.equal(propsOf(marks()[0])['aria-checked'], true)
    await click(button(dom.host, 'Kopiér indkøbsliste'))
    assert.equal(copies.at(-1), formatApprovedShopping(optionsFor(evidence.slice(1)).result))
    await act(async () => { root.unmount(); await tick() }); alive = false
    root = createRoot(dom.host); alive = true; await render()
    assert.equal(propsOf(marks()[0])['aria-checked'], true)
    await chooseToday(); assert.ok(marks().every(n => !propsOf(n)['aria-checked']))
    await click(marks()[1]); const fourDayWrites = storage.writes.length
    await act(async () => { root.unmount(); await tick() }); alive = false
    root = createRoot(dom.host); alive = true; await render(); await chooseToday()
    assert.equal(propsOf(marks()[1])['aria-checked'], true)
    assert.equal(storage.writes.length, fourDayWrites, 'StrictMode/open/date selection never writes')
    await click(button(dom.host, 'Kopiér indkøbsliste'))
    assert.equal(copies.at(-1), formatApprovedShopping(optionsFor(evidence).result))
    const retained = propsOf(marks()[1]).onClick
    props.enabled = false; await render(); assert.equal(await retained(), false)
    assert.equal(storage.writes.length, fourDayWrites)
    assert.equal(storage.values.get(oldKey), 'untouched-v1-record')
    assert.equal(JSON.stringify(f.data), before); assert.equal(f.writes().length, 0)
  } finally {
    try { if (alive) await act(async () => { root.unmount(); await tick() }); assert.deepEqual(warnings, []) }
    finally { console.error = previousError; dom.restore() }
  }
})
