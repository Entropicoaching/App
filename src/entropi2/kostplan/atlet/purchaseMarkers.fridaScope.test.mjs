import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ApprovedPlanShopping from './ApprovedPlanShopping.mjs'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { historyFixture } from '../dailyReference.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { all, propsOf, button, tick, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { FRIDA_FOODS } from '../foedevarer/frida55.mjs'
import { supportedPlanSnapshot } from '../sqlSnapshot.mjs'
import { uuid, athleteId } from '../dailyReference.fixture.mjs'
import { foodKey, sumApprovedShopping, formatApprovedShopping } from './approvedShoppingModel.mjs'
import { purchaseScope, openPurchaseMarkers, purchaseNamespace, maxPurchaseBytes } from './purchaseMarkers.mjs'
// Independent oracle for the accepted, untagged v2 scope grammar.
const oldScope = o => JSON.stringify([o.athleteId, o.today, [...o.result.dates].sort(),
  [...o.evidence].sort((a, b) => a.date.localeCompare(b.date)).map(d => [d.date, d.planId,
    d.versionId, d.versionNumber, d.effectiveFrom, d.meals.map(m => m.portions.map(p => {
      const identity = foodKey(p.food), i = o.result.items.findIndex(v => v.key === identity)
      return [i < 0 ? identity : i, String(p.grams)]
    }))]), o.result.items.map(i => [i.key, i.grams, i.preparation])])

const today = '2026-11-08', cap = 16384, expandedCap = 262144
const bytes = v => new TextEncoder().encode(v).length
const key = `${purchaseNamespace}:${encodeURIComponent(athleteId)}`
function memory(raw = null) {
  const values = new Map(raw === null ? [] : [[key, raw]]), reads = [], writes = []
  return { values, reads, writes,
    getItem(k) { reads.push(k); return values.get(k) ?? null },
    setItem(k, v) { writes.push([k, v]); values.set(k, v) },
  }
}
function fixture(count = 3) {
  const dates = [today, '2026-11-09', '2026-11-10', '2026-11-11'].slice(0, count)
  const evidence = dates.map((date, di) => ({ date, planId: uuid(980), versionId: uuid(981 + di),
    versionNumber: di + 1, effectiveFrom: date,
    meals: supportedPlanSnapshot({ goal: 'vedligehold', intensity: 0,
      meals: Array.from({ length: 6 }, (_, mi) => ({ name: 'Synthetic Frida ' + mi,
        portions: Array.from({ length: 4 }, (_, pi) => ({ grams: 100.25 + di * 2 + mi + pi / 4,
          food: FRIDA_FOODS[(di * 3 + mi * 4 + pi) % 27] })) })) }).meals }))
  return { athleteId, today, evidence, result: sumApprovedShopping(today, dates, evidence) }
}
// Independent decoder oracle: no product codec implementation is imported.
function decode(raw) {
  const [tag, tokens] = JSON.parse(raw)
  assert.equal(tag, 'purchase-scope/lz2')
  let text = ''
  for (const t of tokens) {
    if (typeof t === 'string') text += t
    else { const n = t % 262145, d = Math.floor(t / 262145); text += text.substring(text.length - d, text.length - d + n) }
  }
  return { s: JSON.parse(text), text }
}
function expandedIdentities(s) {
  const copy = structuredClone(s)
  for (const d of copy[3]) for (const m of d[5]) for (const p of m) if (typeof p[0] === 'number') p[0] = copy[4][p[0]][0]
  return copy
}

