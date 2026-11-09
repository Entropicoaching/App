import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createUpcomingPlan, upcomingDates } from './upcomingPlanModel.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { PlanAdvice } from './KostplanAtlet.mjs'
import { historyFixture, athleteId, date, uuid } from '../dailyReference.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { deferred } from './day.fixture.mjs'
const open = (f, selected = '2026-11-08') => createUpcomingPlan({ enabled: true, athleteId, today: date, date: selected, client: f.client })
const seeded = options => {
 const f = historyFixture(options); f.plan(1, date)
 for (let i=0;i<3;i++) { const v=f.version(10+i, uuid(1),`2026-11-${8+i<10?'0':''}${8+i}`,i+1); v.portion_guidance=`  Syntetisk timing ${i}\r\nVæske <b>bogstavelig</b>\nVitamin-/mineralnotat  `; f.approve(10+i,uuid(1),date+'T10:00:00Z') }
 return f
}
test('bounded actual dates, OFF, no mutation or diary API', async()=>{
 assert.deepEqual(upcomingDates('2028-02-28'),['2028-02-28','2028-02-29','2028-03-01','2028-03-02'])
 assert.deepEqual(upcomingDates('bad'),[])
 assert.deepEqual(upcomingDates('9999-12-31'),['9999-12-31'])
 assert.equal(createUpcomingPlan({enabled:false,get client(){throw Error('OFF')}}),null)
 for (const selected of [date,'2026-11-11','2026-11-06']) assert.throws(()=>open(seeded(),selected))
 const f=seeded(), c=open(f)
 try {
  assert.deepEqual(Object.keys(c).sort(),['dispose','load','snapshot','subscribe'])
  await c.load();assert.equal(c.snapshot().plan.revision,uuid(10)); assert.ok(Object.isFrozen(c.snapshot().plan.meals[0].foods))
  assert.equal(f.writes().length,0)
 } finally {c.dispose()}
})
test('three effective dates choose exact approved versions and exact text; no future or unapproved advice leakage',async()=>{
 const f=seeded(), latest=f.version(19,uuid(1),'2026-11-08',4);latest.portion_guidance='UNAPPROVED'
 for(let i=0;i<3;i++){
  const c=open(f,`2026-11-${8+i<10?'0':''}${8+i}`)
  try{
   assert.equal(await c.load(),true);const p=c.snapshot().plan
   assert.equal(p.revision,uuid(10+i));assert.equal(p.portionGuidance,f.data[tableNames[1]][i].portion_guidance)
   const html=renderToStaticMarkup(h(PlanAdvice,{text:p.portionGuidance}))
   assert.match(html,/white-space:pre-wrap/);assert.match(html,/&lt;b&gt;bogstavelig&lt;\/b&gt;/);assert.doesNotMatch(html,/<b>|100%|UNAPPROVED/)
  }finally{c.dispose()}
 }
 assert.equal(f.writes().length,0)
})
test('advice boundary accepts null/exact 4000 codepoints, rejects malformed selected text without truncation',async()=>{
 for(const advice of [null,undefined,'🙂'.repeat(4000),' \r\nEksakt\ttekst  ']){
  const f=seeded();f.data[tableNames[1]][0].portion_guidance=advice
  const c=open(f);try{assert.equal(await c.load(),true);assert.equal(c.snapshot().plan.portionGuidance,advice??null)}finally{c.dispose()}
 }
 for(const advice of ['', ' \r\n ', 'x'.repeat(4001),42,{},false]){
  const f=seeded();f.data[tableNames[1]][0].portion_guidance=advice
  const c=open(f);try{assert.equal(await c.load(),false);assert.equal(c.snapshot().phase,'read-error');assert.equal(c.snapshot().plan,null)}finally{c.dispose()}
 }
 assert.match(renderToStaticMarkup(h(PlanAdvice,{text:null})),/ikke tilføjet råd/)
})
test('empty, missing tables and transient read errors stay distinct; same retry really re-reads and recovers',async()=>{
 const empty=historyFixture(), e=open(empty)
 try{await e.load();assert.equal(e.snapshot().phase,'empty')}finally{e.dispose()}
 for(const code of ['42P01','PGRST205']){
  const f=seeded({missing:tableNames[1],missingCode:code}),c=open(f)
  try{
   assert.equal(await c.load(),false);assert.equal(c.snapshot().phase,'unavailable')
   const count=f.calls.length;f.options.missing=false
   assert.equal(await c.load(),true);assert.equal(c.snapshot().phase,'ready');assert.ok(f.calls.length>count);assert.equal(f.writes().length,0)
  }finally{c.dispose()}
 }
 // Before the migration the plans table itself is missing: honestly no plan.
 for(const code of ['42P01','PGRST205']){
  const f=seeded({missing:tableNames[0],missingCode:code}),c=open(f)
  try{
   assert.equal(await c.load(),true);assert.equal(c.snapshot().phase,'empty');assert.equal(c.snapshot().plan,null)
   f.options.missing=false
   assert.equal(await c.load(),true);assert.equal(c.snapshot().phase,'ready');assert.equal(f.writes().length,0)
  }finally{c.dispose()}
 }
 const f=seeded({error:'42501'}), c=open(f)
 try{await c.load();assert.equal(c.snapshot().phase,'read-error'); f.options.error=null;await c.load();assert.equal(c.snapshot().phase,'ready')}finally{c.dispose()}
})
test('late overlapping loads and disposal never publish obsolete responses; retained retry cannot read after disposal',async()=>{
 const held=deferred();let first=true
 const f=seeded({async before(call){if(first&&call.table===tableNames[0]&&call.limit!==0){first=false;await held.promise}}}), c=open(f)
 const old=c.load();await new Promise(resolve=>setImmediate(resolve))
 const newer=c.load();await newer;const state=c.snapshot();held.resolve();assert.equal(await old,false);assert.strictEqual(c.snapshot(),state)
 const held2=deferred();f.options.before=async()=>held2.promise
 const pending=c.load();const retained=c.load;c.dispose();const atDisposal=c.snapshot();held2.resolve()
 assert.equal(await pending,false);assert.strictEqual(c.snapshot(),atDisposal);const count=f.calls.length;assert.equal(await retained(),false);assert.equal(f.calls.length,count);assert.equal(f.writes().length,0)
})
test('adapter default unavailable behavior and write snapshot remain unchanged',async()=>{
 const f=historyFixture({missing:true})
 assert.equal(await createPlanAdapter({enabled:true,athleteId,date,client:f.client}).loadActive(),null)
 assert.equal(f.writes().length,0)
})


test('selected advice stays with its immutable response; later corrections require a fresh read and null never borrows older advice', async () => {
 const f = seeded(), c = open(f)
 try {
  await c.load(); const first = c.snapshot()
  const correction = f.version(20, uuid(1), '2026-11-08', 5)
  correction.portion_guidance = null
  f.approve(20, uuid(1), date + 'T10:00:01Z')
  assert.equal(first.plan.revision, uuid(10)); assert.match(first.plan.portionGuidance, /timing 0/)
  await c.load(); assert.equal(c.snapshot().plan.revision, uuid(20)); assert.equal(c.snapshot().plan.portionGuidance, null)
  assert.equal(first.plan.revision, uuid(10)); assert.match(first.plan.portionGuidance, /timing 0/)
  assert.equal(f.writes().length, 0)
 } finally { c.dispose() }
})
