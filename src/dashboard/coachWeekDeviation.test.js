import './coachWeekTestLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { coachWeekFlag, DEFAULT_COACH_WEEK_OVERVIEW, weekRows, renderWeekOverview,
  plannedSetCount, isThisCoachWeek, selectOverviewWeek } = await import('./coachWeekOverview.mjs')
const { lavLaesninger } = await import('./laesninger.js')
const { lavNavigation } = await import('./navigation.js')
import { element } from './syntheticDom.mjs'

const entry = (id, planned = 10, name = id) => ({ athlete: { id, name }, current: { id: 'w-'+id, week_number: 3, planned_sets: planned } })
const totals = values => Object.fromEntries(Object.entries(values).map(([id, sets]) => [id, { ['id:w-'+id]: { coachWeekSets: sets, sets: 999 } }]))
const ready = { plan: 'ready', logs: 'ready' }
function fixture(payload = {}, enabled = true, fail = false) {
  const calls = [], values = {}, status = {}
  globalThis.coachWeekFake = { from(table) {
    const call = { table }; calls.push(call)
    const query = {}
    for (const name of ['select','in','gte','order','limit']) query[name] = (...args) => { call[name] = args; return query }
    query.then = (resolve, reject) => (fail === 'throw' ? Promise.reject(Error('synthetic')) :
      Promise.resolve(fail ? { data: null, error: Error('synthetic') } : { data: payload[table] || [], error: null })).then(resolve, reject)
    return query
  } }
  const reader = lavLaesninger({ coachWeekEnabled: enabled, coachActions: false,
    setCoachWeekDataStatus: update => Object.assign(status, update(status)),
    setCalendarWeeks: value => { values.weeks = value },
    setAthleteCurrentWeek: value => { values.current = value },
    setAthleteWeekCompletion: value => { values.completion = value },
  })
  return { reader, calls, values, status }
}
function log(athlete, weekId, stamp, extra = {}) {
  return { athlete_id: athlete, logged_at: stamp,
    exercises: { reps: '5', sessions: { id: 'session-'+weekId, weeks: { id: weekId, week_number: 3 } } }, ...extra }
}

test('default OFF performs no render or handler calls, exact opt-in only', () => {
  assert.equal(DEFAULT_COACH_WEEK_OVERVIEW, false)
  for (const value of ['', '?coachUge=0','?coachUge=true','?xcoachUge=1']) assert.equal(coachWeekFlag(value), false)
  assert.equal(coachWeekFlag('?coachUge=1'), true)
  assert.equal(renderWeekOverview(() => { throw Error('rendered') }, {}), null)
  assert.equal(renderWeekOverview(element, { enabled: 'true' }), null)
})

test('largest absolute set deviation first, skips/RPE do not override it', () => {
  const entries = [entry('short'), entry('over'), entry('equal'), entry('unknown', null)]
  const completion = totals({ short: 7, over: 15, equal: 10, unknown: 100 })
  completion.short['id:w-short'].sprungneSaet = 50
  const rows = weekRows(entries, completion)
  assert.deepEqual(rows.map(row => row.athlete.id), ['over','short','equal','unknown'])
  assert.deepEqual(rows.map(row => row.deviation), [5,3,0,null])
  assert.equal(entries[0].athlete.id, 'short')
  assert.equal(rows[3].planned, null)
})

test('ties resolve by Danish name then athlete id independent of input order', () => {
  const entries = [entry('2', 10, 'Anne'), entry('z', 10, 'Bo'), entry('1', 10, 'Anne')]
  const completion = totals({ '1': 8, '2': 12, z: 8 })
  const expected = ['1','2','z']
  assert.deepEqual(weekRows(entries, completion).map(row => row.athlete.id), expected)
  assert.deepEqual(weekRows([...entries].reverse(), completion).map(row => row.athlete.id), expected)
})

test('unknown plan is never zero; explicit zero is a known plan', () => {
  for (const value of [null, undefined, '', ' ', false, -1, 1.5, 'bad', Infinity]) {
    assert.equal(plannedSetCount(value), null)
    assert.equal(weekRows([{...entry('a'),current:{...entry('a').current,planned_sets:value}}], totals({a:4}))[0].deviation, null)
  }
  assert.equal(weekRows([entry('a', 0)], totals({a:4}))[0].deviation, 4)
  const missing = weekRows([{athlete:{id:'a'}}], {a:{undefined:{coachWeekSets:99}}})[0]
  assert.equal(missing.planned, null); assert.equal(missing.logged, 0)
})

test('Copenhagen Monday boundaries and DST, invalid dates, next week excluded', () => {
  const today = '2026-10-27'
  assert.equal(isThisCoachWeek('2026-10-25T22:59:59Z', today), false)
  assert.equal(isThisCoachWeek('2026-10-25T23:00:00Z', today), true)
  assert.equal(isThisCoachWeek('2026-11-01T22:59:59Z', today), true)
  assert.equal(isThisCoachWeek('2026-11-01T23:00:00Z', today), false)
  assert.equal(isThisCoachWeek('bad', today), false)
  assert.equal(isThisCoachWeek('2026-03-22T23:00:00Z', '2026-03-29'), true)
  assert.equal(isThisCoachWeek('2026-03-29T22:00:00Z', '2026-03-29'), false)
})

