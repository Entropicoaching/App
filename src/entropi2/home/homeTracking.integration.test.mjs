import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createHost, descendants, textContent } from '../onboarding/firstVisitTestHost.mjs'
import { readHomeReadiness } from './homeTrackingRead.mjs'
import { manualClock, scores } from '../tracking/hurtig/testFixtures.mjs'

// Recursive synthetic event host; imports all actual Home children. Service
// access is injected and no default client, auth, browser or server is loaded.
const host = new URL('../onboarding/firstVisitTestHost.mjs', import.meta.url).href
const react = 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(host)};
  import { useState } from ${JSON.stringify(host)}; let next=0;
  export const useId=()=>useState(()=>'home-tracking-'+next++)[0];`)
const loader = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true, url: react }
  if (specifier.endsWith('/supabase.js')) throw Error('Forbidden real service import in synthetic tests')
  return next(specifier, context)
} })
const { default: Home } = await import('./AthleteHome.mjs')
test.after(() => loader.deregister())
const athlete = { id: 'synthetic-home', name: 'Testfornavn Testefternavn' }
const today = '2026-11-04', now = new Date('2026-11-04T12:00:00Z')
const row = logged_date => ({ athlete_id: athlete.id, logged_date, ...scores })
const ready = readinessRows => ({ status: 'ready', complete: true, athleteId: athlete.id, today, readinessRows })
const settle = async view => { for (let i=0;i<12;i++) await Promise.resolve(); view.render() }
const nodes = view => descendants(view.tree)
const find = (view, predicate) => nodes(view).find(predicate)
const button = (view, label) => find(view, n => n.type === 'button' && (n.props['aria-label'] === label || textContent(n) === label))
function show(t, extra = {}) {
  const calls = [], time = manualClock()
  const props = { enabled: true, athlete, now, getNow: () => now, allWeeks: [], exerciseLogs: [],
    readinessInput: { sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] },
    readinessLog: null, weightInput: '', weightLogs: [], quickClock: time.clock,
    storage: null, readHomeReadiness: async () => ready([row('2026-11-03')]),
    saveReadiness() { calls.push('readiness') }, logWeight() { calls.push('weight'); props.weightInput = '' }, ...extra }
  props.setReadinessInput = value => { props.readinessInput = typeof value === 'function' ? value(props.readinessInput) : value }
  props.setWeightInput = value => { props.weightInput = value }
  const view = createHost(Home, props)
  t.after(() => view.unmount())
  return { view, props, calls, time }
}

test('actual Home reads one scoped history, exposes selected quick form and adds a closed card at the bottom', async t => {
  let reads = 0
  const f = show(t, { readHomeReadiness: async scope => {
    reads++; assert.deepEqual(scope, { athleteId: athlete.id, today }); return ready([row('2026-11-03')])
  } })
  await settle(f.view)
  assert.equal(reads, 1)
  const card = find(f.view, n => Object.hasOwn(n.props, 'data-home-week-tracking'))
  assert.ok(card); assert.equal(card.type, 'details'); assert.equal(card.props.open, undefined)
  assert.equal(f.view.tree.children.filter(x => x && typeof x === 'object').at(-1), card)
  assert.equal(nodes(f.view).filter(n => n.type === 'summary' && textContent(n) === 'Ugen i korte træk').length, 1)
  assert.match(textContent(card), /1\/7 dage/); assert.match(textContent(card), /For lidt data/)
  assert.doesNotMatch(textContent(card), /0 pas|100 %|Kost i forhold/)
  assert.match(textContent(f.view.tree), /Dit overblik, Testfornavn/)
  assert.doesNotMatch(textContent(f.view.tree), /Testefternavn/)
  button(f.view, 'Dagsform').props.onClick({ currentTarget: { focus() {} } }); f.view.render(); f.view.render()
  assert.equal(f.props.readinessInput.energy, '3')
  assert.ok(button(f.view, 'Samme som i går'))
  assert.equal(reads, 1)
  button(f.view, 'Vægt i dag').props.onClick({ currentTarget: { focus() {} } }); f.view.render()
  find(f.view, n => n.type === 'input').props.onChange({ target: { value: '82,5' } }); f.view.render()
  find(f.view, n => n.type === 'form').props.onSubmit({ preventDefault() {} }); f.view.render()
  assert.deepEqual(f.calls, [])
  button(f.view, 'Fortryd').props.onClick(); f.view.render(); await f.time.advance(5000)
  assert.deepEqual(f.calls, []); assert.equal(f.time.handles(), 0)
})

test('empty, today-only, failed and malformed histories add no empty weekly card', async t => {
  for (const data of [ready([]), ready([row(today)]), { status: 'error', athleteId: athlete.id, today },
    ready([row('2026-11-03'), row('2026-11-03')])]) {
    const f = show(t, { readHomeReadiness: async () => data }); await settle(f.view)
    assert.equal(find(f.view, n => Object.hasOwn(n.props, 'data-home-week-tracking')), undefined)
  }
})

test('preview and OFF neither read history nor expose writing controls', async t => {
  for (const extra of [{ enabled: false }, { sessionReadOnly: true }, { saveReadiness: undefined, logWeight: undefined }]) {
    const f = show(t, { ...extra, readHomeReadiness() { assert.fail('preview/OFF history read') } })
    await settle(f.view)
    assert.equal(button(f.view, 'Dagsform'), undefined); assert.equal(button(f.view, 'Vægt i dag'), undefined)
    assert.deepEqual(f.calls, [])
  }
})

test('late source results after identity replacement, preview or day rollover cannot leak the previous card', async t => {
  for (const change of [p => ({ ...p, athlete: { id: 'synthetic-other' } }),
    p => ({ ...p, sessionReadOnly: true }), p => ({ ...p, now: new Date('2026-11-05T12:00:00Z') })]) {
    const pending = []
    const f = show(t, { readHomeReadiness: scope => new Promise(resolve => pending.push({ scope, resolve })) })
    await settle(f.view); assert.equal(pending.length, 1)
    f.view.render(change(f.props)); await settle(f.view)
    pending[0].resolve(ready([row('2026-11-03')]))
    await settle(f.view)
    assert.equal(find(f.view, n => Object.hasOwn(n.props, 'data-home-week-tracking')), undefined)
  }
})

test('actual scoped read through Home uses an injected synthetic service with whitelisted output', async t => {
  const calls = []
  const query = { then(resolve) { resolve({ data: [row('2026-11-03')], error: null }) } }
  for (const method of ['select','eq','gte','lte','order','limit']) query[method] = (...args) => { calls.push([method,...args]); return query }
  const client = { from(table) { assert.equal(table, 'readiness_logs'); return query } }
  const f = show(t, { readHomeReadiness: scope => readHomeReadiness({ ...scope, client }) })
  await settle(f.view)
  assert.ok(find(f.view, n => Object.hasOwn(n.props, 'data-home-week-tracking')))
  assert.deepEqual(calls.find(([name]) => name === 'eq'), ['eq','athlete_id',athlete.id])
})