test('exact pinned three-day lead and distinct four-day Frida list persist losslessly and copy full gross evidence', () => {
  for (const count of [3, 4]) {
    const o = fixture(count), store = memory(), scope = purchaseScope(o), before = formatApprovedShopping(o.result)
    assert.equal(o.result.items.length, 27)
    if (count === 3) assert.equal(bytes(oldScope(o)), 24308)
    assert.ok(bytes(scope) <= cap)
    const decoded = decode(scope)
    assert.deepEqual(expandedIdentities(decoded.s), expandedIdentities(JSON.parse(oldScope(o))))
    assert.equal(decoded.text, oldScope(o), 'exact original scope JSON survives')
    const m = openPurchaseMarkers({ ...o, storage: () => store })
    assert.deepEqual(m.snapshot(), { bought: [], persistent: true }); assert.equal(store.writes.length, 0)
    m.set(0, true); m.set(26, true)
    assert.ok(bytes(store.values.get(key)) <= maxPurchaseBytes)
    const saved = store.values.get(key), reopened = openPurchaseMarkers({ ...o, storage: () => store })
    assert.deepEqual(reopened.snapshot(), { bought: [0, 26], persistent: true })
    assert.equal(store.values.get(key), saved); assert.equal(store.writes.length, 2)
    assert.equal(formatApprovedShopping(o.result), before)
    assert.equal(purchaseScope({ ...o, evidence: [...o.evidence].reverse() }), scope)
    console.log(JSON.stringify({ days: count, oldScopeBytes: bytes(oldScope(o)), scopeBytes: bytes(scope), recordBytes: bytes(saved), expandedBytes: bytes(decoded.text) }))
  }
})

// Written by the actual original BASE v2 module in this run, not a fabricated
// new-code record or a read migration. The witness is intentionally raw bytes.
const originalV2Raw = "{\"namespace\":\"entropi2:kostplan:atlet:v1:purchases:v2\",\"scope\":\"[\\\"synthetic-k-r3-legacy\\\",\\\"2026-11-08\\\",[\\\"2026-11-08\\\"],[[\\\"2026-11-08\\\",\\\"30000000-0000-4000-8000-000000048001\\\",\\\"30000000-0000-4000-8000-000000048002\\\",7,\\\"2026-11-08\\\",[[[0,\\\"0.375\\\"],[1,\\\"81.125\\\"]]]]],[[\\\"[\\\\\\\"frida55:517\\\\\\\",\\\\\\\"Som navngivet: Hytteost, 20+\\\\\\\",\\\\\\\"DTU Frida5.5; https://doi.org/10.11583/DTU.29500682.v8; FoodID=517; [ParameterID,Source,SourceFood]=[[359,\\\\\\\\\\\\\\\"1003\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[317,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[318,\\\\\\\\\\\\\\\"1003\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[141,\\\\\\\\\\\\\\\"2092, 2193\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[168,\\\\\\\\\\\\\\\"1655\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[162,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[108,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[184,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[274,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[165,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[201,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[126,\\\\\\\\\\\\\\\"1003\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[38,\\\\\\\\\\\\\\\"2092\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[143,\\\\\\\\\\\\\\\"1803\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[180,\\\\\\\\\\\\\\\"1059\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"]]\\\\\\\",\\\\\\\"Officielle referencegennemsnit; omfatter anslåede/beregnede/lånte værdier; ikke individuelt målt eller eksakt mærkevare.\\\\\\\"]\\\",\\\"0.375\\\",\\\"Som navngivet: Hytteost, 20+\\\"],[\\\"[\\\\\\\"frida55:795\\\\\\\",\\\\\\\"Som navngivet: Kylling, kød, rå\\\\\\\",\\\\\\\"DTU Frida5.5; https://doi.org/10.11583/DTU.29500682.v8; FoodID=795; [ParameterID,Source,SourceFood]=[[359,\\\\\\\\\\\\\\\"1003\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[317,\\\\\\\\\\\\\\\"2089, 1840\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[318,\\\\\\\\\\\\\\\"1003\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[141,\\\\\\\\\\\\\\\"1818, 2089, 1840\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[168,\\\\\\\\\\\\\\\"1938\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[162,\\\\\\\\\\\\\\\"1070, 1840\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[108,\\\\\\\\\\\\\\\"1030\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[184,\\\\\\\\\\\\\\\"1070, 1840\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[274,\\\\\\\\\\\\\\\"1070, 1840\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[165,\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"959\\\\\\\\\\\\\\\"],[201,\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"959\\\\\\\\\\\\\\\"],[126,\\\\\\\\\\\\\\\"1003\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[38,\\\\\\\\\\\\\\\"1840\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[143,\\\\\\\\\\\\\\\"1840, 1845\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"],[180,\\\\\\\\\\\\\\\"1059\\\\\\\\\\\\\\\",\\\\\\\\\\\\\\\"NULL\\\\\\\\\\\\\\\"]]\\\\\\\",\\\\\\\"Officielle referencegennemsnit; omfatter anslåede/beregnede/lånte værdier; ikke individuelt målt eller eksakt mærkevare.\\\\\\\"]\\\",\\\"81.125\\\",\\\"Som navngivet: Kylling, kød, rå\\\"]]]\",\"bought\":[1]}"
test('actual original-product-written v2 witness is unchanged on repeated reads', () => {
  const date = today
  const evidence = [{ date, planId: uuid(48001), versionId: uuid(48002), versionNumber: 7, effectiveFrom: date,
    meals: supportedPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [{ name: 'K v2 witness',
      portions: [{ grams: .375, food: FRIDA_FOODS[18] }, { grams: 81.125, food: FRIDA_FOODS[21] }] }] }).meals }]
  const o = { athleteId: 'synthetic-k-r3-legacy', today, evidence, result: sumApprovedShopping(today, [today], evidence) }
  const legacyKey = `${purchaseNamespace}:${encodeURIComponent(o.athleteId)}`, reads = [], writes = []
  let raw = originalV2Raw
  const store = { getItem(k) { reads.push(k); assert.equal(k, legacyKey); return raw },
    setItem(k, v) { writes.push([k,v]); raw = v } }
  assert.equal(purchaseScope(o), oldScope(o))
  assert.equal(JSON.parse(raw).scope, oldScope(o))
  for (let i=0;i<3;i++) assert.deepEqual(openPurchaseMarkers({ ...o, storage: () => store }).snapshot(), { bought: [1], persistent: true })
  assert.equal(raw, originalV2Raw); assert.equal(writes.length, 0); assert.equal(reads.length, 3)
  const c = structuredClone(o); c.evidence[0].meals[0].portions[0].food.nutrientsPer100g.proteinG += .125
  assert.equal(purchaseScope(c), purchaseScope(o), 'original v2 identity is preserved without adding nutrient bindings')
})

