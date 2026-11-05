import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'
import { manualClock, scores } from '../tracking/hurtig/testFixtures.mjs'
import { quickLogStatus } from './quickLogModel.mjs'

// Actual QuickLogs + merged controller/model; only the hook host and services
// are synthetic. Genuine React coverage lives in the .render/.react tests.
const componentUrl = new URL('./QuickLogs.mjs', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === componentUrl) return {
    url: new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href, shortCircuit: true,
  }
  return next(specifier, context)
} })
const { default: QuickLogs } = await import(componentUrl)
hooks.deregister()
const today = '2026-11-04', athlete = { id: 'synthetic-athlete' }
const empty = { sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] }
function fixture(t, extra = {}) {
  const time = manualClock(), calls = []
  const props = { enabled: true, athlete, today, getNow: () => new Date('2026-11-04T12:00:00Z'),
    quickClock: time.clock, weightLogs: [], weightInput: '', readinessLog: null, readinessInput: { ...empty },
    trackingData: { status: 'ready', complete: true, athleteId: athlete.id, today, readinessRows: [] }, ...extra }
  const set = key => value => { props[key] = typeof value === 'function' ? value(props[key]) : value }
  props.setWeightInput = set('weightInput'); props.setReadinessInput = set('readinessInput')
  props.saveReadiness ??= async () => { calls.push('readiness'); props.readinessLog = {
    athlete_id: athlete.id, logged_date: today, sleep_hours: props.readinessInput.sleep === '' ? null : Number(String(props.readinessInput.sleep).replace(',', '.')),
    ...Object.fromEntries(['energy', 'motivation', 'stress'].map(key => [key, Number(props.readinessInput[key])])),
    soreness_level: Number(props.readinessInput.soreness) } }
  props.logWeight ??= async () => { calls.push('weight'); props.weightInput = '' }
  const view = mount(QuickLogs, props)
  t.after(() => view.unmount())
  const button = label => view.nodes(n => n.type === 'button' && (n.props['aria-label'] === label || n.children.includes(label)))[0]
  const click = label => {
    const b = button(label); assert.ok(b, label); assert.ok(!b.props.disabled, label)
    b.props.onClick({ currentTarget: { focus() {} } }); view.render()
  }
  const submit = () => { const form = view.nodes(n => n.type === 'form')[0]; assert.ok(form)
    form.props.onSubmit({ preventDefault() {} }); view.render() }
  const fill = value => { view.nodes(n => n.type === 'input')[0].props.onChange({ target: { value } }); view.render() }
  const advance = async ms => { await time.advance(ms); view.render(); await time.advance(0); view.render() }
  return { view, props, calls, time, button, click, submit, fill, advance }
}

test('one row opens one form, preserving touch targets and existing drafts', t => {
  const f = fixture(t)
  assert.equal(f.view.nodes(n => n.type === 'button').length, 2)
  assert.equal(f.view.nodes(n => n.type === 'form').length, 0)
  f.click('Dagsform')
  assert.equal(f.view.nodes(n => n.type === 'fieldset').length, 4)
  assert.equal(f.view.nodes(n => n.props['aria-pressed'] !== undefined).length, 20)
  for (const b of f.view.nodes(n => n.type === 'button')) assert.ok(b.props.style.minHeight >= 44)
  f.click('Vægt i dag')
  assert.equal(f.view.nodes(n => n.type === 'form').length, 1)
  assert.equal(f.view.nodes(n => n.type === 'fieldset').length, 0)
})

test('yesterday is prefilled; repeat changes the selected domain only and never saves', t => {
  const f = fixture(t, { readinessInput: { ...empty, soreZones: ['synthetic-zone'] },
    trackingData: { status: 'ready', complete: true, athleteId: athlete.id, today,
      readinessRows: [{ athlete_id: athlete.id, logged_date: '2026-11-03', ...scores }] },
    weightLogs: [{ athlete_id: athlete.id, logged_at: '2026-11-03', weight: 80.2 }] })
  f.click('Dagsform')
  assert.equal(f.props.readinessInput.sleep, '7.5')
  assert.deepEqual(f.props.readinessInput.soreZones, ['synthetic-zone'])
  assert.match(f.view.text(), /Forslag fra i går/)
  f.click('Energi 5'); assert.equal(f.props.readinessInput.energy, '5')
  f.click('Samme som i går'); assert.equal(f.props.readinessInput.energy, '3')
  assert.equal(f.props.weightInput, '')
  f.click('Vægt i dag'); assert.equal(f.props.weightInput, '80.2')
  assert.deepEqual(f.calls, [])
})

