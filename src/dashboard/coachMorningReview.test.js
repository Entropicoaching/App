import { test } from 'node:test'
import assert from 'node:assert/strict'
import { install } from './coachMorningLoader.mjs'
import { reset, state, text, walk } from './coachMorningFake.mjs'
install()
const { morningRows, morningDay, yesterday, CoachMorning, readMorningSource } = await import('./coachMorning.mjs')
const athletes=[{id:'a',name:'A'}]
const source = rows => ({state:'ready',day:'2026-10-27',ids:['a'],rows})
const now=new Date('2026-10-27T12:00:00Z')
test('counter: overlapping reads cannot replace newer capture with an older result', async () => {
  let value={}, resolveOld
  const set=fn=>{value=fn(value)}
  const old=readMorningSource(true,'logs',['a'],set,()=>new Promise(resolve=>{resolveOld=resolve}))
  await readMorningSource(true,'logs',['a'],set,()=>({data:[],error:null}))
  resolveOld({data:[{athlete_id:'a'}],error:null});await old
  assert.deepEqual(value.logs.rows,[])
})
test('counter: read-by-coach is not a reply; later coach reply closes only its track', () => {
  const rows=[{athlete_id:'a',sender_role:'athlete',read_by_coach:true,created_at:'2026-10-26T10:00:00Z'}, {athlete_id:'a',sender_role:'coach',category:'teknik',created_at:'2026-10-26T11:00:00Z'}]
  assert.equal(morningRows({athletes,now,data:{messages:source(rows)}}).rows[1].count,1)
  rows.push({athlete_id:'a',sender_role:'coach',created_at:'2026-10-26T11:00:00Z'})
  assert.equal(morningRows({athletes,now,data:{messages:source(rows)}}).rows[1].count,0)
})
test('counter: tied conflicting reply timestamps are uncertain, never a positive lower bound', () => {
  const rows=['athlete','coach'].map(sender_role=>({athlete_id:'a',sender_role,created_at:'2026-10-26T10:00:00Z'}))
  for(const ordered of [rows,rows.slice().reverse()]) {
    const row=morningRows({athletes,now,data:{messages:source(ordered)}}).rows[1]
    assert.equal(row.count,0);assert.equal(row.complete,false)
  }
})
test('counter: day shift updates yesterday and refuses a complete zero from yesterday capture', () => {
  assert.equal(yesterday('2026-10-26T22:59:59Z'),'2026-10-25')
  assert.equal(yesterday('2026-10-26T23:00:00Z'),'2026-10-26')
  for(const value of ['2026-02-30T12:00:00Z','2026-10-26','2026-10-26T12:00:00']) assert.equal(morningDay(value),null)
  reset();state.values=[new Date('2026-10-28T10:00:00Z')]
  const tree=CoachMorning({enabled:true,athletes,data:{logs:source([]),messages:source([]),videos:source([])}})
  assert.equal(walk(tree,n=>n.type==='summary').length,3)
  assert.equal(walk(tree,n=>n.type==='summary').filter(n=>text(n).startsWith('Ukendt antal')).length,3)
  assert.match(text(tree),/2026-10-27/)
})
test('counter: cap and null results never turn missing data into a confirmed zero',async()=>{
  let value={};const set=fn=>{value=fn(value)}
  await readMorningSource(true,'messages',['a'],set,()=>({data:Array(1000).fill({}),error:null}))
  assert.equal(value.messages.state,'partial')
  await readMorningSource(true,'messages',['a'],set,()=>({data:null,error:null}))
  assert.equal(value.messages.state,'error')
  const rows=morningRows({athletes,now,data:{messages:value.messages}}).rows
  assert.ok(rows.every(r=>!r.complete))
})
