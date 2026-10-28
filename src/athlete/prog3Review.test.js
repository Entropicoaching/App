import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text, enableEffects, flushEffects } from './prog3Dom.mjs'
install()
const {programBlockRows, readProgramBlockLogs}=await import('./programBlockOverview.mjs')
const {default:Program}=await import('./ProgramTab.jsx')
const helpers=await import('./ugeHjaelp.js')
const weeks=[{id:'a',week_number:8,start_date:'2026-10-19',block_name:'A',sessions:[]},
  {id:'b',week_number:9,start_date:'2026-10-26',block_name:'A',sessions:[]}]

test('counter: Sunday and following Monday stay distinct at the autumn boundary',()=>{
  const rows=programBlockRows({allWeeks:weeks,activeWeekIdx:0,logs:[]})
  assert.deepEqual(rows.map(r=>[r.start,r.end]),[['2026-10-19','2026-10-25'],['2026-10-26','2026-11-01']])
  assert.deepEqual(rows.map(r=>r.current),[true,false])
})
test('counter: inferred dates use week numbers, including gaps; missing dates are explicit',()=>{
  const w=weeks.map(x=>({...x}));w[1].week_number=11;w[1].start_date=null
  assert.equal(programBlockRows({allWeeks:w,activeWeekIdx:0})[1].start,'2026-11-09')
  w[0].start_date='2026-02-30'
  assert.equal(programBlockRows({allWeeks:w,activeWeekIdx:0})[0].date,'Dato ikke fastlagt')
})
test('counter: earlier week without logs never becomes completed by its position',()=>{
  const w=weeks.map(x=>({...x,sessions:[{id:x.id,weekday:0,exercises:[{id:x.id,sets:2}]}]}))
  const r=programBlockRows({allWeeks:w,activeWeekIdx:1,logs:[{exercise_id:'b',set_number:1},{exercise_id:'b',set_number:2}]})
  assert.equal(r[0].status,'Ugen er ikke fuldt logget');assert.equal(r[1].status,'Ugen er logget')
})
test('counter: failed second page discards partial success',async()=>{
  const w=[{sessions:[{exercises:[{id:'x',sets:501}]}]}]
  assert.equal(await readProgramBlockLogs(w,async(_,offset)=>offset?{ok:false}:{ok:true,data:Array(500).fill({exercise_id:'x',set_number:1})}),null)
})
test('counter: real future-week click clears past logs and retains active marker',async()=>{
  enableEffects();const calls=[]
  const p={...helpers,allWeeks:weeks,currentWeek:weeks[0],viewingWeekIdx:0,athlete:{id:'only-A'},exerciseLogs:[],pastLogs:[],
    readinessLog:{readiness_score:90},programBlokOversigt:true,
    fetchProgramBlockLogs:async()=>[],setViewingWeekIdx:i=>{p.viewingWeekIdx=i;calls.push(['view',i])},
    setProgOpenSession:v=>calls.push(['close',v]),setPastLogs:v=>calls.push(['clear',v]),fetchPastLogs:()=>{throw Error('future must not fetch past')}}
  const instance=mount(Program,p);let tree=instance.render();await flushEffects()
  const section=nodes(tree,n=>n.props['aria-label']==='Hele din aktuelle blok')[0]
  nodes(section,n=>n.type==='button')[1].props.onClick()
  assert.deepEqual(calls,[['view',1],['close',null],['clear',[]]])
  tree=instance.render()
  assert.equal(nodes(tree,n=>n.type==='button'&&n.props['aria-current']==='step').length,1)
  assert.match(text(tree),/Aktuel uge/)
})