test('same gross provenance and ordered evidence and actor/date/version mutations isolate marks', () => {
  const o = fixture(), store = memory(), marker = openPurchaseMarkers({ ...o, storage: () => store })
  marker.set(0, true)
  for (const kind of ['source', 'verification', 'preparation', 'order', 'grams', 'actor', 'date', 'version', 'effective', 'number']) {
    const c = structuredClone(o), d = c.evidence[0], p = d.meals[0].portions[0]
    if (kind === 'source') p.food.source.citation += '; changed'
    if (kind === 'verification') p.food.source.verification += '; changed'
    if (kind === 'preparation') p.food.preparation += '; changed'
    if (kind === 'order') d.meals[0].portions.reverse()
    if (kind === 'grams') { p.grams += .125; d.meals[0].portions[1].grams -= .125 }
    if (kind === 'actor') c.athleteId += '-other'
    if (kind === 'date') c.today = '2026-11-07'
    if (kind === 'version') d.versionId = uuid(999)
    if (kind === 'effective') d.effectiveFrom = '2026-11-07'
    if (kind === 'number') d.versionNumber++
    // Retain identical gross items deliberately: evidence changes alone must bind.
    assert.notEqual(purchaseScope(c), marker.scope, kind)
    const m = openPurchaseMarkers({ ...c, storage: () => ({ getItem: () => store.values.get(key), setItem() { assert.fail('read write') } }) })
    assert.deepEqual(m.snapshot().bought, [], kind)
  }
})

test('malformed tags, indices, counts, nested/trailing/noncanonical/oversize input fail closed without overwriting', () => {
  const o = fixture(), scope = purchaseScope(o), record = s => JSON.stringify({ namespace: purchaseNamespace, scope: s, bought: [0] })
  const bad = [JSON.stringify(['foreign', []]), JSON.stringify(['purchase-scope/lz2', [1]]),
    JSON.stringify(['purchase-scope/lz2', [[1, 20]]]), JSON.stringify(['purchase-scope/lz2', [262145 * expandedCap + 20]]),
    JSON.stringify(['purchase-scope/lz2', ['x'.repeat(cap)]]), scope + ' ', scope + '[]',
    '['.repeat(1000) + '0' + ']'.repeat(1000), JSON.stringify(['purchase-scope/lz2', Array(4097).fill(12)]),
    JSON.stringify(['purchase-scope/lz2', ['ÃƒÂ©'.repeat(8200)]])]
  // Valid JSON but invalid decoded payloads, with no reference expansion at all.
  for (const payload of [[[], [], []], [JSON.parse(oldScope(o)), [], []]]) bad.push(JSON.stringify(['purchase-scope/lz2', [JSON.stringify(payload)]]))
  for (const rawScope of bad) {
    const raw = record(rawScope), store = memory(raw), m = openPurchaseMarkers({ ...o, storage: () => store })
    assert.equal(m.snapshot().persistent, false); m.set(1, true)
    assert.equal(store.values.get(key), raw); assert.equal(store.writes.length, 0)
  }
  const store = memory('x'.repeat(maxPurchaseBytes + 1))
  assert.equal(openPurchaseMarkers({ ...o, storage: () => store }).snapshot().persistent, false)
})

