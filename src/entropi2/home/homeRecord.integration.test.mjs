import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readHomeRecordHistory } from './homeRecordRead.mjs'
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

test('rejections, partial history and foreign results stay quiet; confirmed edits reuse history', async t => {
  for (const readHomeRecordHistory of [async () => { throw Error('synthetic') },
    async () => ({ ...history(), complete: false }), async () => ({ ...history(), athleteId: 'synthetic-other' })]) {
    const f = show(t, { readHomeRecordHistory }); await settle(f.view); assert.equal(card(f.view), undefined)
  }
  const f = show(t); await settle(f.view)
  f.view.render({ ...f.props, exerciseLogs: [row('synthetic-squat', 150)] })
  assert.match(textContent(card(f.view)), /150 kg/, 'current confirmed edits apply immediately without a reload')
  await settle(f.view)
  assert.equal(f.reads.length, 1)
  assert.match(textContent(card(f.view)), /150 kg/)
})

test('equivalent logs/week reuse history; calendar revalidation retains the card until a failure', async t => {
  const pending = []
  const read = () => new Promise((resolve, reject) => pending.push({ resolve, reject }))
  const f = show(t, { readHomeRecordHistory: read })
  await settle(f.view); pending.shift().resolve(history()); await settle(f.view)
  assert.ok(card(f.view))
  const week = { ...f.props.currentWeek }
  const next = { ...f.props, currentWeek: week, allWeeks: [week], exerciseLogs: [...f.props.exerciseLogs] }
  f.view.render(next)
  assert.ok(card(f.view), 'equivalent objects preserve the card')
  await settle(f.view)
  assert.ok(card(f.view), 'no asynchronous reload or blink')
  assert.equal(pending.length, 0, 'equivalent arrays and week object do not read')
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


test('twelve confirmed sets reuse one paginated history read, including cloned week objects', async t => {
  let historyReads = 0, pageReads = 0
  const client = { from(table) {
    assert.equal(table, 'exercise_logs')
    const query = {
      select() { return query },
      eq(column, value) { assert.equal(column, 'athlete_id'); assert.equal(value, athlete.id); return query },
      order() { return query },
      range(from) { pageReads++; return Promise.resolve({ data: from === 0 ? history().rows : [] }) },
    }
    return query
  } }
  const f = show(t, { exerciseLogs: [], readHomeRecordHistory: scope => {
    historyReads++
    return readHomeRecordHistory({ ...scope, client })
  } })
  const exercise = { ...f.props.currentWeek.sessions[0].exercises[0], sets: 12 }
  const week = { ...f.props.currentWeek, sessions: [{ ...f.props.currentWeek.sessions[0], exercises: [exercise] }] }
  f.view.render({ ...f.props, currentWeek: week, allWeeks: [week] })
  await settle(f.view)
  assert.equal(card(f.view), undefined)
  const logs = []
  for (let set = 1; set <= 12; set++) {
    logs.push({ ...row('synthetic-squat', 140), set_number: set })
    const clone = { ...week }
    f.view.render({ ...f.props, currentWeek: clone, allWeeks: [clone], exerciseLogs: [...logs] })
    assert.equal(Boolean(card(f.view)), set === 12, 'completion updates synchronously with the confirmed set')
    await settle(f.view)
    assert.equal(Boolean(card(f.view)), set === 12)
  }
  t.diagnostic(`12 confirmed sets: history reads=${historyReads}; page reads=${pageReads}`)
  assert.equal(historyReads, 1, 'sets and equivalent week objects do not fetch history')
  assert.equal(pageReads, 2, 'one synthetic data page and its terminal empty page')
  assert.match(textContent(card(f.view)), /140 kg/)
})


test('sets arriving during the initial history read use latest local confirmations without restarting it', async t => {
  let reads = 0, resolve
  const f = show(t, { exerciseLogs: [], readHomeRecordHistory: () => {
    reads++
    return new Promise(r => { resolve = r })
  } })
  await settle(f.view)
  const props = { ...f.props, exerciseLogs: [row('synthetic-squat', 150)] }
  f.view.render(props); await settle(f.view)
  assert.equal(card(f.view), undefined, 'no celebration until baseline has loaded')
  assert.equal(reads, 1, 'local confirmations do not cancel the initial baseline read')
  resolve(history()); await settle(f.view)
  assert.match(textContent(card(f.view)), /150 kg/)
})

test('pending, queued, failed, parked, edited and undone sets never need a history reload', async t => {
  const f = show(t); await settle(f.view)
  for (const extra of [
    { exerciseLogs: [{ ...row('synthetic-squat', 150), pending: true }] },
    { exerciseLogs: [{ ...row('synthetic-squat', 150), _optimistic: true }] },
    { exerciseLogs: [row('synthetic-squat', 150)], pendingSyncKeys: ['synthetic-squat_1'] },
    { exerciseLogs: [row('synthetic-squat', 150)], parkedSets: [{ exerciseId: 'synthetic-squat', setNumber: 1 }] },
    { exerciseLogs: [row('synthetic-squat', 150)], exerciseLogsError: true },
    { exerciseLogs: [row('synthetic-squat', 120)] },
    { exerciseLogs: [] },
  ]) {
    f.view.render({ ...f.props, ...extra }); await settle(f.view)
    assert.equal(card(f.view), undefined)
    f.view.render({ ...f.props, exerciseLogs: [row('synthetic-squat', 150)] })
    assert.match(textContent(card(f.view)), /150 kg/)
    await settle(f.view)
    assert.equal(f.reads.length, 1)
  }
})

test('later sessions use confirmed local baseline even when the initial history was empty', async t => {
  const f = show(t, { exerciseLogs: [], readHomeRecordHistory: async () => ({ ...history(), rows: [] }) })
  const week = { ...f.props.currentWeek, sessions: [...f.props.currentWeek.sessions,
    { id: 'synthetic-second-session', exercises: [{ id: 'synthetic-second-squat', name: 'Squat', sets: 1 }] }] }
  const first = row('synthetic-squat', 140), second = row('synthetic-second-squat', 150, '2026-11-05T10:00:00Z')
  await settle(f.view)
  const props = { ...f.props, currentWeek: week, allWeeks: [week], exerciseLogs: [first] }
  f.view.render(props); await settle(f.view)
  assert.equal(card(f.view), undefined, 'first registration establishes only a baseline')
  f.view.render({ ...props, exerciseLogs: [first, second] }); await settle(f.view)
  assert.match(textContent(card(f.view)), /150 kg/)
})

test('history revalidates on a different week id or reader, and ignores replaced in-flight requests', async t => {
  const pending = []
  const f = show(t, { readHomeRecordHistory: () => new Promise(resolve => pending.push(resolve)) })
  await settle(f.view)
  const week = { ...f.props.currentWeek, id: 'synthetic-other-week' }
  const next = { ...f.props, currentWeek: week, allWeeks: [week] }
  f.view.render(next); await settle(f.view)
  assert.equal(pending.length, 2, 'week id changes fetch even within the same day')
  pending[0](history()); await settle(f.view)
  assert.equal(card(f.view), undefined, 'replaced week request must not populate the baseline')
  pending[1](history()); await settle(f.view)
  assert.ok(card(f.view))
  let readerCalls = 0
  f.view.render({ ...next, readHomeRecordHistory: async () => { readerCalls++; return { status: 'error' } } })
  assert.equal(card(f.view), undefined, 'different reader cannot reuse the old success')
  await settle(f.view); assert.equal(readerCalls, 1); assert.equal(card(f.view), undefined)
})