test('manual draft wins over suggestions; unrelated/older/optimistic rows are never copied', t => {
  const f = fixture(t, { weightInput: '82,5', weightLogs: [
    { athlete_id: 'other', logged_at: '2026-11-03', weight: 99 },
    { athlete_id: athlete.id, logged_at: '2026-11-03', weight: 70, _optimistic: true },
    { athlete_id: athlete.id, logged_at: '2026-11-02', weight: 60 }] })
  f.click('Vægt i dag'); assert.equal(f.view.nodes(n => n.type === 'input')[0].props.value, '82,5')
  assert.equal(f.button('Samme som i går'), undefined)
})

test('undo before 5 s cancels every write and retains edits; double submit is held once', async t => {
  const f = fixture(t)
  f.click('Vægt i dag'); f.fill('82,5'); f.submit(); f.submit()
  assert.equal(f.time.handles(), 1)
  await f.advance(4999); assert.deepEqual(f.calls, [])
  f.click('Fortryd'); await f.advance(10000)
  assert.deepEqual(f.calls, []); assert.equal(f.props.weightInput, '82,5')
  assert.equal(f.time.handles(), 0); assert.match(f.view.text(), /Fortrudt/)
  f.submit(); await f.advance(5000)
  assert.deepEqual(f.calls, ['weight']); assert.match(f.view.text(), /Logget i dag/)
  f.click('Luk'); f.click('Vægt i dag · Logget i dag')
  assert.equal(f.view.nodes(n => n.type === 'form').length, 0)
})

test('readiness requires all scores and confirms an exact record after the delay', async t => {
  const f = fixture(t)
  f.click('Dagsform'); f.submit()
  assert.match(f.view.text(), /Vælg energi/); assert.equal(f.time.handles(), 0)
  for (const label of ['Energi', 'Motivation', 'Stress', 'Ømhed']) f.click(`${label} 3`)
  const submit = f.view.nodes(n => n.type === 'form')[0].props.onSubmit
  f.submit(); await f.advance(4999); assert.deepEqual(f.calls, [])
  await f.advance(1); assert.deepEqual(f.calls, ['readiness']); assert.match(f.view.text(), /Logget i dag/)
  submit({ preventDefault() {} }); await f.advance(5000); assert.deepEqual(f.calls, ['readiness'])
})

test('resolved failures and thrown errors preserve draft and permit retry without false success', async t => {
  for (const throws of [false, true]) {
    const f = fixture(t, { weightInput: '82,5', logWeight: async () => { if (throws) throw Error('synthetic failure') } })
    f.click('Vægt i dag'); f.submit(); await f.advance(5000)
    assert.doesNotMatch(f.view.text(), /Logget i dag|synthetic failure/)
    if (throws) assert.match(f.view.text(), /Kunne ikke bekræfte/)
    assert.equal(f.props.weightInput, '82,5')
    f.props.logWeight = async () => { f.props.weightInput = '' }
    f.submit(); await f.advance(5000); assert.match(f.view.text(), /Logget i dag/)
  }
})

test('an unrelated record or a changed parent draft cannot confirm or save this attempt', async t => {
  const f = fixture(t, { readinessInput: { ...empty, energy: 3, motivation: 3, stress: 3, soreness: 3 },
    saveReadiness: async () => { f.props.readinessLog = { athlete_id: 'other', logged_date: today } } })
  f.click('Dagsform'); f.submit(); await f.advance(5000)
  assert.match(f.view.text(), /Kunne ikke bekræfte/)
  const w = fixture(t, { weightInput: '82,5' }); w.click('Vægt i dag'); w.submit()
  w.props.weightInput = '99'; await w.advance(5000)
  assert.deepEqual(w.calls, []); assert.doesNotMatch(w.view.text(), /Logget i dag/)
})