test('get/set/readback failures remain sticky and preserve session marks and prior bytes', () => {
  const o = fixture()
  for (const kind of ['get', 'set', 'drop', 'replace', 'readback']) {
    const s = memory(), get = s.getItem.bind(s)
    if (kind === 'get') s.getItem = () => { throw Error('get') }
    if (kind === 'set') s.setItem = () => { throw Error('quota') }
    if (kind === 'drop') s.setItem = () => {}
    if (kind === 'replace') s.setItem = () => { s.values.set(key, 'concurrent replacement') }
    if (kind === 'readback') s.getItem = k => { if (s.writes.length) throw Error('readback'); return get(k) }
    const m = openPurchaseMarkers({ ...o, storage: () => s }); m.set(2, true)
    assert.deepEqual(m.snapshot(), { bought: [2], persistent: false }, kind)
    const writes = s.writes.length; m.set(3, true); assert.equal(s.writes.length, writes)
  }
})

test('truly oversized evidence remains explicit session-only before any storage access', () => {
  const o = structuredClone(fixture())
  o.evidence[0].meals[0].portions[0].food.source.citation += Array.from({ length: 20000 }, (_, i) => String.fromCharCode(0x1000 + i)).join('')
  o.result = sumApprovedShopping(today, o.result.dates, o.evidence)
  const m = openPurchaseMarkers({ ...o, storage: () => { assert.fail('oversize storage read') } })
  assert.deepEqual(m.snapshot(), { bought: [], persistent: false }); m.set(0, true)
  assert.deepEqual(m.snapshot(), { bought: [0], persistent: false })
})
// Exercise the exact private codec for allocation-order observations only;
// all persistence behavior above and below uses the public product entry point.
const productSource = readFileSync(new URL('./purchaseMarkers.mjs', import.meta.url), 'utf8')
const codecSource = productSource.slice(productSource.indexOf('const compactTag ='), productSource.indexOf('// Called only after the controller'))
function observedCodec(observer = () => {}) {
  return new Function('bytes', 'maxPurchaseBytes', 'validLegacyScope', codecSource + '\nreturn { pack, unpack, rangeBytes };')(
    bytes, maxPurchaseBytes, raw => { observer(raw); return true })
}

test('UTF-8 and structural ceilings reject before affected reference slice, with exact surrogate accounting', () => {
  let validated = 0
  const codec = observedCodec(() => validated++)
  const nativeSlice = String.prototype.slice, copies = []
  const bad = codec.pack('界甲乙丙丁戊己庚辛壬癸子丑寅卯辰'.repeat(5462))
  assert.ok(bytes(bad) < cap)
  // Replay references independently and locate the first unsafe expansion.
  let prefix = '', safeCopies = 0, finalBytes = 0
  for (const token of JSON.parse(bad)[1]) {
    const part = typeof token === 'string' ? token : prefix.substring(prefix.length - Math.floor(token / 262145), prefix.length - Math.floor(token / 262145) + token % 262145)
    finalBytes = bytes(prefix + part)
    if (finalBytes > expandedCap) break
    prefix += part
    if (typeof token === 'number') safeCopies++
  }
  assert.ok(finalBytes > expandedCap)
  try {
    String.prototype.slice = function(start, end) { copies.push([this.length, start, end]); return nativeSlice.call(this, start, end) }
    assert.throws(() => codec.unpack(bad, athleteId), /UTF-8 expansion bound/)
  } finally { String.prototype.slice = nativeSlice }
  assert.equal(copies.length, safeCopies, 'the violating reference was never sliced')
  assert.equal(validated, 0, 'no over-budget expanded string reached scope parsing')
  for (const sample of ['æ漢😀\\\"', '\ud800x\udc00', 'x😀y'.repeat(30)]) {
    for (let a=0;a<=sample.length;a++) for (let b=a;b<=sample.length;b++)
      assert.equal(codec.rangeBytes(sample,a,b), bytes(sample.substring(a,b)))
  }
  // First range exceeds the structural depth; no reference copying is needed.
  for (const input of ['['.repeat(8)+'0'+']'.repeat(8), '[}', '["\n"]']) {
    assert.throws(() => codec.unpack(JSON.stringify(['purchase-scope/lz2',[input]]), athleteId), /Scope (depth|structure|string control)/)
  }
  console.log(JSON.stringify({ utf8AttackEncodedBytes: bytes(bad), rejectedNextBytes: finalBytes, safeReferenceCopies: safeCopies, overBudgetReferenceCopies: 0 }))
})

