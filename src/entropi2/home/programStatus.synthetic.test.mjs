import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'

// Supplementary shallow hook host. Actual Home/model imports; this is not React.
const loader = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true,
    url: 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href)}; export const useMemo = fn => fn();`) }
  return next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const athlete = { id: 'synthetic-read-athlete' }
const week = { id: 'synthetic-read-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-read-session', weekday: 2, title: 'Syntetisk pas',
    exercises: [{ id: 'synthetic-read-exercise', sets: 1, name: 'Syntetisk løft' }] }] }
const pending = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function show(t, extra = {}) {
  const view = mount(Home, { enabled: true, athlete, now: new Date('2026-11-04T12:00:00Z'), storage: null,
    allWeeks: [week], currentWeek: week, exerciseLogs: [], onStartSession() {}, ...extra })
  t.after(() => view.unmount())
  return view
}
const button = (view, text) => view.nodes(n => n.type === 'button' && n.children.includes(text))[0]

test('initial loading hides empty messaging, stale session and weekly progress', t => {
  for (const allWeeks of [[], [week]]) {
    const view = show(t, { allWeeks, programLoading: true, programError: true })
    assert.match(view.text(), /Indlæser dit program/)
    assert.doesNotMatch(view.text(), /Intet program endnu|kunne ikke hentes|Uge 1|Ugen:|Syntetisk pas/)
    assert.equal(view.nodes(n => n.props['aria-busy'] === true).length, 1)
    assert.equal(button(view, 'Hent igen'), undefined)
    assert.equal(button(view, 'Start dagens pas'), undefined)
    assert.equal(view.nodes(n => n.props.role === 'alert').length, 0)
  }
})

test('double and retained retry clicks make one read and show loading until settlement', async t => {
  const deferred = pending(); let calls = 0
  const view = show(t, { programError: true, onRetryProgram: () => { calls++; return deferred.promise } })
  const retry = button(view, 'Hent igen')
  assert.equal(retry.props.type, 'button')
  assert.ok(retry.props.style.minHeight >= 44)
  const result = retry.props.onClick()
  await retry.props.onClick()
  view.render()
  assert.equal(calls, 1)
  assert.match(view.text(), /Indlæser dit program/)
  assert.doesNotMatch(view.text(), /kunne ikke hentes|Intet program endnu|Syntetisk pas/)
  assert.equal(button(view, 'Hent igen'), undefined)
  Object.assign(view.props, { programError: false, allWeeks: [], currentWeek: null })
  deferred.resolve(); await result; view.render()
  assert.match(view.text(), /Intet program endnu/)
  assert.doesNotMatch(view.text(), /Indlæser|kunne ikke hentes/)
})

test('guarded failures and thrown reads keep a generic alert and allow another attempt', async t => {
  let calls = 0
  const view = show(t, { programError: true, onRetryProgram: async () => {
    calls++
    if (calls === 1) throw Error('SYNTHETIC INTERNAL DETAIL')
    // A guarded read returns normally on failure, retaining programError.
  } })
  for (let i = 0; i < 2; i++) {
    await button(view, 'Hent igen').props.onClick(); view.render()
    assert.match(view.text(), /Programmet kunne ikke hentes.*Tjek din forbindelse/)
    assert.doesNotMatch(view.text(), /SYNTHETIC INTERNAL DETAIL|genindlæse|Intet program endnu/)
    assert.equal(view.nodes(n => n.props.role === 'alert').length, 1)
    assert.equal(button(view, 'Hent igen').props.disabled, false)
  }
  assert.equal(calls, 2)
})

test('successful retry restores start and week overview; the retry action then disappears', async t => {
  const view = show(t, { programError: true, onRetryProgram: async () => {
    view.props.programError = false
  } })
  await button(view, 'Hent igen').props.onClick(); view.render()
  assert.match(view.text(), /Syntetisk pas|Start dagens pas/)
  assert.ok(button(view, 'Start dagens pas'))
  assert.equal(button(view, 'Hent igen'), undefined)
  assert.equal(view.nodes(n => n.props['data-home-week-plan'] === '').length, 1)
})

test('offline recovery is explicit and missing retry capability remains disabled', t => {
  const view = show(t, { offlineSnapshotAt: 123 })
  assert.match(view.text(), /Opdatér programmet.*før du registrerer/)
  assert.equal(button(view, 'Hent igen').props.disabled, true)
  assert.equal(button(view, 'Start dagens pas'), undefined)
})

test('retained retry cannot act after OFF or athlete replacement', async t => {
  let calls = 0
  const view = show(t, { programError: true, onRetryProgram() { calls++ } })
  const retry = button(view, 'Hent igen').props.onClick
  view.render({ athlete: { id: 'synthetic-other-athlete' } })
  await retry()
  view.render({ enabled: false })
  await retry()
  assert.equal(calls, 0)
  assert.equal(view.tree, null)
})

test('pending completion after unmount cannot update the retired home', async t => {
  const deferred = pending()
  const view = show(t, { programError: true, onRetryProgram: () => deferred.promise })
  const result = button(view, 'Hent igen').props.onClick()
  view.unmount()
  const slots = JSON.stringify(view.slots)
  deferred.reject(Error('synthetic retired read'))
  await result
  assert.equal(JSON.stringify(view.slots), slots)
})
