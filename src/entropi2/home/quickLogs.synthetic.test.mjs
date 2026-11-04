import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'
import { quickLogError, quickLogStatus } from './quickLogModel.mjs'

// Supplemental event checks, explicitly synthetic. Real React SSR is tested
// separately in quickLogs.render.test.mjs without any dependency substitution.
const componentUrl = new URL('./QuickLogs.mjs', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === componentUrl) return {
    url: new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href, shortCircuit: true,
  }
  return next(specifier, context)
} })
const { default: QuickLogs } = await import(componentUrl)
hooks.deregister()

const today = '2026-11-04'
const now = new Date('2026-11-04T12:00:00Z')
const athlete = { id: 'synthetic-athlete' }
const input = { sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] }
function fixture(t, extra = {}) {
  const props = { enabled: true, athlete, today, getNow: () => now, weightLogs: [], weightInput: '',
    readinessLog: null, readinessInput: { ...input }, saveReadiness() {}, logWeight() {}, loadWeight() {}, ...extra }
  const set = key => value => { props[key] = typeof value === 'function' ? value(props[key]) : value }
  props.setWeightInput = set('weightInput'); props.setReadinessInput = set('readinessInput')
  const view = mount(QuickLogs, props)
  t.after(() => view.unmount())
  const button = label => view.nodes(n => n.type === 'button' && (n.props['aria-label'] === label || n.children.includes(label)))[0]
  const click = label => {
    const b = button(label); assert.ok(b, label); assert.ok(!b.props.disabled, label)
    const result = b.props.onClick({ currentTarget: { focus() {} } }); view.render(); return result
  }
  const submit = async () => {
    const form = view.nodes(n => n.type === 'form')[0]; assert.ok(form)
    const result = form.props.onSubmit({ preventDefault() {} }); view.render(); await result; view.render()
  }
  const fill = value => { view.nodes(n => n.type === 'input')[0].props.onChange({ target: { value } }); view.render() }
  return { view, props, click, submit, fill, button }
}

test('empty home has one row, two large shortcuts, no reminder and no form until tapped', t => {
  const f = fixture(t)
  assert.equal(f.view.nodes(n => n.type === 'button').length, 2)
  assert.equal(f.view.nodes(n => n.type === 'form').length, 0)
  assert.doesNotMatch(f.view.text(), /Logget|påmind|check-in/)
  for (const b of f.view.nodes(n => n.type === 'button')) assert.ok(b.props.style.minHeight >= 44)
  f.click('Dagsform')
  assert.equal(f.view.nodes(n => n.type === 'fieldset').length, 4)
  assert.equal(f.view.nodes(n => n.type === 'button' && n.props['aria-pressed'] !== undefined).length, 20)
  for (const b of f.view.nodes(n => n.props['aria-pressed'] !== undefined)) {
    assert.ok(b.props.style.minHeight >= 44 && b.props.style.minWidth >= 44)
  }
  f.click('Vægt i dag')
  assert.equal(f.view.nodes(n => n.type === 'form').length, 1)
  assert.equal(f.view.nodes(n => n.type === 'fieldset').length, 0)
})

test('readiness validates empty data, preserves draft fields, uses existing callback and waits for a confirmed record', async t => {
  let calls = 0
  const f = fixture(t, { readinessInput: { ...input, soreZones: ['synthetic-zone'] } })
  f.props.saveReadiness = async () => { calls++; f.props.readinessLog = { athlete_id: athlete.id, logged_date: today } }
  f.click('Dagsform'); await f.submit()
  assert.equal(calls, 0); assert.match(f.view.text(), /Vælg et svar/)
  for (const name of ['Energi', 'Motivation', 'Stress', 'Ømhed']) f.click(`${name} 3`)
  assert.deepEqual(f.props.readinessInput.soreZones, ['synthetic-zone'])
  const retainedSubmit = f.view.nodes(n => n.type === 'form')[0].props.onSubmit
  await f.submit(); assert.equal(calls, 1); assert.match(f.view.text(), /Logget i dag/)
  await retainedSubmit({ preventDefault() {} }); assert.equal(calls, 1, 'confirmed readiness cannot be inserted again through an old form')
  assert.equal(f.view.nodes(n => n.type === 'form').length, 0)
  assert.match(f.button('Dagsform · Logget i dag').props['aria-label'], /Logget i dag/)
})

test('weight accepts comma decimals, confirms only input clear, and keeps the confirmation after close/reopen', async t => {
  let calls = 0
  const f = fixture(t)
  f.props.logWeight = async () => { calls++; assert.equal(f.props.weightInput, '82,5'); f.props.weightInput = '' }
  f.click('Vægt i dag'); await f.submit(); assert.equal(calls, 0)
  f.fill('82,5'); await f.submit(); assert.equal(calls, 1)
  assert.match(f.view.text(), /Logget i dag/)
  f.view.render(); f.click('Luk'); f.click('Vægt i dag · Logget i dag')
  assert.match(f.view.text(), /Logget i dag/)
})

test('resolved failed saves never fabricate completion; drafts remain and retry succeeds', async t => {
  for (const kind of ['weight', 'readiness']) {
    const f = fixture(t, { weightInput: '82,5', readinessInput: { ...input, energy: 3, motivation: 3, stress: 3, soreness: 3 } })
    f.click(kind === 'weight' ? 'Vægt i dag' : 'Dagsform'); await f.submit()
    assert.doesNotMatch(f.view.text(), /Logget i dag/)
    if (kind === 'readiness') assert.match(f.view.text(), /Kunne ikke gemme/)
    else assert.equal(f.view.nodes(n => n.props.role === 'alert').length, 0, 'weight handler supplies the flash')
    assert.equal(f.props.weightInput, '82,5')
    if (kind === 'weight') f.props.logWeight = async () => { f.props.weightInput = '' }
    else f.props.saveReadiness = async () => { f.props.readinessLog = { athlete_id: athlete.id, logged_date: today } }
    await f.submit(); assert.match(f.view.text(), /Logget i dag/)
  }
})

