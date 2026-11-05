import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createHost, descendants, textContent } from '../onboarding/firstVisitTestHost.mjs'

// Supplementary event/effect fixture around actual copied Home and children.
// This is deliberately separate from genuine React rendering below.
const host = new URL('../onboarding/firstVisitTestHost.mjs', import.meta.url).href
const react = 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(host)};
  import {useRef} from ${JSON.stringify(host)};
  export function useMemo(fn,deps) {
    const ref=useRef();
    if (!ref.current || deps.some((v,i)=>!Object.is(v,ref.current.deps[i]))) ref.current={deps,value:fn()};
    return ref.current.value;
  }
  import {useState} from ${JSON.stringify(host)};let n=0;export const useId=()=>useState(()=>'record-'+n++)[0];`)
const loader = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true, url: react }
  if (specifier.endsWith('/supabase.js')) throw Error('Real service forbidden in synthetic fixture')
  return next(specifier, context)
} })
const { default: Home } = await import('./AthleteHome.mjs')
test.after(() => loader.deregister())
const athlete = { id: 'synthetic-owner' }, now = new Date('2026-11-05T12:00:00Z')
const row = (exercise_id, weight, logged_at = '2026-11-04T10:00:00Z') => ({
  athlete_id: athlete.id, exercise_id, set_number: 1, weight, reps_completed: 3, skipped: false, logged_at,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } },
})
const history = () => ({ status: 'ready', complete: true, athleteId: athlete.id,
  rows: [row('synthetic-old', 130, '2026-10-01T10:00:00Z')] })
const settle = async view => { for (let i = 0; i < 15; i++) await Promise.resolve(); view.render() }
const card = view => descendants(view.tree).find(n => Object.hasOwn(n.props, 'data-home-record'))
function show(t, extra = {}) {
  const reads = []
  const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ id: 'synthetic-session', exercises: [{ id: 'synthetic-squat', name: 'Squat', sets: 1 }] }] }
  const props = { enabled: true, athlete, now, currentWeek: week, allWeeks: [week],
    exerciseLogs: [row('synthetic-squat', 140)], onLogSet() {}, setLogInputs() {}, storage: null,
    readHomeRecordHistory: async scope => { reads.push(scope); return history() }, ...extra }
  const view = createHost(Home, props)
  t.after(() => view.unmount())
  return { view, props, reads }
}

test('actual Home reads own history, presents one small dated card below the weekly line and expires while mounted', async t => {
  const f = show(t)
  assert.equal(card(f.view), undefined)
  await settle(f.view)
  assert.deepEqual(f.reads, [{ athleteId: athlete.id }])
  assert.equal(descendants(f.view.tree).filter(n => Object.hasOwn(n.props, 'data-home-record')).length, 1)
  assert.match(textContent(card(f.view)), /Ny rekord: Squat 140 kg × 3.*4\. nov\./)
  assert.equal(descendants(card(f.view)).find(n => n.type === 'time').props.dateTime, '2026-11-04')
  const children = f.view.tree.children
  assert.ok(children.indexOf(card(f.view)) > children.findIndex(n => n?.props && Object.hasOwn(n.props, 'data-week-sessions')))
  assert.equal(descendants(card(f.view)).some(n => n.type === 'button' || n.type === 'canvas'), false)
  f.view.render({ ...f.props, now: new Date('2026-11-07T10:00:00Z') })
  assert.equal(card(f.view), undefined)
})

test('actual Home never reads record history in OFF, preview, offline, error or without own logging capability', async t => {
  for (const extra of [{ enabled: false }, { sessionReadOnly: true }, { readOnly: true },
    { onLogSet: undefined }, { setLogInputs: undefined }, { programError: true }, { offlineSnapshotAt: 'synthetic' }]) {
    const f = show(t, { ...extra, readHomeRecordHistory() { assert.fail('forbidden history read') } })
    await settle(f.view); assert.equal(card(f.view), undefined)
  }
})

test('late reads cannot restore cards after identity/preview/day changes, local undo or unmount', async t => {
  for (const change of [p => ({ ...p, athlete: { id: 'synthetic-other' } }),
    p => ({ ...p, sessionReadOnly: true }), p => ({ ...p, now: new Date('2026-11-08T12:00:00Z') }),
    p => ({ ...p, exerciseLogs: [] }), p => ({ ...p, enabled: false })]) {
    const pending = []
    const f = show(t, { readHomeRecordHistory: scope => new Promise(resolve => pending.push({ scope, resolve })) })
    await settle(f.view)
    f.view.render(change(f.props)); await settle(f.view)
    pending[0].resolve(history()); await settle(f.view)
    assert.equal(card(f.view), undefined)
  }
  let resolve
  const f = show(t, { readHomeRecordHistory: () => new Promise(r => { resolve = r }) })
  await settle(f.view); f.view.unmount(); resolve(history())
  for (let i = 0; i < 15; i++) await Promise.resolve()
  assert.equal(f.view.tree, null)
})

test('rejections, partial history and foreign results stay quiet; changed confirmed logs refetch', async t => {
  for (const readHomeRecordHistory of [async () => { throw Error('synthetic') },
    async () => ({ ...history(), complete: false }), async () => ({ ...history(), athleteId: 'synthetic-other' })]) {
    const f = show(t, { readHomeRecordHistory }); await settle(f.view); assert.equal(card(f.view), undefined)
  }
  const f = show(t); await settle(f.view)
  f.view.render({ ...f.props, exerciseLogs: [row('synthetic-squat', 150)] })
  assert.match(textContent(card(f.view)), /150 kg/, 'current confirmed edits apply immediately during reload')
  await settle(f.view)
  assert.equal(f.reads.length, 2)
  assert.match(textContent(card(f.view)), /150 kg/)
})

test('reloads retain a confirmed card across equivalent logs/week and date changes, then hide on failure', async t => {
  const pending = []
  const read = () => new Promise((resolve, reject) => pending.push({ resolve, reject }))
  const f = show(t, { readHomeRecordHistory: read })
  await settle(f.view); pending.shift().resolve(history()); await settle(f.view)
  assert.ok(card(f.view))
  const week = { ...f.props.currentWeek }
  const next = { ...f.props, currentWeek: week, allWeeks: [week], exerciseLogs: [...f.props.exerciseLogs] }
  f.view.render(next)
  assert.ok(card(f.view), 'first render of reload')
  await settle(f.view)
  assert.ok(card(f.view), 'while reload is unresolved')
  pending.shift().resolve(history()); await settle(f.view)
  assert.ok(card(f.view))
  f.view.render({ ...next, now: new Date('2026-11-06T00:00:00Z') })
  await settle(f.view); assert.ok(card(f.view), 'calendar rollover while revalidating')
  pending.shift().reject(Error('synthetic failed reload')); await settle(f.view)
  assert.equal(card(f.view), undefined, 'failed verification cannot retain a stale success')
})

test('actual Home memoizes history across clock/irrelevant renders while expiry stays live', async t => {
  let rowReads = 0
  const data = history(), rows = data.rows
  Object.defineProperty(data, 'rows', { get() { rowReads++; return rows } })
  const f = show(t, { readHomeRecordHistory: async () => data })
  await settle(f.view)
  const before = rowReads
  assert.ok(before > 0); assert.ok(card(f.view))
  for (let i = 1; i <= 20; i++) {
    f.view.render({ ...f.props, messages: [], now: new Date(now.getTime() + i * 30000) })
    assert.ok(card(f.view))
  }
  assert.equal(rowReads, before, 'no history calculation on clock/message renders')
  assert.equal(f.reads.length, 0, 'custom reader used')
  f.view.render({ ...f.props, now: new Date('2026-11-07T09:59:59.999Z') })
  await settle(f.view)
  const onExpiryDay = rowReads
  assert.ok(card(f.view))
  f.view.render({ ...f.props, now: new Date('2026-11-07T10:00:00Z') })
  assert.equal(card(f.view), undefined)
  assert.equal(rowReads, onExpiryDay, 'exact 72-hour expiry needs no new calculation')
})

test('loaded cards disappear immediately on OFF/preview, identity change, errors, pending slots and undo', async t => {
  for (const extra of [{ enabled: false }, { sessionReadOnly: true }, { readOnly: true },
    { athlete: { id: 'synthetic-other' } }, { exerciseLogs: [] }, { exerciseLogsError: true },
    { exerciseLogsLoading: true }, { programError: true }, { offlineSnapshotAt: 'synthetic' },
    { pendingSyncKeys: ['synthetic-squat_1'] }, { parkedSets: [{ exerciseId: 'synthetic-squat', setNumber: 1 }] }]) {
    const f = show(t); await settle(f.view); assert.ok(card(f.view))
    f.view.render({ ...f.props, ...extra })
    assert.equal(card(f.view), undefined)
  }
})
