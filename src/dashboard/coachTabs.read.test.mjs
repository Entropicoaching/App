import test from 'node:test'
import assert from 'node:assert/strict'
import { installCoachTabsFixture, service } from './coachTabsFixture.mjs'
installCoachTabsFixture()
const { lavLaesninger } = await import('./laesninger.js')
const { lavProgramHandlinger } = await import('./programHandlinger.js')
const noop = () => {}
function fixture(enabled = true) {
  service.responses.length = 0; service.calls.length = 0
  const values = {}, setters = {}
  for (const name of ['Weeks','AthleteLogs','AthleteReadiness','AthletePRs','AthletePRHistory','MeetResults','MeetPlan','MeetPlanForm','VideoAnalyses','VideoBaselines','VideoAnalysisLoading','VideoAnalysisError','CalendarWeeks']) {
    setters['set'+name] = update => { values[name] = typeof update === 'function' ? update(values[name]) : update }
  }
  const current = { current: 'synthetic-a' }
  const options = { ...setters, coachTabCleanup: enabled, currentProgramAthleteRef: current,
    ...(enabled ? { entropi2CalendarRead: noop } : {}) }
  return { reader: lavLaesninger(options), values, setters, current, options }
}
for (const [method, field] of [['fetchWeeks','Weeks'],['fetchAthleteLogs','AthleteLogs'],['fetchAthleteReadiness','AthleteReadiness'],['fetchAthletePRs','AthletePRs'],['fetchMeetResults','MeetResults']]) {
  test(`actual ${method}: loading, confirmed empty, returned/thrown errors and retry`, async () => {
    const f = fixture()
    let finish; service.responses.push(() => new Promise(resolve => { finish = resolve }))
    const pending = f.reader[method]('synthetic-a')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.values[field].coachRead.state, 'loading')
    finish({ data: [], error: null }); await pending
    assert.equal(f.values[field].coachRead.state, 'ready')
    for (const response of [{ data: [], error: { message: 'raw private SQL detail' } }, new Error('raw failure'), { data: null, error: null }]) {
      service.responses.push(response); await f.reader[method]('synthetic-a')
      assert.equal(f.values[field].coachRead.state, 'error')
      assert.equal(f.values[field].length, 0)
    }
    service.responses.push({ data: [] }); await f.values[field].coachRead.retry()
    assert.equal(f.values[field].coachRead.state, 'ready')
    assert.ok(service.calls.every(call => call.steps.some(step => step[0] === 'eq' && step[1] === 'athlete_id' && step[2] === 'synthetic-a')))
  })
}
test('actual reader: stale refresh, wrong athlete, truncated replies and flag switch', async () => {
  const f=fixture(); let finish
  service.responses.push(() => new Promise(resolve => { finish=resolve }))
  const old=f.reader.fetchWeeks('synthetic-a'); await new Promise(resolve=>setImmediate(resolve))
  service.responses.push({data:[]}); await f.reader.fetchWeeks('synthetic-a')
  finish({data:[{id:'stale'}]}); await old; assert.equal(f.values.Weeks.length,0)
  service.responses.push({data:[{athlete_id:'synthetic-other'}]}); await f.reader.fetchWeeks('synthetic-a'); assert.equal(f.values.Weeks.coachRead.state,'error')
  service.responses.push({data:Array.from({length:1000},()=>({sessions:[]}))}); await f.reader.fetchWeeks('synthetic-a'); assert.equal(f.values.Weeks.coachRead.state,'incomplete')
  service.responses.push(()=>new Promise(resolve=>{finish=resolve})); const pending=f.reader.fetchWeeks('synthetic-a'); await new Promise(resolve=>setImmediate(resolve))
  lavLaesninger({...f.options,entropi2CalendarRead:undefined}); finish({data:[{id:'late'}]}); await pending
  assert.equal(f.values.Weeks.length,0)
})
test('actual reader: late athlete A does not replace selected athlete B', async () => {
 const f=fixture(); let finish; service.responses.push(()=>new Promise(resolve=>{finish=resolve}))
 const pending=f.reader.fetchAthleteReadiness('synthetic-a'); await new Promise(resolve=>setImmediate(resolve)); f.current.current='synthetic-b'
 service.responses.push({data:[]}); await f.reader.fetchAthleteReadiness('synthetic-b'); finish({data:[{athlete_id:'synthetic-a'}]}); await pending
 assert.equal(f.values.AthleteReadiness.coachRead.athleteId,'synthetic-b')
})
test('actual meet plan: errors preserve draft, confirmed absence enables empty form', async () => {
 const f=fixture(); f.values.MeetPlanForm={notes:'local input'}
 service.responses.push({data:null,error:{message:'raw backend'}}); await f.reader.fetchMeetPlan('synthetic-a')
 assert.equal(f.values.MeetPlanForm.notes,'local input'); assert.equal(f.values.MeetPlanForm.coachRead.state,'error')
 service.responses.push({data:null,error:null}); await f.values.MeetPlanForm.coachRead.retry()
 assert.equal(f.values.MeetPlanForm.coachRead.state,'ready'); assert.equal(f.values.MeetPlan,null)
})
test('actual video reader: thrown errors stop loading and use stable copy', async () => {
 const f=fixture(); service.responses.push(new Error('raw backend'),{data:[]}); await f.reader.fetchVideoCoachHistory('synthetic-a')
 assert.equal(f.values.VideoAnalysisLoading,false); assert.equal(f.values.VideoAnalysisError,'Videoanalyserne kunne ikke hentes. Prøv igen.')
})
test('OFF readers keep ordinary arrays and the old null-plan form', async () => {
 const f=fixture(false); service.responses.push({data:[]}); await f.reader.fetchWeeks('synthetic-a'); assert.deepEqual(f.values.Weeks,[])
 service.responses.push({data:[]}); await f.reader.fetchAthleteLogs('synthetic-a'); assert.deepEqual(f.values.AthleteLogs,[])
 service.responses.push({data:null}); await f.reader.fetchMeetPlan('synthetic-a'); assert.equal(f.values.MeetPlanForm.coachRead,undefined)

})
test('actual recommended-weight action preserves input/editor and gives stable error', async () => {
 const calls=[]; service.responses.push(new Error('raw SQL'))
 const action=lavProgramHandlinger({coachTabCleanup:true,recommendedInput:'100',selectedAthlete:{id:'synthetic-a'},
  showFlash:(...args)=>calls.push(args),setEditingRecommended:()=>assert.fail('editor closed'),fetchWeeks:()=>assert.fail('unexpected refresh')})
 await action.saveRecommendedWeight('synthetic-ex'); assert.deepEqual(calls,[['Vægten blev ikke gemt. Prøv igen.','error']])
})

