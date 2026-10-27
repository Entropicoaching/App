import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install, dashboardURL } from './coachMorningLoader.mjs'
import { state, reset, walk, text } from './coachMorningFake.mjs'
install()
const { morningRows, morningDay, yesterday, coachMorningFlag, readMorningSource, CoachMorning } = await import('./coachMorning.mjs')
const { lavLaesninger } = await import('./laesninger.js')
const { default: ForsideView } = await import('./ForsideView.jsx')
await import(dashboardURL.href)
const now = new Date('2026-10-27T10:00:00Z')
const athletes = [{id:'a',name:'Anna'},{id:'b',name:'Bo'},{id:'a',name:'Anna'}]
const ready = rows => ({ rows, state: 'ready', day: '2026-10-27', ids:['a','b'] })
const fixture = () => ({ logs:ready([{athlete_id:'a',logged_at:'2026-10-26T12:00:00Z'},{athlete_id:'a',logged_at:'2026-10-27T09:00:00Z'},{athlete_id:'a',logged_at:'2026-10-26T13:00:00Z'}]), messages:ready([{athlete_id:'a',sender_role:'athlete',created_at:'2026-10-26T10:00:00Z'},{athlete_id:'a',category:'teknik',sender_role:'athlete',created_at:'2026-10-26T10:00:00Z'},{athlete_id:'b',sender_role:'athlete',created_at:'2026-10-26T10:00:00Z'},{athlete_id:'b',sender_role:'coach',created_at:'2026-10-26T11:00:00Z'}]), videos:ready([{id:'v',athlete_id:'a',status:'draft',created_at:'2026-10-26T10:00:00Z'},{id:'v',athlete_id:'a',status:'draft',created_at:'2026-10-26T10:00:00Z'},{id:'w',athlete_id:'a',status:'draft',created_at:'2026-10-26T10:00:00Z'}]) })
test('strict default OFF flag and disabled reader have no capture or timer', async () => {
  for (const flag of ['', '?coachMorgen=0','?coachMorgen=true','?coachMorgen=1&coachMorgen=1']) assert.equal(coachMorningFlag(flag),false)
  assert.equal(coachMorningFlag('?coachMorgen=1&coachUge=1'),true)
  reset();assert.equal(CoachMorning({}),null); assert.equal(state.effects[0](),undefined)
  const original = Promise.resolve({data:[]}); assert.equal(readMorningSource(false,'logs',[],()=>assert.fail(),()=>original),original)
})
test('existing data counts yesterday despite a newer log, unique athletes and draft IDs', () => {
  const data=fixture(); const model=morningRows({athletes,data,now})
  assert.deepEqual(model.rows.map(r=>[r.count,r.complete]),[[1,true],[1,true],[1,true]])
  assert.equal(model.rows[2].videoCount,2)
  data.logs.rows.push({athlete_id:'outside',logged_at:'2026-10-26T10:00:00Z'})
  assert.equal(morningRows({athletes,data,now}).rows[0].count,1)
})
test('Danish calendar yesterday handles DST, year/month edges and midnight', () => {
  assert.equal(yesterday('2026-10-25T23:30:00Z'),'2026-10-25')
  assert.equal(yesterday('2026-03-29T22:30:00Z'),'2026-03-29')
  assert.equal(yesterday('2026-12-31T23:10:00Z'),'2026-12-31')
  assert.equal(yesterday('2026-02-28T23:10:00Z'),'2026-02-28')
  assert.equal(morningDay('garbage'),null);assert.equal(morningDay(null),null)
})
test('unknown, failed, stale, loading, malformed and scope-incomplete data cannot assert zero', () => {
  for (const state of ['loading','partial','error']) {
    const data={logs:{...ready([]),state},messages:{...ready([]),state},videos:{...ready([]),state}}
    assert.ok(morningRows({athletes,data,now}).rows.every(r=>!r.complete))
  }
  assert.ok(morningRows({athletes,now}).rows.every(r=>!r.complete))
  assert.ok(morningRows({athletes,data:fixture(),now:new Date('2026-10-28T10:00:00Z')}).rows.every(r=>!r.complete))
  assert.ok(morningRows({athletes,data:fixture(),now,loadError:true}).rows.every(r=>!r.complete))
  const data=fixture();data.logs.ids=['a'];assert.equal(morningRows({athletes,data,now}).rows[0].complete,false)
  data.logs=ready([{athlete_id:'a',logged_at:null}]);assert.equal(morningRows({athletes,data,now}).rows[0].complete,false)
})
test('synthetic DOM exposes exactly three lines and routes unique athlete links through existing handlers', () => {
  reset(); state.values=[now];const calls=[]
  const tree=CoachMorning({enabled:true,athletes,data:fixture(),openProfile:(...a)=>calls.push(a),setSelectedAthlete:a=>calls.push(a),setView:a=>calls.push(a)})
  assert.equal(walk(tree,n=>n.type==='summary').length,3)
  assert.match(text(tree),/2 videoer venter hos 1 atleter/)
  const buttons=walk(tree,n=>n.type==='button');buttons.forEach(b=>b.props.onClick())
  assert.deepEqual(calls,[[athletes[1-1],'log','list'],null,'calendar',[athletes[0],'beskeder','list'],null,'inbox',[athletes[0],'analyse','list'],null,'inbox'])
  let tick,cleared;const original=globalThis.setInterval, clear=globalThis.clearInterval
  try {globalThis.setInterval=fn=>{tick=fn;return 7};globalThis.clearInterval=id=>{cleared=id};const cleanup=state.effects[0]();tick();assert.ok(state.values[0] instanceof Date);cleanup();assert.equal(cleared,7)} finally {globalThis.setInterval=original;globalThis.clearInterval=clear}
})
test('actual Forside component keeps default OFF tree and places opt-in block first', () => {
  const props={athletes:[],hiddenAthleteIds:new Set(),calendarWeeks:{},athleteCurrentWeek:{},coachPriorityItems:[],coachBriefingSeen:{},coachPriorityCount:0}
  const off=ForsideView(props),on=ForsideView({...props,coachMorning:true})
  assert.equal(walk(off,n=>n.type===CoachMorning).length,0)
  assert.equal(on.props.children.filter(Boolean)[0].type,CoachMorning)
  const source=readFileSync(dashboardURL,'utf8')
  assert.match(source,/coachMorningFlag\(typeof window/);assert.match(source,/setCoachActionsStatus, coachMorning, setCoachMorningData/);assert.match(source,/<ForsideView[^\n]+coachMorningData/)
})
test('actual read handlers capture the existing three reads, no extra query, failures and caps', async () => {
  let captured={},calls=[];const setData=fn=>{captured=fn(captured)}
  let result={data:[],error:null}
  state.database={from:table=>{calls.push(table);const q=new Proxy({}, {get:(_,key)=>key==='then'?((resolve,reject)=>Promise.resolve(typeof result === 'function' ? result(table) : result).then(resolve,reject)):()=>q});return q}}
  const noop=()=>{}
  const props=new Proxy({coachMorning:true,setCoachMorningData:setData,session:{user:{id:'coach'}},videoCoachAthletesRef:{current:athletes}}, {get:(o,k)=>k in o?o[k]:noop})
  const reader=lavLaesninger(props)
  // Activity is reached by the actual athlete read handler.
  result=table=>({data:table==='athletes'?athletes:table==='exercise_logs'?[{athlete_id:'a',logged_at:'2026-10-26T12:00:00Z'}]:[],error:null});await reader.fetchAthletes();await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(captured.logs.rows,[{athlete_id:'a',logged_at:'2026-10-26T12:00:00Z'}]);calls=[]
  result={data:[],error:null};await reader.fetchLatestMessages(['a','b']);await reader.fetchVideoReviewQueue()
  assert.deepEqual(calls,['messages','video_analyses']);assert.equal(captured.messages.state,'ready');assert.equal(captured.videos.state,'ready')
  result={data:Array.from({length:50},()=>({id:'v',athlete_id:'a',status:'draft'})),error:null};await reader.fetchVideoReviewQueue();assert.equal(captured.videos.state,'partial')
  result={data:null,error:new Error('synthetic')};await reader.fetchLatestMessages(['a']);assert.equal(captured.messages.state,'error')
  await readMorningSource(true,'logs',['a'],setData,()=>{throw new Error('synthetic')});assert.equal(captured.logs.state,'error')
})
