import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from '../../homeRo2Jsx.mjs'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'
import { manualClock } from '../tracking/hurtig/testFixtures.mjs'
import { resetFake, writes } from '../../appRev2Fakes.mjs'

// Import actual copied handlers. Only the service boundary and unrelated video
// renderers are inert. No production client, environment, browser or server.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier) || specifier.endsWith('/progressionState.js')) return {
      url: new URL('../../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true,
    }
    if (specifier === 'react') return { url: new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href, shortCircuit: true }
    if (context.parentURL?.endsWith('/beskederOgVaegt.jsx') &&
        ['./athleteAnalysisConclusion.mjs', './VideoFeedbackPlayback.jsx'].includes(specifier)) return {
      url: 'data:text/javascript,export default function UnusedVideo(){};export function VideoFeedbackPlayback(){}', shortCircuit: true,
    }
    if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.js', context.parentURL)
      if (existsSync(url)) return { url: url.href, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('/beskederOgVaegt.jsx')) return { format: 'module',
      source: 'const __h=()=>{throw Error("Unused video renderer")};\n' + jsx(readFileSync(new URL(url), 'utf8')), shortCircuit: true }
    return next(url, context)
  },
})
const { default: QuickLogs } = await import('./QuickLogs.mjs')
const { lavLaesninger } = await import('../../athlete/laesninger.js')
const { lavBeskederOgVaegt } = await import('../../athlete/beskederOgVaegt.jsx')
hooks.deregister()

test('actual existing handlers: readiness and weight success/failure feed the compact form without a new save path', async t => {
  const RealDate = globalThis.Date
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00Z'])) } }
  globalThis.localStorage = { removeItem() {}, getItem() { return null }, setItem() {} }
  t.after(() => { globalThis.Date = RealDate; delete globalThis.localStorage })
  for (const kind of ['readiness', 'weight']) for (const fail of [true, false]) {
    resetFake({ data: [], error: fail ? { message: 'synthetic error' } : null })
    const time = manualClock()
    const p = { quickClock: time.clock, enabled: true, athlete: { id: 'synthetic-athlete' }, today: '2026-11-04',
      getNow: () => new Date(), weightInput: '82,5', weightLogs: [], readinessLog: null,
      readinessInput: { sleep: '7,5', energy: 3, motivation: 3, stress: 3, soreness: 3, soreZones: [] } }
    for (const [key, setter] of [['weightInput','setWeightInput'], ['weightLogs','setWeightLogs'], ['savingWeight','setSavingWeight'],
      ['readinessInput','setReadinessInput'], ['readinessLog','setReadinessLog'], ['savingReadiness','setSavingReadiness'], ['readinessError','setReadinessError']])
      p[setter] = value => { p[key] = typeof value === 'function' ? value(p[key]) : value }
    const noop = () => {}
    const flashes = []
    p.saveReadiness = () => lavLaesninger(p).saveReadiness()
    p.logWeight = () => lavBeskederOgVaegt({ ...p, onReadError: () => noop, showFlash: (...args) => flashes.push(args) }).logWeight()
    const view = mount(QuickLogs, p)
    const btn = view.nodes(n => n.type === 'button' && n.children.includes(kind === 'weight' ? 'Vægt i dag' : 'Dagsform'))[0]
    btn.props.onClick({ currentTarget: { focus() {} } }); view.render()
    await view.nodes(n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} }); view.render()
    assert.equal(writes.length, 0, 'five-second grace period must precede any service write')
    await time.advance(5000); view.render()
    await time.advance(0); view.render()
    const table = kind === 'weight' ? 'weight_logs' : 'readiness_logs'
    const saved = writes.find(w => w.table === table)
    assert.ok(saved, table)
    assert.equal(saved.payload.athlete_id, p.athlete.id)
    assert.equal(saved.payload[kind === 'weight' ? 'logged_at' : 'logged_date'], p.today)
    if (fail) {
      assert.doesNotMatch(view.text(), /[Ll]ogget i dag|Energi [1-5]\/5/)
      const alerts = view.nodes(n => n.props.role === 'alert')
      assert.equal(flashes.length + alerts.length, 1, 'existing flash and local form must not duplicate the failure')
      if (kind === 'weight') {
        assert.equal(alerts.length, 0, 'the existing weight handler owns its resolved failure flash')
        assert.match(flashes[0][0], /Vægten blev ikke gemt/)
      } else assert.match(view.text(), /Kunne ikke gemme/)
      assert.equal(p.weightInput, '82,5')
    } else {
      assert.match(view.text(), kind === 'readiness' ? /Energi 3\/5 · logget i dag/ : /Logget i dag/)
      assert.equal(flashes.length, 0)
      if (kind === 'weight') assert.equal(saved.payload.weight, 82.5)
      else assert.equal(saved.payload.sleep_hours, 7.5)
    }
    view.unmount()
  }
})