test('dated active plan beats stale current pointer; ambiguous or expired plans unknown', () => {
  const old = {id:'old', week_number:3, start_date:'2026-10-12'}
  const current = {id:'now', week_number:3, start_date:'2026-10-26'}
  assert.equal(selectOverviewWeek([old,current], old, '2026-10-27'), current)
  assert.equal(selectOverviewWeek([old], old, '2026-10-27'), undefined)
  assert.equal(selectOverviewWeek([current,{...current,id:'other'}], current, '2026-10-27'), undefined)
  const undated = {id:'u',week_number:4}
  assert.equal(selectOverviewWeek([undated], undated, '2026-10-27'), undated)
})

test('actual reader keeps historical legacy totals but isolates calendar-week sets by athlete and week id', async () => {
  const today = new Date().toISOString()
  const f = fixture({exercise_logs:[log('a','w-a',today), log('a','w-a',today,{skipped:true}),
    log('a','w-a','2001-01-01T12:00:00Z'), log('b','w-a',today), log('a','other',today)]})
  await f.reader.fetchCalendarProgress(['a','b'])
  const rows = weekRows([entry('a')],f.values.completion)
  assert.equal(rows[0].logged,1); assert.equal(rows[0].deviation,9)
  assert.equal(f.values.completion.a['id:w-a'].sets,2)
  assert.equal(f.values.completion.a['id:other'].coachWeekSets,1)
  assert.equal(f.values.completion.b['id:w-a'].coachWeekSets,1)
  assert.equal(f.status.logs,'ready')
  assert.deepEqual(f.calls.map(call=>call.table),['exercise_logs'])
})

test('actual plan reader retains unknown prescriptions and known empty plans', async () => {
  const weeks = [null, '', -1, 2].map((sets,i)=>({athlete_id:'a',id:'w'+i,week_number:i,sessions:[{exercises:[{sets}]}]}))
  weeks.push({athlete_id:'b',id:'empty',week_number:1,sessions:[]})
  const f = fixture({weeks}); await f.reader.fetchCalendarWeeks(['a','b'])
  assert.deepEqual(f.values.weeks.a.map(w=>w.coachWeekPlannedSets),[null,null,null,2])
  assert.equal(f.values.weeks.b[0].coachWeekPlannedSets,0)
})

test('flag OFF reader projection and legacy completion remain unchanged', async () => {
  const f = fixture({exercise_logs:[log('a','w-a',new Date().toISOString())]},false)
  await f.reader.fetchCalendarProgress(['a'])
  assert.equal(f.calls[0].select[0].includes('rpe_actual'),false)
  assert.equal('coachWeekSets' in f.values.completion.a[3],false)
  assert.equal('id:w-a' in f.values.completion.a,false)
  assert.deepEqual(f.status,{})
})

test('synthetic DOM sorted row invokes actual navigation with exact athlete and Log', () => {
  const values = {}, athlete = {id:'correct-id',name:'<script>Anne</script>'}
  const navigationSource = readFileSync(new URL('./navigation.js',import.meta.url),'utf8')
  const names = [...navigationSource.matchAll(/\b(set[A-Z]\w*)\(/g)].map(match=>match[1])
  const setters = Object.fromEntries(names.map(name=>[name,value=>{values[name]=value}]))
  globalThis.window = {scrollY:123}
  const navigation = lavNavigation({...setters,analyseTabFactory:()=>Promise.resolve(),viewRef:{current:'list'},
    listScrollYRef:{current:0},messageThreadAthleteRef:{current:null}})
  const dom = renderWeekOverview(element,{enabled:true,profileTab:'log',entries:[{...entry('correct-id'),athlete},entry('other')],
    completion:totals({'correct-id':0,other:10}),status:ready,openProfile:navigation.openProfile})
  const buttons = dom.queryAll('button')
  assert.equal(buttons.length,2); assert.ok(buttons[0].textContent.includes('<script>Anne</script>'))
  assert.equal(dom.queryAll('script').length,0)
  assert.equal(buttons[0].attributes.type,'button'); assert.equal(buttons[0].attributes.style.minHeight,44)
  buttons[0].click()
  assert.equal(values.setSelectedAthlete,athlete); assert.equal(values.setActiveTab,'log')
  assert.equal(values.setView,'profile'); assert.equal(values.setProfileReturnView,'list')
  delete globalThis.window
})

test('error or pending data never displays reassuring zero or actionable rows', async () => {
  for (const fail of [true,'throw']) {
    const f=fixture({},true,fail); await f.reader.fetchCalendarProgress(['a'])
    const dom=renderWeekOverview(element,{enabled:true,profileTab:'log',entries:[entry('a')],completion:totals({a:10}),status:{plan:'ready',...f.status}})
    assert.equal(dom.queryAll('button').length,0); assert.ok(dom.textContent.includes('kunne ikke'))
  }
  const pending=renderWeekOverview(element,{enabled:true,profileTab:'log',entries:[entry('a')],completion:{},status:{plan:'ready'}})
  assert.equal(pending.queryAll('button').length,0)
  const unknown=renderWeekOverview(element,{enabled:true,profileTab:'log',entries:[entry('a',null)],completion:{},status:ready})
  assert.ok(unknown.textContent.includes('Planlagt: Ingen plan')); assert.ok(unknown.textContent.includes('Afvigelse: Ukendt'))
})
