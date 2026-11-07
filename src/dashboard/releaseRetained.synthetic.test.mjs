// Independent producer checks against actual retained product modules. Synthetic rows only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { coachCalendarDays } from './coachCalendarEvents.mjs'
import { createCopyDraft, validateCopyDraft, sendCopyDraft } from './coachPlanCopy.mjs'
import { buildStrengthTrend } from '../entropi2/tracking/strengthTrend.mjs'
import { loadRadarSnapshot } from '../entropi2/coach/radar/read.mjs'
import { coachRadarModel } from '../entropi2/coach/radar/model.mjs'
import { coachHomeModel } from '../entropi2/coach/coachModel.mjs'

const owner='release-owner', day='2026-11-07'
const source=()=>({id:'release-week',athlete_id:owner,week_number:6,start_date:'2026-11-02',sessions:[{title:'Synthetic',weekday:0,exercises:[{name:'Press',sets:2,reps:'4-6',note:'Original note',recommended_weight:40}]}]})
function database() {
 const writes=[],calls=[]
 return {writes,calls,from(table){
  calls.push(table)
  return {insert(row){
   writes.push({table,row:structuredClone(row)})
   const result=()=>Promise.resolve({data:{id:table+'-release'},error:null})
   return {select(){return {single:result}},then(a,b){return result().then(a,b)}}
  }}
 }}
}

test('release: first calendar identity survives interleaved duplicate retries on two days',()=>{
 const a={id:owner,competition_date:'2026-11-07',name:'First'},b={...a,competition_date:'2026-11-08'},c={...a,id:'release-other'}
 const rows=[a,b,{...a,name:'Retry'},c,{...b}],before=structuredClone(rows)
 assert.deepEqual(coachCalendarDays(rows),[{date:a.competition_date,athletes:[a,c]},{date:b.competition_date,athletes:[b]}])
 assert.deepEqual(rows,before)
})

test('release: exact rational tail matrix denies all invalid raw fields before opening transport',async()=>{
 for(const field of ['week_number','sets']) for(const separator of ['.',',']) for(const tail of ['00000000000000001','0000000000000000000000000000001','99999999999999999']) {
  const draft=createCopyDraft(source(),owner),text=`1${separator}${tail}`
  if(field==='sets')draft.sessions[0].exercises[0].sets=text
  else draft.week_number=text
  const before=structuredClone(draft),db=database()
  const error=field==='sets'?/Sæt skal være et positivt heltal\./:/Kontrollér ugenummer og startdato\./
  assert.match(validateCopyDraft(draft,[],owner),error)
  await assert.rejects(sendCopyDraft(db,draft,[],owner),error)
  assert.deepEqual(db.calls,[]);assert.deepEqual(db.writes,[]);assert.deepEqual(draft,before)
 }
})

test('release: valid legacy and exponent copies preserve notes, dates and owner while sending numbers',async()=>{
 for(const [sets,weight]of [[2,40],['2,00e0','4,125e1'],['.2e1','41.25']]){
  const original=source(),before=structuredClone(original),draft=createCopyDraft(original,owner),db=database()
  draft.sessions[0].exercises[0].sets=sets;draft.sessions[0].exercises[0].recommended_weight=weight
  await sendCopyDraft(db,draft,[],owner)
  assert.deepEqual(db.writes.map(w=>w.table),['weeks','sessions','exercises'])
  assert.equal(db.writes[0].row.athlete_id,owner);assert.equal(db.writes[0].row.week_number,7)
  assert.equal(db.writes[0].row.start_date,'2026-11-09');assert.equal(db.writes[2].row.sets,2)
  assert.equal(db.writes[2].row.recommended_weight,typeof weight==='number'?weight:41.25)
  assert.equal(db.writes[2].row.note,'Original note');assert.equal(db.writes[2].row.reps,'4-6')
  assert.deepEqual(original,before)
 }
 const draft=createCopyDraft(source(),owner)
 for(const [weeks,id]of [[[ {week_number:7} ],owner],[[],'foreign-owner']]){
  const db=database();await assert.rejects(sendCopyDraft(db,draft,weeks,id));assert.deepEqual(db.calls,[]);assert.deepEqual(db.writes,[])
 }
})

