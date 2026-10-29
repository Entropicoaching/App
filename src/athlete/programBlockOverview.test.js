import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
install()
const { default: ProgramUtenFlag } = await import('./ProgramTab.jsx')
const Program = p => ProgramUtenFlag({ hviledageListe: true, ...p })
const { default: Baseline } = await import('./prog3Baseline.jsx')
const { programBlockRows, readProgramBlockLogs, blockWeeks } = await import('./programBlockOverview.mjs')
const helpers = await import('./ugeHjaelp.js')
const session = (id, weekday = 0, sets = 2) => ({ id, weekday, exercises: [{ id: id + '-ex', sets, name: 'Squat', reps: '5' }] })
const week = (id, start, sessions, block_name = 'Styrke') => ({ id, week_number: Number(id), start_date: start, block_name, sessions })
const weeks = () => [week('1','2026-03-23',[session('s1')]),week('2','2026-03-30',[session('s2',2)])]
const options = allWeeks => ({ allWeeks, activeWeekIdx: 0, logs: [] })
const logsFor = s => Array.from({length: s.exercises[0].sets}, (_, i) => ({ exercise_id: s.exercises[0].id, set_number: i+1 }))
function props(allWeeks = weeks()) {
  const p = { ...helpers, allWeeks, currentWeek: allWeeks[0], viewingWeekIdx: 0, athlete: { id: 'synthetic' },
    exerciseLogs: [], pastLogs: [], readinessLog: {readiness_score: 90}, progOpenSession: null,
    sessionRefs: {current:{}}, dismissedFeedback: new Set(), feedbackInputs:{}, logInputs:{}, fetchProgramBlockLogs: async()=>[], calls:[] }
  p.setViewingWeekIdx = n => {p.calls.push(['view',n]);p.viewingWeekIdx=n}
  p.setProgOpenSession = n => p.calls.push(['close',n])
  p.fetchPastLogs = (w,id) => p.calls.push(['fetch',w.id,id])
  p.setPastLogs = n => p.calls.push(['clear',n])
  return p
}
const render = (C,p) => mount(C,p).render()
function shape(value) {
  if(typeof value === 'function')return '[handler]'
  if(Array.isArray(value)) return value.map(shape)
  if(value && typeof value === 'object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,shape(v)]))
  return value
}
const overview = tree => nodes(tree,n=>n.type==='section' && n.props['aria-label']==='Hele din aktuelle blok')[0]
const buttons = tree => nodes(overview(tree),n=>n.type==='button')

test('flag absent, false and non-boolean preserve the pinned component tree',()=>{
  for(const flag of [undefined,false,'true',1]) {
    const p=props(); if(flag!==undefined)p.programBlokOversigt=flag
    assert.deepEqual(shape(render(Program,p)),shape(render(Baseline,p)))
    assert.equal(p.calls.length,0)
  }
})
test('DOM shows every week once and preserves the real navigation handler',()=>{
  const p=props();p.programBlokOversigt=true
  p.currentWeek=p.allWeeks[1]; p.viewingWeekIdx=1
  let tree=render(Program,p)
  assert.equal(buttons(tree).length,2)
  assert.equal(buttons(tree)[1].props['aria-current'],'step')
  buttons(tree)[0].props.onClick()
  assert.deepEqual(p.calls,[['view',0],['close',null],['fetch','1','synthetic']])
  p.calls=[];tree=render(Program,p)
  assert.equal(buttons(tree).length,2,'opening a past week does not switch block')
  buttons(tree)[1].props.onClick()
  assert.deepEqual(p.calls,[['view',1],['close',null],['clear',[]]])
})
test('rest days, seven training days, duplicate days and unscheduled sessions',()=>{
  const w=weeks();let rows=programBlockRows(options(w))
  assert.equal(rows[0].sessions,1);assert.match(rows[0].rest,/Tirsdag/);assert.doesNotMatch(rows[0].rest,/Mandag/)
  w[0].sessions=Array.from({length:7},(_,i)=>session('s'+i,i))
  assert.equal(programBlockRows(options(w))[0].rest,'Ingen hviledage')
  w[0].sessions=[session('a',0),session('b',0)]
  assert.equal(programBlockRows(options(w))[0].rest.split(',').length,6)
  w[0].sessions=[session('a',null)]
  assert.equal(programBlockRows(options(w))[0].rest,'Hviledage ikke fastlagt')
})
test('calendar dates cross both DST boundaries and year end without drift',()=>{
  for(const [start,end,next] of [['2026-03-23','2026-03-29','2026-03-30'],['2026-10-19','2026-10-25','2026-10-26'],['2026-12-28','2027-01-03','2027-01-04']]) {
    const w=weeks();w[0].start_date=start;w[1].start_date=null
    const r=programBlockRows(options(w));assert.equal(r[0].end,end);assert.equal(r[1].start,next)
  }
})
test('log status needs every exact planned set; skips count and unrelated logs do not',()=>{
  const w=weeks(), o=options(w), s=w[0].sessions[0]
  assert.equal(programBlockRows(o)[0].status,'Ugen er ikke fuldt logget')
  o.logs=[...logsFor(s),{exercise_id:'wrong',set_number:1}];o.logs[1].skipped=true
  assert.equal(programBlockRows(o)[0].status,'Ugen er logget')
  o.logs=[o.logs[0],o.logs[0]];assert.equal(programBlockRows(o)[0].status,'Ugen er ikke fuldt logget')
  o.logs=null;assert.equal(programBlockRows(o)[0].status,'Logstatus ikke tilgængelig')
  w[0].sessions=[];assert.equal(programBlockRows(o)[0].status,'Ingen planlagte sæt')
})
test('block is contiguous, anchored at current week, including repeated and unnamed blocks',()=>{
  const w=weeks();w.push(week('3','2026-04-06',[],'Let'),week('4','2026-04-13',[]))
  assert.deepEqual(blockWeeks(w,0).map(r=>r.index),[0,1])
  assert.deepEqual(blockWeeks(w,3).map(r=>r.index),[3])
  w[0].block_name=null;w[1].block_name='';assert.equal(blockWeeks(w,0).length,2)
  assert.deepEqual(blockWeeks([],0),[])
})
test('athlete without a block keeps the existing empty program view',()=>{
  const p=props([]);p.programBlokOversigt=true
  const tree=render(Program,p)
  assert.equal(overview(tree),undefined);assert.match(text(tree),/Dit program er på vej/)
})
test('reader is chunked, paginated, side-effect free and honest on partial failure',async()=>{
  const w=[week('1',null,Array.from({length:101},(_,i)=>session('s'+i)))],calls=[]
  const result=await readProgramBlockLogs(w,async(ids,from,to)=>{calls.push([ids.length,from,to]);return {ok:true,data:from===0&&ids.length===100?Array(500).fill({exercise_id:'s0-ex',set_number:1}):[]}})
  assert.equal(result.length,500);assert.deepEqual(calls,[[100,0,499],[100,500,999],[1,0,499]])
  assert.equal(await readProgramBlockLogs(w,async()=>({ok:false,data:[]})),null)
  assert.deepEqual(await readProgramBlockLogs([],()=>{throw Error('must not read')}),[])
})

test('imported reader factory scopes the actual query and preserves guarded failure', async()=>{
  const { supabase }=await import('./prog3Dom.mjs')
  const { lavLaesninger }=await import('./laesninger.js')
  const calls=[],errors=[]
  let fail=false
  supabase.from=table=>{
    calls.push(['from',table])
    const query={}
    for(const method of ['select','eq','in','order']) query[method]=(...args)=>{calls.push([method,...args]);return query}
    query.range=(...args)=>{calls.push(['range',...args]);return Promise.resolve(fail?{error:Error('synthetic read failure')}:{data:[{exercise_id:'s1-ex',set_number:1}]})}
    return query
  }
  const reader=lavLaesninger({onReadError:(label,id)=>err=>errors.push([label,id,err.message])})
  assert.equal((await reader.fetchProgramBlockLogs('athlete-A',weeks())).length,1)
  assert.deepEqual(calls.find(c=>c[0]==='eq'),['eq','athlete_id','athlete-A'])
  assert.deepEqual(calls.find(c=>c[0]==='in'),['in','exercise_id',['s1-ex','s2-ex']])
  assert.deepEqual(calls.find(c=>c[0]==='select'),['select','exercise_id, set_number, skipped'])
  fail=true;assert.equal(await reader.fetchProgramBlockLogs('athlete-A',weeks()),null)
  assert.equal(errors.length,1)
})
test('real component effect loads status, refreshes and ignores a late previous athlete',async()=>{
  const {enableEffects,flushEffects}=await import('./prog3Dom.mjs');enableEffects()
  const p=props();let reads=0
  p.fetchProgramBlockLogs=async()=>{reads++;return logsFor(p.allWeeks[0].sessions[0])}
  const view=mount(Program,p)
  view.render();await flushEffects();assert.equal(reads,0,'default off does not read')
  p.programBlokOversigt=true;assert.match(text(overview(view.render())),/Logstatus ikke tilgængelig/)
  await flushEffects();assert.match(text(buttons(view.render())[0]),/Ugen er logget/)
  let resolveOld
  p.fetchProgramBlockLogs=()=>new Promise(resolve=>{resolveOld=resolve})
  p.exerciseLogs=[];view.render();await flushEffects()
  p.athlete={id:'athlete-B'};p.fetchProgramBlockLogs=async()=>[]
  view.render();await flushEffects()
  resolveOld(logsFor(p.allWeeks[0].sessions[0]));await flushEffects()
  assert.match(text(buttons(view.render())[0]),/Ugen er ikke fuldt logget/)
  p.exerciseLogs=[];p.fetchProgramBlockLogs=async()=>{throw Error('synthetic offline')}
  view.render();await flushEffects()
  assert.match(text(buttons(view.render())[0]),/Logstatus ikke tilgængelig/)
})
