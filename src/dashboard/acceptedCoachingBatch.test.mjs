import test from 'node:test'
import assert from 'node:assert/strict'
import { coachCalendarDays } from './coachCalendarEvents.mjs'
import { createCopyDraft, sendCopyDraft } from './coachPlanCopy.mjs'
import { buildStrengthTrend } from '../entropi2/tracking/strengthTrend.mjs'

// Independent integration probes on actual public modules; all rows are synthetic.
test('accepted lead: calendar retries retain exactly the first identity per civil day', () => {
 const first=Object.freeze({id:'lead-a',competition_date:'2026-11-22',name:'Synthetic first'})
 const second=Object.freeze({...first,name:'Synthetic retry'})
 const another=Object.freeze({id:'lead-b',competition_date:first.competition_date})
 const input=Object.freeze([first,second,another])
 const rows=coachCalendarDays(input)
 assert.equal(rows.length,1)
 assert.deepEqual(rows[0].athletes,[first,another])
 assert.equal(rows[0].athletes[0],first)
})

test('accepted lead: explicit draft send normalizes decimal comma into integer payloads', async () => {
 const source={id:'source',athlete_id:'lead-a',week_number:2,start_date:'2026-11-02',sessions:[{title:'Synthetic',weekday:0,exercises:[{name:'Squat',sets:'3,0',reps:'5',recommended_weight:'72,5'}]}]}
 const draft=createCopyDraft(source,'lead-a');draft.week_number='3,0'
 const calls=[]
 const client={from(table){return {insert(payload){calls.push({table,payload});return {select(){return {async single(){return {data:{id:table==='weeks'?'new-week':'new-session'},error:null}}}}}}}}}
 assert.equal(calls.length,0)
 await sendCopyDraft(client,draft,[],'lead-a')
 assert.equal(calls.find(x=>x.table==='weeks').payload.week_number,3)
 assert.equal(calls.find(x=>x.table==='exercises').payload.sets,3)
 assert.equal(calls.find(x=>x.table==='exercises').payload.recommended_weight,72.5)
 assert.equal(draft.sessions[0].exercises[0].sets,'3,0')
})

test('accepted lead: conflicting retry cannot establish a plateau or a known week', () => {
 const rows=['2026-10-05','2026-10-12','2026-10-19','2026-10-26'].map((day,i)=>({id:'lead-'+i,exercise_id:'exercise-'+i,set_number:1,logged_at:day+'T12:00:00Z',weight:100,reps_completed:3,exercises:{name:'Squat'}}))
 rows.push({...rows[2],weight:105})
 const before=JSON.stringify(rows)
 for(const input of [rows,[...rows].reverse()]) {
  const lift=buildStrengthTrend(input,{today:'2026-11-04'}).lifts.find(x=>x.name==='Squat')
  assert.equal(lift.plateau,null)
  assert.equal(lift.weeks.find(x=>x.weekStart==='2026-10-19').e1rm,null)
 }
 assert.equal(JSON.stringify(rows),before)
})
