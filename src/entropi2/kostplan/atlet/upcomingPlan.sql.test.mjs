import test from 'node:test'
import assert from 'node:assert/strict'
import { withDatabase, athleteId, owner, stranger, names } from '../coach/generatorSql.fixture.mjs'
import { storedSnapshot, uuid } from '../dailyReference.fixture.mjs'
import { createUpcomingPlan } from './upcomingPlanModel.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { all, propsOf, hostFixture, tick } from '../../nutrition/diaryTemplate.fixture.mjs'

const today = '2026-11-07'
const basis = Object.fromEntries(['weight_trend','training_volume','training_intensity','food_log','readiness','competition_date'].map(k=>[k,null]))
test('original SQL + athlete RLS: three immutable future versions retain exact advice and never write during preview', {timeout:60000}, async()=>withDatabase(async f=>{
 // Synthetic deterministic seed. Original constraints/triggers remain enabled.
 await f.db.exec('reset role')
 await f.db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)',[uuid(901),athleteId,today])
 const versions=[]
 for(let i=0;i<3;i++){
  const date=`2026-11-${8+i<10?'0':''}${8+i}`, advice=`  Syntetisk timing ${i}\nVæske <script>literal</script>\r\nVitamin og mineralnotat ${i}  `
  const snapshot=storedSnapshot(100+i*20,10+i)
  await f.db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals,portion_guidance)
   values($1,$2,$3,$4,$5,$6,'Synthetic fixture',$7,$8,$9,$10)`,[uuid(910+i),uuid(901),i+1,date,today,JSON.stringify(basis),snapshot.goal,snapshot.intensity,JSON.stringify(snapshot.meals),advice])
  await f.db.query(`insert into public.kostplan_v1_approvals(version_id,approval_kind,approved_at) values($1,'coach',$2)`,[uuid(910+i),today+'T10:00:00Z'])
  versions.push({date,advice,id:uuid(910+i)})
 }
 const before=(await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v order by version_no')).rows
 await f.login(owner)
 for(const expected of versions){
  const c=createUpcomingPlan({enabled:true,athleteId,today,date:expected.date,client:f.client})
  try {
   assert.equal(await c.load(),true);const s=c.snapshot()
   assert.equal(s.plan.revision,expected.id);assert.equal(s.plan.portionGuidance,expected.advice)
   assert.equal(s.plan.meals[0].foods[0].grams,100)
   assert.equal(await c.load(),true)
  }finally{c.dispose()}
 }
 // The actual athlete route also reads these original SQL rows through RLS.
 const dom = hostFixture(), root = createRoot(dom.host), local = new Map(), storageWrites = []
 dom.globals({ localStorage: { getItem: k => local.get(k) ?? null, setItem(k, v) { storageWrites.push(k); local.set(k, v) } } })
 const wait = async predicate => {
  for (let i = 0; i < 200 && !predicate(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
  assert.ok(predicate(), dom.host.textContent.slice(0, 500))
 }
 try {
  await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, {
   enabled: true, athlete: { id: athleteId }, date: today, client: f.client, foods: [], weightLogs: [], currentDay: () => today,
  }))); await tick() })
  for (const expected of versions) {
   const picker = all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
   await act(async () => { propsOf(picker).onChange({ currentTarget: { value: expected.date } }); await tick() })
   await wait(() => dom.host.textContent.includes(expected.advice))
   const section = all(dom.host, 'section').find(n => n.getAttribute('aria-label') === 'Kommende kostplan')
   assert.ok(section); assert.equal(all(section, 'input').length, 0)
   const advice = all(section, 'section').find(n => n.getAttribute('aria-label') === 'Planens råd')
   assert.equal(all(advice, 'p')[0].textContent, expected.advice)
   assert.equal(all(advice, 'script').length, 0)
  }
  assert.equal(storageWrites.length, 0)
 } finally { try { await act(async () => { root.unmount(); await tick() }) } finally { dom.restore() } }
 assert.equal(f.calls.filter(c=>c.payload).length,0)
 assert.ok(f.calls.every(c=>[...names, 'meal_logs'].includes(c.table)))
 assert.ok(f.calls.some(c=>c.columns?.includes('portion_guidance')))
 await f.login(stranger)
 const unseen=createUpcomingPlan({enabled:true,athleteId,today,date:versions[0].date,client:f.client})
 try{await unseen.load();assert.equal(unseen.snapshot().phase,'empty')}finally{unseen.dispose()}
 // Approved source text is immutable, including for its author.
 await f.login(owner)
 await assert.rejects(f.db.query('update public.kostplan_v1_versions set portion_guidance=$1 where id=$2',['changed',versions[0].id]))
 await f.db.exec('reset role')
 assert.deepEqual((await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v order by version_no')).rows,before)
 assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n),0)
 await f.login(owner)
 const todayPlan=await createPlanAdapter({enabled:true,athleteId,date:today,client:f.client}).loadActive()
 assert.equal(todayPlan,null,'future versions do not leak into today')
}))