test('canonical compressed bad grammar/references and true byte bounds fail closed without writes', () => {
  const o = fixture(), codec = observedCodec(), good = JSON.parse(oldScope(o))
  const cases = []
  for (const mutate of [s => { s[0] += '-foreign' }, s => { s[3][0][5][0][0][0] = 256 },
    s => { s[4][0][1] = '-1' }, s => { s[3][0][5][0][0][1] = 'NaN' },
    s => { s[4][1][0] = s[4][0][0] }, s => { s[2].reverse() }]) {
    const s=structuredClone(good); mutate(s); cases.push(codec.pack(JSON.stringify(s)))
  }
  cases.push(codec.pack(JSON.stringify(good)+' '), codec.pack('界'.repeat(87382)),
    codec.pack('x'.repeat(expandedCap+1)),
    JSON.stringify(['purchase-scope/lz2', ['0123456789abcdef', 12*262145+13]]),
    JSON.stringify(['purchase-scope/lz2', ['0123456789abcdef', -1]]),
    JSON.stringify(['purchase-scope/lz2', ['0123456789abcdef', 16*262145+12.5]]),
    JSON.stringify(['purchase-scope/lz2', ['0123456789abcdef', true]]))
  const current = purchaseScope(o)
  cases.push(current.replace('purchase-scope','purchase-\\u0073cope'))
  for (const scope of cases) {
    const raw=JSON.stringify({namespace:purchaseNamespace,scope,bought:[0]}), s=memory(raw)
    const m=openPurchaseMarkers({...o,storage:()=>s})
    assert.equal(m.snapshot().persistent,false); m.set(3,true)
    assert.equal(s.writes.length,0); assert.equal(s.values.get(key),raw)
  }
})

test('redistributing grams between identical foods with unchanged gross totals isolates marks', () => {
  const o=fixture(4), s=memory(), m=openPurchaseMarkers({...o,storage:()=>s}); m.set(3,true)
  const c=structuredClone(o), portions=c.evidence.flatMap(d=>d.meals.flatMap(meal=>meal.portions))
  const a=portions[0], b=portions.find((p,i)=>i>0 && foodKey(p.food)===foodKey(a.food))
  assert.ok(b); a.grams+=.125; b.grams-=.125
  c.result=sumApprovedShopping(today,c.result.dates,c.evidence)
  assert.deepEqual(c.result.items,o.result.items)
  assert.notEqual(purchaseScope(c),m.scope)
  assert.deepEqual(openPurchaseMarkers({...c,storage:()=>s}).snapshot(),{bought:[],persistent:true})
  assert.equal(s.writes.length,1)
})

function mountedFixture(o) {
  const f=historyFixture(), parent=f.plan(980,today,'godkendt',athleteId)
  for (const [di,d] of o.evidence.entries()) {
    f.data[tableNames[1]].push({id:d.versionId,plan_id:parent.id,version_no:d.versionNumber,effective_from:d.effectiveFrom,
      goal:'vedligehold',intensity:0,meals:structuredClone(d.meals)})
    f.approve(981+di,parent.id,today+'T00:00:00.000001Z',athleteId)
  }
  return f
}

