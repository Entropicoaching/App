import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install, dashboardURL } from './coachMeetLoader.mjs'
import { state, reset, walk, text } from './coachMeetFake.mjs'
install()
const { CoachMeetSoon, coachMeetSoonFlag, meetSoonRows, meetToday, readMeetSource, COACH_MEET_SOON_ENABLED } = await import('./coachMeetSoon.mjs')
const { lavLaesninger } = await import('./laesninger.js')
const { default: ForsideView } = await import('./ForsideView.jsx')
const { default: ForsideBase } = await import('./ForsideBase.jsx')
await import(dashboardURL.href)
const now = new Date('2026-10-28T12:00:00Z')
const athlete = (id, date = '2026-11-11') => ({ id, name: id, competition_date: date })
const ready = rows => ({ state: 'ready', ids: ['Anna', 'Bo'], day: '2026-10-28', rows })
const week = { id: 'w', athlete_id: 'Anna', start_date: '2026-10-26', sessions: [{ id: 's1' }, { id: 's2' }] }
const log = (sid, extra = {}) => ({ athlete_id: 'Anna', logged_at: '2026-10-27T12:00:00Z', exercises: { sessions: { id: sid, weeks: { week_number: 1 } } }, ...extra })
const fixture = () => ({ plan: ready([week]), logs: ready([log('s1'), log('s1')]) })
const rows = data => meetSoonRows({ athletes: [athlete('Anna')], data, now })

