import './coachInactiveLoader.mjs'
import { registerHooks } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inactiveTraining, activityDay } from './coachInactive.mjs'
import { state } from './coachInactiveFake.mjs'
import { mount, button, nodes, text } from './coachInactiveDom.mjs'
const { lavLaesninger } = await import('./laesninger.js')
const { default: CoachActions } = await import('./CoachActions.jsx')
const root = new URL('./', import.meta.url)
const a = { id: 'a', name: 'A' }
const day = '2026-10-28'
const source = { state: 'ready', day, ids: ['a'], rows: [{ athlete_id: 'a', logged_at: '2026-10-25' }] }
const props = { enabled: true, athletes: [a], today: day, dataStatus: { calendar: 'ready', progress: 'ready', activity: source } }

test('rebase counter: default OFF handler is identical in calls and setters to explicit false', async () => {
  const runs = []
  for (const settings of [{}, { coachActions: false }]) {
    state.calls.length = 0; state.responses.length = 0
    const writes = []
    const handlers = lavLaesninger({ ...settings, setCoachActionsStatus() { throw Error('OFF write') }, setAthleteLastLogs: value => writes.push(value), setWeeklyActivity: value => writes.push(value) })
    state.responses.push({ data: source.rows })
    await handlers.fetchAthleteActivityLogs(['a'])
    runs.push(JSON.stringify({ calls: state.calls, writes }))
  }
  assert.equal(runs[0], runs[1])
  assert.equal(CoachActions({ athletes: new Proxy([], { get() { throw Error('OFF inspection') } }) }), null)
})

test('rebase counter: morning and activity opt-ins share one query and retain both snapshots', async () => {
  state.calls.length = 0; state.responses.length = 0
  let morning = {}, actions = {}
  const handlers = lavLaesninger({ coachActions: true, coachMorning: true,
    setCoachMorningData: fn => { morning = fn(morning) }, setCoachActionsStatus: fn => { actions = fn(actions) },
    setAthleteLastLogs() {}, setWeeklyActivity() {} })
  state.responses.push({ data: source.rows })
  await handlers.fetchAthleteActivityLogs(['a'])
  assert.equal(state.calls.length, 1)
  assert.equal(morning.logs.state, 'ready'); assert.equal(actions.activity.state, 'ready')
  assert.deepEqual(morning.logs.rows, actions.activity.rows)
  await handlers.fetchAthleteActivityLogs([])
  assert.equal(state.calls.length, 1)
})

test('rebase counter: stale snapshot cannot retain a clickable athlete after midnight', () => {
  const app = mount(CoachActions, props)
  button(app.render(), 'Ikke trænet i 3 dage').onClick()
  assert.equal(nodes(app.render(), n => n.type === 'li').length, 1)
  const tree = app.render({ ...props, today: '2026-10-29' })
  assert.equal(nodes(tree, n => n.type === 'li').length, 0)
  assert.match(text(tree), /1 med ukendt historik/)
})

test('rebase counter: every day of 2026 qualifies exactly three calendar days, even at DST', () => {
  for (let stamp = Date.UTC(2026, 0, 1); stamp < Date.UTC(2027, 0, 1); stamp += 86400000) {
    const today = new Date(stamp).toISOString().slice(0, 10)
    for (const days of [2, 3]) {
      const last = new Date(stamp - days * 86400000).toISOString().slice(0, 10)
      const model = inactiveTraining({ enabled: true, athletes: [a], today, source: { ...source, day: today, rows: [{ athlete_id: 'a', logged_at: last }] } })
      assert.equal(model.rows.length, days === 3 ? 1 : 0, today)
    }
  }
  assert.equal(activityDay('2026-10-25T22:59:59Z'), '2026-10-25')
  assert.equal(activityDay('2026-10-25T23:00:00Z'), '2026-10-26')
})

// Import the actual copied loader modules with registration captured and JSX
// helpers inert. No original test, JSX translator, app renderer or backend runs.
async function capture(relative, method = null) {
  const url = new URL(relative, root).href
  const hooks = []
  globalThis.__coach9Hooks = hooks
  const guard = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === url && specifier === 'node:module') return {
      url: 'data:text/javascript,export const registerHooks = h => { globalThis.__coach9Hooks.push(h); return {deregister(){}} }', shortCircuit: true,
    }
    if (context.parentURL === url && /Jsx\.mjs$/.test(specifier)) return {
      url: 'data:text/javascript,export const jsx = () => {throw Error("Original JSX helper forbidden")}', shortCircuit: true,
    }
    return next(specifier, context)
  } })
  try {
    const module = await import(url)
    if (method) await module[method]()
    assert.ok(hooks.length, relative)
    return hooks.at(-1)
  } finally { guard.deregister(); delete globalThis.__coach9Hooks }
}
const next = specifier => { throw Error('Unexpected fallthrough: ' + specifier) }