test('release: conflicting strength retries in either order remain unknown',()=>{
 const rows=['2026-10-05','2026-10-12','2026-10-19','2026-10-26'].map((d,i)=>({id:'release-log-'+i,exercise_id:'release-ex-'+i,set_number:1,logged_at:d+'T08:00:00Z',weight:60,reps_completed:5,exercises:{name:'Squat'}}))
 rows.push({...rows[1],weight:65,note:'Synthetic conflict'})
 const before=structuredClone(rows)
 for(const input of [rows,[...rows].reverse()]){
  const lift=buildStrengthTrend(input,{today:day}).lifts.find(l=>l.name==='Squat')
  assert.equal(lift.weeks.find(w=>w.weekStart==='2026-10-12').e1rm,null);assert.equal(lift.plateau,null)
 }
 assert.deepEqual(rows,before)
})

const scope={coachId:'release-coach',day,athleteIds:[owner]}
function paging(mode) {
 const calls=[],rows=Array.from({length:5},(_,i)=>({id:'release-row-'+i,athlete_id:owner,logged_at:'2026-11-01T11:00:00Z',skipped:false,exercises:{sessions:{id:'release-session'}}}))
 return {calls,client:{from(table){const q={};for(const k of ['select','in','gte','lte','order'])q[k]=()=>q;q.range=async start=>{
  if(table!=='exercise_logs')return {data:[],error:null}
  calls.push(start)
  if(mode==='error'&&start>0)return {data:null,error:{message:'Synthetic read failure'}}
  const data=mode==='overlap'?rows.slice(0,2):rows.slice(start,start+2)
  return {data:mode==='foreign'?data.map(r=>({...r,athlete_id:'foreign'})):data,error:null}
 };return q}}}
}
test('release: radar exhausts short capped pages with an empty terminator',async()=>{
 const p=paging('complete'),snapshot=await loadRadarSnapshot({enabled:true,scope,client:p.client})
 assert.deepEqual(p.calls,[0,2,4,5]);assert.equal(snapshot.logs.complete,true);assert.equal(snapshot.logs.rows.length,5)
 assert.ok(snapshot.logs.rows.every(r=>r.sessionId==='release-session'))
 const source={session:{user:{id:scope.coachId}},readContext:{...scope},athletes:[{id:owner}],calendarWeeks:{[owner]:[]},coachActionsStatus:{calendar:'ready',activity:{state:'ready',day,ids:[owner],rows:[]}},coachMorningData:{messages:{state:'ready',day,ids:[owner],rows:[]},videos:{state:'ready',day,ids:[owner],rows:[]}}}
 const keys=s=>coachRadarModel({enabled:true,source:s,context:coachHomeModel(s,day),snapshot}).rows.flatMap(r=>r.signals.map(x=>x.key))
 assert.ok(keys(source).includes('noLog'))
 for(const changed of [{coachId:'foreign'},{day:'2026-11-06'},{athleteIds:['foreign']}]){
  const other=structuredClone(source);Object.assign(other.readContext,changed);assert.ok(!keys(other).includes('noLog'))
 }
})
test('release: radar denies partial, overlapping and foreign pages and strict OFF avoids reads',async()=>{
 for(const mode of ['error','overlap','foreign']){
  const p=paging(mode),snapshot=await loadRadarSnapshot({enabled:true,scope,client:p.client})
  assert.equal(snapshot.logs.complete,false);assert.deepEqual(snapshot.logs.rows,[]);assert.ok(p.calls.length<=2)
 }
 for(const enabled of [undefined,false,1,'true'])assert.deepEqual(await loadRadarSnapshot({enabled,get client(){assert.fail('OFF read')},get scope(){assert.fail('OFF scope')}}),{state:'off'})
})