test('actual approval action preserves the draft and keeps raw backend errors out of UI', async () => {
 const draft={data:{draft:{source_week_id:'synthetic-week',p_payload:{sessions:[]}},progression:{proposal:{expected_progression:{exercises:[]}}}}}
 let value=draft; const busy=[]
 service.invoke=async()=>{throw Error('raw SQL detail')}
 const action=lavProgramHandlinger({coachTabCleanup:true,weekDraft:draft,selectedAthlete:{id:'synthetic-a'},
  setWeekDraft:fn=>{value=fn(value)},setApprovingProgression:v=>busy.push(v)})
 await action.approveDraftProgressionState()
 assert.equal(value.data.draft,draft.data.draft)
 assert.equal(value.data.progression.approval_error,'Progressionen blev ikke godkendt. Prøv igen.')
 assert.deepEqual(busy,[true,false])
})
test('existing result deletion retains the confirmed read receipt', async () => {
 const {lavAtletHandlinger}=await import('./atletHandlinger.js')
 const receipt={athleteId:'synthetic-a',state:'ready'}
 let rows=Object.assign([{id:'synthetic-result'}],{coachRead:receipt}), pending
 service.responses.push({data:null,error:null})
 const action=lavAtletHandlinger({askConfirm:(_,fn)=>{pending=fn()},showFlash:()=>{},setMeetResults:fn=>{rows=fn(rows)}})
 action.deleteMeetResult('synthetic-result'); await pending
 assert.equal(rows.length,0);assert.equal(rows.coachRead,receipt)
})
test('existing week deletion callback retains read and data-evidence receipts', () => {
 const receipt={athleteId:'synthetic-a',state:'ready'}, evidence={athleteId:'synthetic-a',complete:true}
 let rows=Object.assign([{id:'synthetic-week',week_number:1}],{coachRead:receipt,readEvidence:evidence}), deletion
 const action=lavProgramHandlinger({programCopyEnabled:true,weeks:rows,selectedAthlete:{id:'synthetic-a'},athletes:[],
 askConfirm:(_,fn)=>fn(),weekDeletionQueue:{schedule:entry=>{deletion=entry}},setWeeks:fn=>{rows=fn(rows)},fetchCalendarWeeks:()=>{},fetchAthleteWeekSummaries:()=>{}})
 action.deleteWeek('synthetic-week');deletion.onDeleted()
 assert.equal(rows.length,0);assert.equal(rows.coachRead,receipt);assert.equal(rows.readEvidence,evidence)
})
test('actual reader: refresh of the same athlete keeps confirmed rows visible (kontrol)', async () => {
 const f=fixture(); service.responses.push({data:[{id:'w1',sessions:[]}]}); await f.reader.fetchWeeks('synthetic-a')
 assert.equal(f.values.Weeks.coachRead.state,'ready'); let finish
 service.responses.push(()=>new Promise(resolve=>{finish=resolve})); const pending=f.reader.fetchWeeks('synthetic-a'); await new Promise(resolve=>setImmediate(resolve))
 assert.equal(f.values.Weeks.length,1); assert.equal(f.values.Weeks.coachRead.state,'ready'); assert.notEqual(f.values.Weeks.coachRead.current(),false)
 finish({data:[{id:'w1',sessions:[]},{id:'w2',sessions:[]}]}); await pending; assert.equal(f.values.Weeks.length,2)
 service.responses.push(()=>new Promise(resolve=>{finish=resolve})); const other=f.reader.fetchWeeks('synthetic-b'); await new Promise(resolve=>setImmediate(resolve))
 assert.equal(f.values.Weeks.coachRead.state,'loading'); assert.equal(f.values.Weeks.length,0); f.current.current='synthetic-b'; finish({data:[]}); await other
 service.responses.push({data:null,error:{message:'x'}}); await f.reader.fetchWeeks('synthetic-b'); assert.equal(f.values.Weeks.coachRead.state,'error')
})