test('rebase counter: closed read loaders resolve new activity import to actual repository file', async () => {
  for (const name of ['coachWeekTestLoader.mjs', 'coachMeetLoader.mjs', 'coachMorningLoader.mjs', 'coachFourWeeksLoader.mjs', 'profileWeekHarness.mjs', '../fremgangLoader.mjs']) {
    const hooks = await capture('./' + name, ['coachWeekTestLoader.mjs', 'profileWeekHarness.mjs'].includes(name) ? null : 'install')
    const resolved = hooks.resolve('./coachInactive.mjs', { parentURL: new URL('./laesninger.js', root).href }, next)
    assert.equal(resolved.url, new URL('./coachInactive.mjs', root).href, name)
    assert.equal(resolved.shortCircuit, true)
  }
})

test('rebase counter: closed component loaders preserve exact filter/react edges and reject unknown imports', async () => {
  const hooks = await capture('./rebaseFollowUpLoader.mjs', 'install')
  const component = new URL('./CoachActions.jsx', root).href
  const filter = new URL('./coachInactiveFilter.mjs', root).href
  assert.equal(hooks.resolve('./coachInactiveFilter.mjs', { parentURL: component }, next).url, filter)
  assert.equal(hooks.resolve('./coachInactive.mjs', { parentURL: filter }, next).url, new URL('./coachInactive.mjs', root).href)
  assert.equal(hooks.resolve('react', { parentURL: filter }, next).url, new URL('./followUpDom.mjs', root).href)
  assert.throws(() => hooks.resolve('./unapproved.mjs', { parentURL: filter }, next), /Unapproved/)
  for (const name of ['coachRydHarness.mjs', 'coachRyd2Harness.mjs']) {
    const h = await capture('../' + name, 'app')
    const parentURL = 'coachryd-test://1/CoachActions.jsx'
    const f = h.resolve('./coachInactiveFilter.mjs', { parentURL }, next)
    assert.equal(f.url, 'coachryd-test://1/coachInactiveFilter.mjs')
    assert.match(h.load(f.url, {}, next).source, /export function CoachInactiveFilter/)
    assert.equal(h.resolve('./coachInactive.mjs', { parentURL: f.url }, next).url, 'coachryd-test://1/coachInactive.mjs')
    assert.throws(() => h.resolve('./unapproved.mjs', { parentURL: f.url }, next), /Unapproved/)
  }
  const legacyURL = new URL('./coachTemplateDom.mjs', root).href
  const filterURL = new URL('./coachInactiveFilter.mjs?legacy-counter', root).href
  const guard = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === filterURL && specifier === 'react') return { url: legacyURL, shortCircuit: true }
    return next(specifier, context)
  } })
  try {
    const legacy = await import(legacyURL)
    const { CoachInactiveFilter } = await import(filterURL)
    const app = legacy.mount(() => legacy.createElement(CoachInactiveFilter, { enabled: true }, legacy.createElement('p', null, 'Existing template actions')), {})
    const tree = app.render()
    assert.match(legacy.text(tree), /Existing template actions/)
    assert.equal(legacy.nodes(tree, n => n.type === 'button').length, 0)
  } finally { guard.deregister() }
})

test('rebase counter: newer imports, parameters, App prop order and unrelated loaders remain in base', () => {
  const reads = readFileSync(new URL('./laesninger.js', root), 'utf8')
  for (const expected of ["import { readMeetSource } from './coachMeetSource.mjs'", 'coachMeetSoon = false, setCoachMeetData = () => {},', 'fourWeekCapture, profileWeekCapture', 'readMeetSource(coachMeetSoon', 'readWeekData(coachWeekEnabled']) assert.ok(reads.includes(expected), expected)
  const app = readFileSync(new URL('../App.jsx', root), 'utf8')
  assert.match(app, /ugeLogget[^\n]*programNaesteUge/)
  for (const name of ['forenkl6Loader.mjs', 'vaerd5Loader.mjs', 'fokusLoader.mjs', 'frem3Loader.mjs']) {
    const code = readFileSync(new URL('../athlete/' + name, root), 'utf8')
    assert.doesNotMatch(code, /coachInactive|CoachActions|laesninger/)
  }
})