test('one-tap Home uses actual readiness handler with all four scores, undo and existing connection failure', async t => {
  const RealDate = globalThis.Date
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00Z'])) } }
  globalThis.localStorage = { removeItem() {}, getItem() { return null }, setItem() {} }
  t.after(() => { globalThis.Date = RealDate; delete globalThis.localStorage })
  for (const fail of [true, false]) {
    resetFake({ data: [], error: fail ? { message: 'synthetic connection failure' } : null })
    const time = manualClock()
    const p = { enabled: true, athlete: { id: 'synthetic-athlete' }, today: '2026-11-04',
      getNow: () => new Date(), quickClock: time.clock, readinessLog: null,
      readinessInput: { sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] },
      trackingData: { status: 'ready', complete: true, athleteId: 'synthetic-athlete', today: '2026-11-04',
        readinessRows: [{ athlete_id: 'synthetic-athlete', logged_date: '2026-11-03',
          sleep_hours: 8, energy: 2, motivation: 4, stress: 2, soreness_level: 1 }] } }
    for (const [key, setter] of [['readinessInput', 'setReadinessInput'], ['readinessLog', 'setReadinessLog'],
      ['savingReadiness', 'setSavingReadiness'], ['readinessError', 'setReadinessError']])
      p[setter] = value => { p[key] = typeof value === 'function' ? value(p[key]) : value }
    p.saveReadiness = () => lavLaesninger(p).saveReadiness()
    const view = mount(QuickLogs, p)
    try {
      const click = label => {
        const button = view.nodes(n => n.type === 'button' && (n.props['aria-label'] === label || n.children.includes(label)))[0]
        assert.ok(button, label); button.props.onClick({ currentTarget: { focus() {} } }); view.render()
      }
      const submit = () => { view.nodes(n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} }); view.render() }
      click('Energi 5'); assert.equal(writes.length, 0)
      submit(); await time.advance(4999); view.render(); click('Fortryd')
      await time.advance(10000); assert.equal(writes.length, 0)
      submit(); await time.advance(5000); view.render(); await time.advance(0); view.render()
      const saved = writes.filter(w => w.table === 'readiness_logs')
      assert.equal(saved.length, 1)
      assert.deepEqual(Object.fromEntries(['athlete_id', 'logged_date', 'sleep_hours', 'energy', 'motivation', 'stress',
        'soreness_level', 'sore_zones'].map(key => [key, saved[0].payload[key]])), {
        athlete_id: p.athlete.id, logged_date: p.today, sleep_hours: null,
        energy: 5, motivation: 4, stress: 2, soreness_level: 1, sore_zones: null,
      })
      assert.equal(typeof saved[0].payload.readiness_score, 'number')
      if (fail) {
        assert.match(view.text(), /Tjek din forbindelse/); assert.doesNotMatch(view.text(), /[Ll]ogget i dag|Energi [1-5]\/5/)
        assert.equal(p.readinessInput.energy, '5')
      } else assert.match(view.text(), /Energi 5\/5 · logget i dag/)
    } finally { view.unmount() }
    assert.equal(time.handles(), 0)
  }
})
