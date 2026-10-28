import test from 'node:test'
import assert from 'node:assert/strict'
import { coachWeekFlag, DEFAULT_COACH_WEEK_OVERVIEW, addWeekRpe, weekRows, renderWeekOverview } from './coachWeekOverview.mjs'
import { readerFixture } from './coachWeekReaderFixture.mjs'
import { element } from './syntheticDom.mjs'
const athlete = (id, name = id) => ({ id, name })
const entry = (id, week = 3, planned = 12) => ({ athlete: athlete(id), current: { week_number: week, planned_sets: planned } })
const log = (id, week, extra = {}) => ({ athlete_id: id, logged_at: new Date().toISOString(),
  exercises: { reps: '5', sessions: { id: id+week, session_order: 1, weeks: { week_number: week } } }, ...extra })

test('flag is off by default and requires exact coachUge=1', () => {
  assert.equal(DEFAULT_COACH_WEEK_OVERVIEW, false)
  for (const search of ['', '?coachUge=0', '?coachUge=true', '?xcoachUge=1']) assert.equal(coachWeekFlag(search), false)
  assert.equal(coachWeekFlag('?coachUge=1'), true)
  assert.equal(renderWeekOverview(() => { throw Error('must not render') }, {}), null)
  assert.equal(renderWeekOverview(element, { enabled: 'true' }), null)
})

test('real readers use existing calls, aggregate per athlete/week and pair RPE', async () => {
  const f = await readerFixture({ weeks: [{ athlete_id: 'a', id: 'w', week_number: 3,
    sessions: [{ exercises: [{ sets: 4, reps: '5', recommended_weight: 100 }] }] }],
  exercise_logs: [log('a', 3, { rpe_actual: 9, rpe_planned: 7 }),
    log('a', 3, { skipped: true, rpe_actual: 10, rpe_planned: 1 }),
    log('a', 2, { rpe_actual: 10, rpe_planned: 6 }), log('b', 3, { rpe_actual: 6, rpe_planned: 7 }), log('a', 3)] })
  await f.reader.fetchCalendarWeeks(['a','b']); await f.reader.fetchCalendarProgress(['a','b'])
  assert.deepEqual(f.calls.map(c => c.table), ['weeks','exercise_logs'])
  assert.equal(f.calls[1].select[0].startsWith('rpe_actual, rpe_planned, '), true)
  assert.equal(f.values.CalendarWeeks.a[0].planned_sets, 4)
  const rows = weekRows([entry('a'),entry('b')], f.values.AthleteWeekCompletion).sort((a,b) => a.athlete.id.localeCompare(b.athlete.id))
  assert.equal(rows[0].athlete.id, 'a'); assert.equal(rows[0].logged, 2)
  assert.equal(rows[0].missed, 1); assert.equal(rows[0].rpe, 2); assert.equal(rows[0].rpeCount, 1)
  assert.equal(rows[1].rpe, -1)
  assert.deepEqual(f.statuses, { plan: 'ready', logs: 'ready' })
})

test('off reader keeps legacy projection and completion shape', async () => {
  const f = await readerFixture({ exercise_logs: [log('a', 3, { rpe_actual: 9, rpe_planned: 7 })] }, { enabled: false })
  await f.reader.fetchCalendarProgress(['a'])
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].select[0].includes('rpe_'), false)
  assert.equal('rpeCount' in f.values.AthleteWeekCompletion.a[3], false)
  assert.deepEqual(f.statuses, {})
})

test('missing, blank, boolean, zero and out of range RPE never become zero drift', () => {
  for (const value of [null, undefined, '', ' ', false, 0, 11, 'bad', Infinity]) {
    const c = {}; addWeekRpe(c, { rpe_actual: value, rpe_planned: 7 }); assert.deepEqual(c, {})
    addWeekRpe(c, { rpe_actual: 7, rpe_planned: value }); assert.deepEqual(c, {})
  }
  const c = {}; addWeekRpe(c, { rpe_actual: '8.5', rpe_planned: '7' }); assert.equal(c.rpeDeltaSum, 1.5)
})

test('sorting prioritizes absolute set deviation before supplementary signals', () => {
  const entries = ['waiting','under','rpe','skip','done','none'].map(id => id === 'none' ? { athlete: athlete(id) } : entry(id))
  const completion = { skip: {3:{sets:11,coachWeekSets:11,sprungneSaet:1}}, rpe:{3:{sets:12,coachWeekSets:12,rpeCount:2,rpeDeltaSum:3}},
    under:{3:{sets:12,coachWeekSets:12,saetUnderPlan:1}}, done:{3:{sets:15,coachWeekSets:15}} }
  assert.deepEqual(weekRows(entries, completion).map(r => r.athlete.id), ['waiting','done','skip','rpe','under','none'])
  assert.equal(weekRows([entry('done')],completion)[0].remaining,0)
  assert.equal(entries[0].athlete.id,'waiting')
})

test('synthetic DOM renders every supplied athlete once and real click opens correct Log', () => {
  const entries = Array.from({ length: 30 }, (_,i) => entry(String(i)))
  entries[0].athlete.name = '<script>synthetic</script>'
  const opened = []
  const dom = renderWeekOverview(element, { enabled: true, profileTab: 'log', entries, completion: {},
    status: { plan:'ready',logs:'ready' }, openProfile: (...args) => opened.push(args) })
  assert.equal(dom.queryAll('button').length,30)
  assert.equal(dom.queryAll('div').filter(x => x.attributes.role === 'listitem').length,30)
  const button = dom.queryAll('button').find(x => x.textContent.includes('<script>'))
  assert.equal(button.attributes.type,'button'); assert.equal(button.attributes.style.minHeight,44)
  button.click(); assert.equal(opened[0][0], entries[0].athlete); assert.equal(opened[0][1],'log')
  assert.equal(dom.queryAll('script').length,0)
  assert.ok(dom.textContent.includes('RPE: Mangler tal')); assert.ok(dom.textContent.includes('Missede: 0 sæt'))
})

test('read errors and pending reads never render a reassuring zero', async () => {
  for (const fail of [true,'throw']) {
    const f = await readerFixture({}, { fail })
    await f.reader.fetchCalendarWeeks(['a']); await f.reader.fetchCalendarProgress(['a'])
    assert.deepEqual(f.statuses, { plan:'error',logs:'error' })
    const dom = renderWeekOverview(element, { enabled:true,profileTab:'log', entries:[entry('a')], status:f.statuses, completion:{} })
    assert.equal(dom.queryAll('button').length,0); assert.ok(dom.textContent.includes('kunne ikke indlæses'))
  }
  const dom = renderWeekOverview(element,{ enabled:true,profileTab:'log', entries:[entry('a')],completion:null })
  assert.ok(dom.textContent.includes('Indlæser')); assert.equal(dom.queryAll('button').length,0)
  assert.ok(renderWeekOverview(element,{ enabled:true }).textContent.includes('Ingen synlige'))
})