test('pending and in-flight writes lock fields, close, switching and retained submit events', async t => {
  let resolve
  const f = fixture(t, { weightInput: '82,5', logWeight: () => new Promise(r => { resolve = r }) })
  f.click('Vægt i dag'); const oldClose = f.button('Luk').props.onClick
  f.submit(); oldClose(); f.view.render()
  assert.equal(f.view.nodes(n => n.type === 'form').length, 1)
  assert.ok(f.view.nodes(n => n.type === 'input').every(n => n.props.disabled))
  await f.advance(5000); assert.match(f.view.text(), /Gemmer/)
  f.props.weightInput = ''; resolve(); await f.advance(0)
  assert.match(f.view.text(), /Logget i dag/)
})

test('unmount, athlete replacement, OFF and Copenhagen midnight cancel delayed writes', async t => {
  for (const change of [f => f.view.unmount(), f => f.view.render({ athlete: { id: 'other' } }),
    f => f.view.render({ enabled: false }), f => { f.props.getNow = () => new Date('2026-11-04T23:00:00Z') }]) {
    const f = fixture(t, { weightInput: '82,5' }); f.click('Vægt i dag'); f.submit(); change(f)
    await f.advance(5000); assert.deepEqual(f.calls, []); assert.equal(f.time.handles(), 0)
  }
})

test('preview and disconnected Home expose no writing buttons; OFF reads no external records', t => {
  for (const extra of [{ sessionReadOnly: true }, { saveReadiness: false, logWeight: false }]) {
    const f = fixture(t, extra); assert.equal(f.view.tree, null)
  }
  for (const enabled of [false, undefined, 'true', 1]) {
    assert.equal(quickLogStatus({ enabled, get readinessLog() { assert.fail('OFF read') } }), null)
    const f = fixture(t, { enabled, readinessLog: new Proxy({}, { get() { assert.fail('OFF getter') } }) })
    assert.equal(f.view.tree, null)
  }
})

test('read loading/error never looks like an empty log, and weight reuses parent records', t => {
  const f = fixture(t, { trackingData: { status: 'loading' }, loadWeight() { assert.fail('no fetch') } })
  f.click('Dagsform'); assert.match(f.view.text(), /Henter/)
  f.view.render({ trackingData: { status: 'ready', complete: true, athleteId: athlete.id, today, readinessRows: [] } })
  f.view.render(); assert.equal(f.view.nodes(n => n.type === 'form').length, 1)
  f.click('Vægt i dag'); assert.equal(f.view.nodes(n => n.type === 'form').length, 1)
  const e = fixture(t, { trackingData: { status: 'error', athleteId: athlete.id, today } })
  e.click('Dagsform'); assert.match(e.view.text(), /kunne ikke hentes sikkert/)
  assert.equal(e.view.nodes(n => n.type === 'form').length, 0)
})


test('a server-confirmed today record from history blocks a duplicate readiness insert', t => {
  const f = fixture(t, { trackingData: { status: 'ready', complete: true, athleteId: athlete.id, today,
    readinessRows: [{ athlete_id: athlete.id, logged_date: today, ...scores }] } })
  f.click('Dagsform · Logget i dag')
  assert.match(f.view.text(), /Logget i dag/)
  assert.equal(f.view.nodes(n => n.type === 'form').length, 0)
  assert.deepEqual(f.calls, [])
})

test('retained form/input/close events cannot affect a newly opened controller', async t => {
  const f = fixture(t, { weightInput: '82,5' }); f.click('Vægt i dag')
  const oldForm = f.view.nodes(n => n.type === 'form')[0].props.onSubmit
  const oldInput = f.view.nodes(n => n.type === 'input')[0].props.onChange
  const oldClose = f.button('Luk').props.onClick
  f.click('Luk'); f.click('Vægt i dag')
  oldInput({ target: { value: '99' } }); oldForm({ preventDefault() {} }); oldClose(); f.view.render()
  assert.equal(f.props.weightInput, '82,5'); assert.equal(f.time.handles(), 0)
  assert.equal(f.view.nodes(n => n.type === 'form').length, 1)
  await f.advance(5000); assert.deepEqual(f.calls, [])
})

test('write capability removal during grace period prevents a service call', async t => {
  const f = fixture(t, { weightInput: '82,5' }); f.click('Vægt i dag'); f.submit()
  f.props.logWeight = undefined
  await f.advance(5000); assert.deepEqual(f.calls, [])
  assert.equal(f.time.handles(), 0)
})
