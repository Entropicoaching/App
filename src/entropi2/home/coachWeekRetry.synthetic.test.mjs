import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'

// Actual Home/model imports with the existing shallow lifecycle fixture.
// Synthetic event coverage supplements the separate genuine React gate.
const host = new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true, url: 'data:text/javascript,' +
    encodeURIComponent(`export * from ${JSON.stringify(host)}; export const useMemo = fn => fn();`) }
  return next(specifier, context)
} })
test.after(() => hooks.deregister())
const { default: Home } = await import('./AthleteHome.mjs')
const athlete = { id: 'synthetic-week-athlete' }
const week = { id: 'synthetic-old-week', athlete_id: athlete.id, week_number: 1, start_date: '2026-11-02',
  sessions: [{ id: 'synthetic-old-session', exercises: [{ id: 'synthetic-old-exercise', name: 'Testløft', sets: 1 }] }] }
const nextWeek = { ...week, id: 'synthetic-new-week', week_number: 2, start_date: '2026-11-09',
  sessions: [{ id: 'synthetic-new-session', exercises: [{ id: 'synthetic-new-exercise', name: 'Testløft', sets: 1 }] }] }
const pending = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const button = (view, label) => view.nodes(n => n.type === 'button' && n.children.includes(label))[0]
const start = view => button(view, 'Start dagens pas') ?? button(view, 'Start næste pas')
function show(t, extra = {}) {
  const view = mount(Home, { enabled: true, athlete, coachOwnTraining: true, sessionReadOnly: false,
    allWeeks: [week, nextWeek], currentWeek: week, now: new Date('2026-11-10T12:00:00Z'),
    exerciseLogs: [], storage: null, onStartSession() { assert.fail('stale program must not start') }, ...extra })
  t.after(() => view.unmount())
  return view
}

test('week change: one explicit read, visible busy button and no start until the host delivers the chosen week', async t => {
  const deferred = pending(); let reads = 0; const starts = []
  const view = show(t, { onRetryProgram() { reads++; return deferred.promise },
    onStartSession: (...args) => starts.push(args) })
  const blockedStart = start(view)
  assert.equal(blockedStart.props.disabled, true)
  assert.equal(blockedStart.props.onClick(), false, 'retained event also respects the week lock')
  assert.match(view.text(), /En ny uge er startet.*Hent programmet igen/)
  const retry = button(view, 'Hent igen')
  assert.equal(retry.props.disabled, false)
  const result = retry.props.onClick()
  await retry.props.onClick()
  view.render()
  assert.equal(reads, 1)
  assert.equal(button(view, 'Henter…').props.disabled, true)
  await button(view, 'Henter…').props.onClick()
  assert.equal(reads, 1)
  assert.equal(start(view), undefined)
  deferred.resolve(); await result; view.render()
  assert.equal(start(view).props.disabled, true, 'a fulfilled read alone never unlocks start')
  assert.equal(start(view).props.onClick(), false)
  assert.ok(button(view, 'Hent igen'))
  assert.deepEqual(starts, [])
  view.render({ currentWeek: nextWeek })
  assert.equal(start(view).props.disabled, false)
  assert.equal(button(view, 'Hent igen'), undefined)
  start(view).props.onClick()
  assert.deepEqual(starts, [[nextWeek.sessions[0].id, nextWeek.id]])
})

test('week change: a rejected read shows a local generic error and allows a successful new attempt', async t => {
  let reads = 0
  const view = show(t, { onRetryProgram: async () => {
    if (++reads === 1) throw Error('SYNTHETIC INTERNAL DETAIL')
    view.props.currentWeek = nextWeek
  } })
  await button(view, 'Hent igen').props.onClick(); view.render()
  assert.equal(start(view), undefined)
  assert.equal(view.nodes(n => n.props.role === 'alert').length, 1)
  assert.match(view.text(), /Programmet kunne ikke hentes.*prøv igen/)
  assert.doesNotMatch(view.text(), /SYNTHETIC INTERNAL DETAIL/)
  assert.equal(button(view, 'Hent igen').props.disabled, false)
  await button(view, 'Hent igen').props.onClick(); view.render()
  assert.equal(reads, 2)
  assert.equal(start(view).props.disabled, false)
  assert.equal(button(view, 'Hent igen'), undefined)
})

test('week change: host-reported error and loading remain authoritative', async t => {
  const view = show(t, { onRetryProgram: async () => { view.props.programError = true } })
  await button(view, 'Hent igen').props.onClick(); view.render()
  assert.equal(start(view), undefined)
  assert.match(view.text(), /Programmet kunne ikke hentes/)
  view.render({ programError: false, programLoading: true })
  assert.equal(start(view), undefined)
  assert.equal(button(view, 'Hent igen'), undefined)
  view.render({ programLoading: false })
  assert.equal(start(view).props.disabled, true)
})

test('week change: retry is confined to confirmed own coach training; missing capability stays disabled', t => {
  for (const extra of [{ coachOwnTraining: false }, { coachOwnTraining: 'true' },
    { coachOwnTraining: undefined }, { sessionReadOnly: true }]) {
    const view = show(t, { onRetryProgram() { assert.fail('no automatic retry') }, ...extra })
    assert.equal(button(view, 'Hent igen'), undefined)
    if (extra.sessionReadOnly) assert.equal(start(view), undefined)
    else assert.match(view.text(), /Genindlæs siden/)
  }
  assert.equal(button(show(t), 'Hent igen').props.disabled, true)
  const off = show(t, { enabled: false })
  assert.equal(off.tree, null)
})

test('week change: a retained retry cannot fetch after preview, identity or OFF changes', async t => {
  for (const extra of [{ coachOwnTraining: false, sessionReadOnly: true },
    { athlete: { id: 'synthetic-other' } }, { enabled: false }]) {
    let reads = 0
    const view = show(t, { onRetryProgram: () => reads++ })
    const retry = button(view, 'Hent igen').props.onClick
    view.render(extra)
    assert.equal(await retry(), false)
    assert.equal(reads, 0)
  }
})

test('week change: pending completion after unmount cannot change retired state', async t => {
  const deferred = pending()
  const view = show(t, { onRetryProgram: () => deferred.promise })
  const result = button(view, 'Hent igen').props.onClick()
  view.unmount()
  const slots = JSON.stringify(view.slots)
  deferred.reject(Error('synthetic unmounted read'))
  await result
  assert.equal(JSON.stringify(view.slots), slots)
})