test('thrown errors are visible and permit retry; specific readiness error is retained', async t => {
  const f = fixture(t, { weightInput: '82,5', logWeight() { throw Error('synthetic failure') } })
  f.click('Vægt i dag'); await f.submit()
  assert.match(f.view.text(), /Kunne ikke gemme/); assert.doesNotMatch(f.view.text(), /synthetic failure/)
  assert.ok(!f.button('Gem').props.disabled)
  const r = fixture(t, { readinessError: 'Kunne ikke gemme parathed.', readinessInput: { ...input, energy: 3, motivation: 3, stress: 3, soreness: 3 } })
  r.click('Dagsform'); await r.submit(); assert.match(r.view.text(), /Kunne ikke gemme parathed/)
})

test('pending writes lock fields, duplicate submits, shortcuts and retained close events', async t => {
  let resolve, calls = 0
  const f = fixture(t, { weightInput: '82,5', logWeight: () => { calls++; return new Promise(r => { resolve = r }) } })
  f.click('Vægt i dag')
  const oldClose = f.button('Luk').props.onClick
  const form = f.view.nodes(n => n.type === 'form')[0]
  const p = form.props.onSubmit({ preventDefault() {} }); f.view.render()
  oldClose(); await form.props.onSubmit({ preventDefault() {} }); f.view.render()
  assert.equal(calls, 1); assert.match(f.view.text(), /Gemmer/)
  assert.ok(f.view.nodes(n => n.type === 'input').every(n => n.props.disabled))
  f.props.weightInput = ''; resolve(); await p; f.view.render()
  assert.match(f.view.text(), /Logget i dag/)
})

test('OFF and missing callbacks do not read logs, load weight, write or expose enabled controls', async t => {
  for (const enabled of [false, undefined, 'true', 1]) {
    assert.equal(quickLogStatus({ enabled, get readinessLog() { assert.fail('OFF model read') } }), null)
    const f = fixture(t, { enabled, readinessLog: new Proxy({}, { get() { assert.fail('OFF log read') } }), loadWeight() { assert.fail('OFF load') } })
    assert.equal(f.view.tree, null)
  }
  const f = fixture(t, { saveReadiness: undefined, logWeight: undefined })
  assert.ok(f.view.nodes(n => n.type === 'button').every(n => n.props.disabled))
  await Promise.resolve()
})

test('Copenhagen midnight and disposed retained events cannot write or alter drafts', async t => {
  for (const change of [f => { f.props.getNow = () => new Date('2026-11-04T23:00:00Z') }, f => f.view.unmount()]) {
    let calls = 0
    const f = fixture(t, { weightInput: '82,5', logWeight() { calls++ } })
    f.click('Vægt i dag')
    const form = f.view.nodes(n => n.type === 'form')[0], inputNode = f.view.nodes(n => n.type === 'input')[0]
    change(f)
    inputNode.props.onChange({ target: { value: '99' } })
    await form.props.onSubmit({ preventDefault() {} })
    assert.equal(calls, 0); assert.equal(f.props.weightInput, '82,5')
    if (f.props.getNow().toISOString().includes('23:00')) {
      f.view.render(); f.click('Luk')
      assert.equal(f.view.nodes(n => n.type === 'form').length, 0)
    }
  }
})

test('opening, rerendering and remounting Home reuse parent weight records without another fetch', async t => {
  let calls = 0
  const loadWeight = () => { calls++; throw Error('QuickLogs must never fetch weight') }
  const known = [{ athlete_id: athlete.id, logged_at: today, weight: 82.5 }]
  for (let visit = 0; visit < 3; visit++) {
    const f = fixture(t, { loadWeight, weightLogs: visit === 0 ? [] : known })
    f.click(visit === 0 ? 'Vægt i dag' : 'Vægt i dag · Logget i dag')
    f.click('Luk'); f.view.render()
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); f.view.render()
    assert.equal(calls, 0)
    if (visit > 0) assert.match(f.button('Vægt i dag · Logget i dag').props['aria-label'], /Logget i dag/)
    f.view.unmount()
  }
  const f = fixture(t, { loadWeight })
  f.view.render({ weightLogs: known })
  assert.match(f.button('Vægt i dag · Logget i dag').props['aria-label'], /Logget i dag/)
  assert.equal(calls, 0)
})

test('only confirmed records for this athlete and Copenhagen date count; malformed values are rejected', () => {
  const p = { enabled: true, athlete, today, weightLogs: [], readinessLog: null }
  for (const extra of [{ athlete_id: 'other' }, { logged_at: '2026-11-03', logged_date: '2026-11-03' }, { _optimistic: true }]) {
    assert.deepEqual(quickLogStatus({ ...p, readinessLog: { athlete_id: athlete.id, logged_date: today, ...extra },
      weightLogs: [{ athlete_id: athlete.id, logged_at: today, weight: 82.5, ...extra }] }), { readiness: false, weight: false })
  }
  for (const value of ['', 'bad', -1, 0, Infinity, '82kg', {}, null]) assert.ok(quickLogError('weight', { weightInput: value }))
  assert.equal(quickLogError('weight', { weightInput: '82,5' }), null)
  assert.ok(quickLogError('readiness', { readinessInput: { ...input, energy: 3, motivation: 3, stress: 3, soreness: 3, sleep: '25' } }))
})
