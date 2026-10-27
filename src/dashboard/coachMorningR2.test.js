import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './coachMorningLoader.mjs'
import { reset, state, walk, text } from './coachMorningFake.mjs'
import { assertPureGraph } from '../coachNoteDependencyGuard.mjs'
install()
const source = await import('./coachMorningSource.mjs')
const { CoachMorning, morningRows } = await import('./coachMorning.mjs')
const { default: Home } = await import('./ForsideView.jsx')
const now = new Date('2026-10-27T12:00:00Z')
const athletes = [{id:'a',name:'Anna'},{id:'b',name:'Bo'}]
const ready = rows => ({state:'ready',day:'2026-10-27',ids:['a','b'],rows})

test('R2 counter 1: actual capture dependency graph is pure and React-free', () => {
  assertPureGraph('src/dashboard/coachMorningSource.mjs', path => readFileSync(new URL('../'+path.slice(4), import.meta.url),'utf8'))
  assert.equal(typeof source.readMorningSource,'function')
})
test('R2 counter 2: OFF preserves exact query promise and rejection without capture', async () => {
  const promise=Promise.reject(Error('synthetic transport'))
  const result=source.readMorningSource(false,'logs',[],()=>assert.fail('OFF capture'),()=>promise)
  assert.equal(result,promise); await assert.rejects(result,/synthetic transport/)
})
test('R2 counter 3: concurrent reads keep newest membership and error', async () => {
  let value={}, release
  const set=fn=>{value=fn(value)}
  const old=source.readMorningSource(true,'messages',['a'],set,()=>new Promise(r=>{release=r}))
  await source.readMorningSource(true,'messages',['b'],set,()=>({data:null,error:Error('synthetic')}))
  release({data:[],error:null});await old
  assert.equal(value.messages.state,'error'); assert.deepEqual(value.messages.ids,['b'])
})
test('R2 counter 4: partial membership and stale day never confirm zero', () => {
  for(const extra of [{ids:['a']},{day:'2026-10-26'},{state:'partial'}]) {
    const data=Object.fromEntries(['logs','messages','videos'].map(k=>[k,{...ready([]),...extra}]))
    assert.ok(morningRows({athletes,data,now}).rows.every(r=>!r.complete))
  }
})
test('R2 counter 5: Danish midnight and DST use calendar yesterday', () => {
  assert.equal(source.yesterday('2026-03-29T22:00:00Z'),'2026-03-29')
  assert.equal(source.yesterday('2026-10-25T23:00:00Z'),'2026-10-25')
  assert.equal(source.morningDay('2026-02-30T12:00:00Z'),null)
})
test('R2 counter 6: actual home preserves template flags, coach and sender under morning opt-in', () => {
  const send=()=>assert.fail('automatic send')
  const props={athletes:[],hiddenAthleteIds:new Set(),calendarWeeks:{},coachPriorityItems:[],coachMorning:true,
    coachTemplateMessages:true,coachId:'synthetic',sendTemplateMessage:send}
  const tree=Home(props)
  const forwarded=walk(tree,n=>n.props?.sendTemplateMessage===send)
  assert.equal(forwarded.length,1);assert.equal(forwarded[0].props.templateMessages,true)
  assert.equal(forwarded[0].props.coachId,'synthetic')
})
test('R2 counter 7: actual home hides foreign links and morning buttons use existing routes', () => {
  const calls=[], data={logs:ready([{athlete_id:'a',logged_at:'2026-10-26T12:00:00Z'}]),messages:ready([]),videos:ready([])}
  const props={athleteCurrentWeek:{},loading:true,athletes,hiddenAthleteIds:new Set(['b']),calendarWeeks:{},coachPriorityItems:[],coachMorning:true,
    coachMorningData:data,openProfile:(...a)=>calls.push(a),setSelectedAthlete:()=>{},setView:()=>{}}
  const block=walk(Home(props),n=>n.type===CoachMorning)[0]
  reset();state.values=[now]
  const tree=CoachMorning(block.props)
  assert.equal(walk(tree,n=>n.type==='summary').length,3)
  const anna=walk(tree,n=>n.type==='button'&&text(n)==='Anna')[0]
  anna.props.onClick();assert.deepEqual(calls,[[athletes[0],'log','list']])
  assert.equal(walk(tree,n=>n.type==='button'&&text(n)==='Bo').length,0)
})