test('inclusive 0 and 14 days, missing meet, 15 days, past, invalid dates and same day athletes', () => {
  const athletes = [athlete('Bo'), athlete('Anna'), athlete('Today', '2026-10-28'), athlete('None', null), athlete('Past', '2026-10-27'), athlete('Later', '2026-11-12'), athlete('Invalid', '2026-02-30'), athlete('Loose', '2026-11-1')]
  const result = meetSoonRows({ athletes, now })
  assert.deepEqual(result.map(r => [r.athlete.id, r.days]), [['Today', 0], ['Anna', 14], ['Bo', 14]])
  assert.deepEqual(meetSoonRows({ athletes: [], now }), [])
  assert.deepEqual(meetSoonRows({ athletes, now: new Date('invalid') }), [])
  assert.equal(meetSoonRows({ athletes: [athlete('Anna'), athlete('Anna'), { ...athlete('Hidden'), hidden: true }], now }).length, 1)
})
test('Copenhagen calendar days survive midnight, DST, month and year changes', () => {
  assert.equal(meetToday(new Date('2026-10-27T23:30:00Z')), '2026-10-28')
  for (const [today, date, expected] of [['2026-10-18T12:00:00Z','2026-11-01',14], ['2026-03-22T12:00:00Z','2026-04-05',14], ['2026-12-31T23:30:00Z','2027-01-01',0]]) {
    assert.equal(meetSoonRows({ athletes: [athlete('Anna', date)], now: new Date(today) })[0].days, expected)
  }
})
test('pas counts unique non-skipped sessions in the dated current plan only', () => {
  const data = fixture()
  assert.equal(rows(data)[0].status, 'Ugens pas: 1 af 2 logget')
  data.logs.rows.push(log('s2', { skipped: true }), log('foreign'), log('s2', { athlete_id: 'Bo' }), log('s2', { logged_at: '2026-10-25T12:00:00Z' }), log('s2', { logged_at: '2026-10-29T12:00:00Z' }))
  assert.equal(rows(data)[0].status, 'Ugens pas: 1 af 2 logget')
  data.logs.rows.push(log('s2'))
  assert.equal(rows(data)[0].status, 'Ugens pas: 2 af 2 logget (alle)')
  data.logs.rows = []
  assert.equal(rows(data)[0].status, 'Ugens pas: 0 af 2 logget')
})
test('failed, partial, stale, loading and foreign scope sources cannot claim all or zero', () => {
  for (const key of ['plan', 'logs']) {
    for (const patch of [{ state: 'error' }, { state: 'loading' }, { state: 'partial' }, { day: '2026-10-27' }, { ids: ['Bo'] }]) {
      const data = fixture(); Object.assign(data[key], patch)
      assert.equal(rows(data)[0].status, 'Ugens pas: ukendt')
    }
  }
  assert.equal(rows({})[0].status, 'Ugens pas: ukendt')
  const data = fixture(); data.logs.rows.push(log('s2', { logged_at: 'invalid' }))
  assert.equal(rows(data)[0].status, 'Ugens pas: ukendt')
  data.plan.rows = [week, { ...week, id: 'other' }]
  assert.equal(rows(data)[0].status, 'Ugens pas: ingen entydig ugeplan')
  data.plan.rows = []
  assert.equal(rows(data)[0].status, 'Ugens pas: ingen entydig ugeplan')
  data.plan.rows = [{ ...week, sessions: [] }]
  assert.equal(rows(data)[0].status, 'Ugens pas: ingen planlagte pas')
})
test('strict default OFF: no element, capture, timer or release flag activation', () => {
  assert.equal(COACH_MEET_SOON_ENABLED, false)
  for (const search of ['', '?rel1030=1', '?coachStaevne=0', '?coachStaevne=true', '?coachStaevne=1&coachStaevne=1', '?coachStaevne=1&coachStaevne=0']) assert.equal(coachMeetSoonFlag(search), false)
  assert.equal(coachMeetSoonFlag('?coachStaevne=1'), true)
  reset(); assert.equal(CoachMeetSoon({}), null); assert.equal(state.effects[0](), undefined)
  const original = Promise.resolve({ data: [] })
  assert.equal(readMeetSource(false, 'plan', [], () => assert.fail(), () => original), original)
})
test('synthetic DOM has athlete buttons and passes the original athlete to the profile handler', () => {
  reset(); state.values = [now]; const calls = [], athletes = [athlete('Bo'), athlete('Anna')]
  const tree = CoachMeetSoon({ enabled: true, athletes, data: fixture(), openProfile: (...args) => calls.push(args) })
  assert.match(text(tree), /14 dage til stævne/)
  assert.match(text(tree), /1 af 2 logget/)
  const buttons = walk(tree, n => n.type === 'button')
  assert.equal(buttons.length, 2)
  assert.ok(buttons.every(b => b.props.type === 'button' && b.props.style.minHeight >= 44))
  buttons.forEach(b => b.props.onClick())
  assert.deepEqual(calls, [[athletes[1], 'program', 'list'], [athletes[0], 'program', 'list']])
  for (const extra of [{ loading: true }, { loadError: true }]) {
    reset(); state.values = [now]
    assert.equal(walk(CoachMeetSoon({ enabled: true, athletes, ...extra }), n => n.type === 'button').length, 0)
  }
  reset(); state.values = [now]
  assert.match(text(CoachMeetSoon({ enabled: true, athletes: [] })), /Ingen atleter/)
  reset(); state.values = [now]
  assert.match(text(CoachMeetSoon({ enabled: true, athletes: [athlete('Today', '2026-10-28')] })), /Stævne i dag/)
})
test('actual Forside imports the block, excludes hidden athletes and preserves default OFF output', () => {
  const props = { athletes: [], hiddenAthleteIds: new Set(), calendarWeeks: {}, athleteCurrentWeek: {}, coachPriorityItems: [], coachBriefingSeen: {}, coachPriorityCount: 0 }
  const off = ForsideView(props)
  const snapshot = node => JSON.stringify(node, (key, value) => key === 'children' && Array.isArray(value) ? value.filter(v => v != null && v !== false) : value)
  assert.equal(snapshot(ForsideView({ ...props, coachMeetSoon: false })), snapshot(off))
  assert.equal(snapshot(off), snapshot(ForsideBase(props)))
  assert.equal(walk(off, n => n.type === CoachMeetSoon).length, 0)
  const athletes = [athlete('Anna'), athlete('Bo')]
  const on = ForsideView({ ...props, athletes, loading: true, hiddenAthleteIds: new Set(['Bo']), coachMeetSoon: true })
  const block = walk(on, n => n.type === CoachMeetSoon)
  assert.equal(block.length, 1); assert.deepEqual(block[0].props.athletes, [athletes[0]])
  const source = readFileSync(dashboardURL, 'utf8')
  assert.match(source, /const coachMeetSoon = coachMeetSoonFlag\(typeof window/)
  assert.match(source, /coachMeetSoon, setCoachMeetData,/)
  assert.match(source, /<ForsideView[^\n]+coachMeetSoon, coachMeetData/)
})
test('actual read handlers capture existing plan and log requests without extra reads', async () => {
  let data = {}, calls = [], result
  const setData = update => { data = update(data) }
  state.database = { from(table) {
    calls.push(table)
    const query = new Proxy({}, { get: (_, key) => key === 'then' ? (resolve, reject) => Promise.resolve(result).then(resolve, reject) : () => query })
    return query
  } }
  const noop = () => {}
  const props = new Proxy({ coachMeetSoon: true, setCoachMeetData: setData }, { get: (o, key) => key in o ? o[key] : noop })
  const reader = lavLaesninger(props)
  result = { data: [week], error: null }; await reader.fetchCalendarWeeks(['Anna'])
  assert.equal(data.plan.state, 'ready'); assert.equal(data.plan.rows[0], week)
  result = { data: [log('s1')], error: null }; await reader.fetchCalendarProgress(['Anna'])
  assert.equal(data.logs.state, 'ready'); assert.equal(data.logs.rows[0].athlete_id, 'Anna')
  assert.deepEqual(calls, ['weeks', 'exercise_logs'])
  result = { data: null, error: new Error('synthetic') }; await reader.fetchCalendarProgress(['Anna'])
  assert.equal(data.logs.state, 'error')
  const disabled = lavLaesninger(new Proxy({ coachMeetSoon: false, setCoachMeetData: () => assert.fail() }, { get: (o, key) => key in o ? o[key] : noop }))
  result = { data: [], error: null }; await disabled.fetchCalendarWeeks(['Anna']); await disabled.fetchCalendarProgress(['Anna'])
})
test('capture handles caps, thrown reads and out of order responses while retaining return contract', async () => {
  let data = {}; const setData = update => { data = update(data) }
  const result = { data: Array.from({ length: 1000 }, () => week), error: null }
  assert.equal(await readMeetSource(true, 'plan', ['Anna'], setData, () => result), result)
  assert.equal(data.plan.state, 'partial')
  const failure = new Error('synthetic')
  await assert.rejects(readMeetSource(true, 'logs', ['Anna'], setData, () => { throw failure }), error => error === failure)
  assert.equal(data.logs.state, 'error')
  let resolveOld
  const old = readMeetSource(true, 'logs', ['Anna'], setData, () => new Promise(resolve => { resolveOld = resolve }))
  await readMeetSource(true, 'logs', ['Bo'], setData, () => ({ data: [], error: null }))
  resolveOld({ data: [log('s1')], error: null }); await old
  assert.deepEqual(data.logs.ids, ['Bo']); assert.deepEqual(data.logs.rows, [])
})