test('actual four-day controller and mounted StrictMode Frida consumer retain toggle/reopen/full copy and OFF guards', async () => {
  const o=fixture(4), f=mountedFixture(o), rawPlans=JSON.stringify(f.data), s=memory()
  const c=createApprovedShopping({enabled:true,client:f.client,athleteId,today,dates:o.result.dates,storage:()=>s})
  try {
    assert.equal(await c.load(),true); assert.deepEqual(c.snapshot().result,o.result)
    assert.deepEqual(c.snapshot().purchases,{bought:[],persistent:true}); assert.equal(s.writes.length,0)
    assert.equal(c.markBought(9,true),true)
    assert.deepEqual(c.snapshot().purchases,{bought:[9],persistent:true})
  } finally { c.dispose() }
  const dom=hostFixture(), copies=[], warnings=[], props={enabled:true,athleteId,today,client:f.client,
    storage:()=>s,clipboard:{writeText:t=>copies.push(t)}}
  const priorError=console.error; console.error=(...args)=>warnings.push(args.map(String).join(' '))
  let root=createRoot(dom.host), alive=true
  const render=()=>act(async()=>{root.render(h(StrictMode,null,h(ApprovedPlanShopping,props)));await tick()})
  const selectFour=()=>act(async()=>{
    const n=all(dom.host,'input').find(n=>n.getAttribute('aria-label')===`Indkøb ${today}`)
    assert.ok(n); propsOf(n).onChange({currentTarget:{checked:true}}); await tick()
  })
  const marks=()=>all(dom.host,'button').filter(n=>n.getAttribute('role')==='checkbox')
  const click=n=>act(async()=>{await propsOf(n).onClick();await tick()})
  try {
    await render(); await selectFour(); assert.equal(marks().length,27)
    assert.equal(propsOf(marks()[9])['aria-checked'],true); assert.equal(s.writes.length,1)
    assert.match(dom.host.textContent,/gemmes lokalt ved ændring/)
    await click(marks()[22]); await click(button(dom.host,'Kopiér indkøbsliste'))
    assert.equal(copies.at(-1),formatApprovedShopping(o.result))
    await act(async()=>{root.unmount();await tick()}); alive=false
    root=createRoot(dom.host);alive=true;await render();await selectFour()
    assert.equal(propsOf(marks()[9])['aria-checked'],true)
    assert.equal(propsOf(marks()[22])['aria-checked'],true)
    const writes=s.writes.length, stale=propsOf(marks()[22]).onClick
    props.enabled=false;await render();assert.equal(await stale(),false)
    assert.equal(s.writes.length,writes);assert.equal(f.writes().length,0)
    assert.equal(JSON.stringify(f.data),rawPlans)
  } finally {
    try {if(alive)await act(async()=>{root.unmount();await tick()});assert.deepEqual(warnings,[])}
    finally {console.error=priorError;dom.restore()}
  }
})

test('exact expanded UTF-8 ceiling accepts 262144 bytes and rejects the next byte before expansion', () => {
  const o=fixture(), codec=observedCodec(), prior=JSON.parse(oldScope(o))
  prior[4][0][0]=''
  const overhead=bytes(JSON.stringify(prior)), room=expandedCap-overhead
  const witness={}
  for (const extra of [0,1]) {
    const pattern='界甲乙丙丁戊己庚辛壬癸子丑寅卯辰', chars=Math.floor(room/3)
    prior[4][0][0]=pattern.repeat(Math.floor(chars/pattern.length))+pattern.slice(0,chars%pattern.length)+'a'.repeat(room%3+extra)
    const expanded=JSON.stringify(prior), scope=codec.pack(expanded)
    assert.equal(bytes(expanded),expandedCap+extra);assert.ok(bytes(scope)<=cap)
    const raw=JSON.stringify({namespace:purchaseNamespace,scope,bought:[0]}), s=memory(raw)
    assert.ok(bytes(raw)<=maxPurchaseBytes)
    const m=openPurchaseMarkers({...o,storage:()=>s})
    assert.deepEqual(m.snapshot(),{bought:[],persistent:extra===0})
    assert.equal(s.writes.length,0);assert.equal(s.values.get(key),raw)
    witness[extra]={expandedBytes:bytes(expanded),scopeBytes:bytes(scope),persistent:m.snapshot().persistent}
  }
  console.log('expandedCeiling='+JSON.stringify(witness))
})
