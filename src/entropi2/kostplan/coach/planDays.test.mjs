import test from 'node:test'
import assert from 'node:assert/strict'
import { withDatabase, scope, profile, names, stranger, coachId } from './generatorSql.fixture.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { portionGuidance, planDate, catalogFoods } from './model.mjs'
import { startPlanActivation } from './activation.mjs'
import { activationSnapshot, createPlanAdapter } from '../planAdapter.mjs'
import { supportedPlanSnapshot } from '../sqlSnapshot.mjs'
import { createFood } from '../foedevarer/catalog.mjs'

const template = ['Morgenmad', 'Frokost', 'Aftensmad'].map((name,i) => ({id:`m-${i}`,name,items:[]}))
const open = (storage, extra={}) => openPortalPlan({enabled:true,...scope,athlete:profile,template,storage:()=>storage,...extra})
const plan = c => ({athleteId:scope.athleteId,date:scope.date,goal:c.snapshot().form.goal,intensity:c.snapshot().form.intensity,meals:c.snapshot().meals,portionGuidance:c.snapshot().portionGuidance})
const connect = async (c, f) => {
 const stop=startPlanActivation({controller:c,client:f.client,...scope})
 for(let i=0;i<1000 && c.snapshot().activationState==='checking';i++) await new Promise(r=>setImmediate(r))
 assert.equal(c.snapshot().activationState,'ready');return stop
}

test('optional advice is bounded plain text; dates are exact ISO and within existing supported window', () => {
 for(const absent of [undefined,null,'',' \n\t ']) assert.equal(portionGuidance(absent),undefined)
 for(const bad of [7,{},false,[], 'x'.repeat(4001)]) assert.throws(()=>portionGuidance(bad))
 assert.equal(portionGuidance('<script>literal & text</script>'),'<script>literal & text</script>')
 assert.equal(portionGuidance('x'.repeat(4000)).length,4000)
 for(const d of ['1900-01-07','2028-02-29','9999-12-24']) assert.equal(planDate(d),true)
 for(const d of ['1900-01-06','2027-02-29','2028-02-30','2028-2-29','9999-12-25',null]) assert.equal(planDate(d),false)
})

test('local advice explicitly saves, restores, preserves legacy absent drafts and fails closed for invalid stored advice', async () => {
 const storage=memoryStorage(), c=open(storage).controller
 assert.equal(c.setAdvice('x'.repeat(4001)),false); assert.equal(c.snapshot().portionGuidance,'')
 assert.equal(c.setAdvice('Råd <em>som tekst</em>'),true); assert.equal(storage.data.size,0)
 assert.equal(c.generate(),true); assert.equal(await c.save(),true)
 const key=draftKey(scope.coachId,profile.id,scope.date), bytes=storage.data.get(key)
 assert.equal(JSON.parse(bytes).plan.portionGuidance,'Råd <em>som tekst</em>')
 const restored=open(storage);assert.equal(restored.loadError,null);assert.equal(restored.controller.snapshot().portionGuidance,'Råd <em>som tekst</em>')
 assert.equal(restored.controller.snapshot().dirty,false);assert.equal(restored.controller.setAdvice('Råd <em>som tekst</em>'),false)
 assert.equal(restored.controller.setAdvice('Ændret råd'),true);assert.equal(restored.controller.snapshot().dirty,true)
 const other=open(storage,{date:'2026-11-08'});assert.equal(other.controller.snapshot().portionGuidance,'')
 const legacy=JSON.parse(bytes);delete legacy.plan.portionGuidance;storage.data.set(key,JSON.stringify(legacy))
 assert.equal(open(storage).controller.snapshot().portionGuidance,'');assert.equal(open(storage).loadError,null)
 for(const bad of ['x'.repeat(4001),{},false]) {
  storage.data.set(key,JSON.stringify({...legacy,plan:{...legacy.plan,portionGuidance:bad}}))
  const next=open(storage);assert.ok(next.loadError);assert.equal(await next.controller.save(),false)
 }
 storage.data.set(key,bytes)
 const changed=open(storage,{athlete:{...profile,bodyweight:profile.bodyweight+5}}).controller
 assert.equal(changed.snapshot().portionGuidance,'Råd <em>som tekst</em>');assert.equal(changed.snapshot().planTargets,null)
 assert.equal(await changed.save(),false)
})

test('actual SQL limits, foreign owner, wrong date, unchanged/changed advice and known-zero/unknown snapshots stay guarded', {timeout:60000}, async()=>withDatabase(async f=>{
 const c=open(memoryStorage()).controller;c.generate();c.setAdvice('x'.repeat(4000));await c.save()
 const adapter=createPlanAdapter({enabled:true,client:f.client,...scope}), p=plan(c)
 await assert.rejects(adapter.activate({...p,date:'2026-11-08'}));assert.equal(f.calls.filter(c=>c.payload).length,0)
 await f.login(stranger);await assert.rejects(adapter.activate(p));assert.equal(f.calls.filter(c=>c.payload && c.table===names[2]).length,0)
 await f.login(coachId);await adapter.activate(p)
 const version=(await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v')).rows[0].value
 assert.equal(version.portion_guidance.length,4000)
 const canonical=activationSnapshot(p)
 assert.equal(canonical.portion_guidance,'x'.repeat(4000))
 assert.deepEqual(supportedPlanSnapshot({...version,portion_guidance:null}),supportedPlanSnapshot({...version,portion_guidance:undefined}))
 assert.notDeepEqual(supportedPlanSnapshot(version),supportedPlanSnapshot({...version,portion_guidance:'Changed advice'}))
 const food=createFood({id:'test-zero',name:'Synthetic zero',preparation:'raw',source:{citation:'Synthetic',verification:'synthetic'},nutrientsPer100g:{energyKcal:100,proteinG:0,carbohydrateG:10,fatG:2,ironMg:null}})
 const zero=activationSnapshot({...p,meals:[{id:'meal-zero',name:'Synthetic',items:[{grams:100,food:catalogFoods([food])[0]}]}]})
 assert.equal(zero.meals[0].portions[0].food.nutrientsPer100g.proteinG,0);assert.equal(zero.meals[0].portions[0].food.nutrientsPer100g.ironMg,null)
 for(const mutate of [food=>{food.extra='bad'},food=>{food.source.extra='bad'},food=>{food.nutrientsPer100g.extra=0}]){
  const bad=structuredClone(p);mutate(bad.meals[0].items[0].food.nutrition);assert.throws(()=>activationSnapshot(bad))
 }
 await assert.rejects(adapter.activate({...p,portionGuidance:'x'.repeat(4001)}))
}))

test('all three actual SQL lost replies freeze advice and preserve original IDs, payload and reconciliation', {timeout:60000}, async()=>{
 for(const lost of names) await withDatabase(async f=>{
  const storage=memoryStorage(),c=open(storage).controller;c.generate();c.setAdvice('Reserved <b>plain</b> advice');await c.save()
  let stop=await connect(c,f)
  try {
   assert.equal(await c.activate(),false);assert.equal(c.snapshot().activationPending,true)
   const bytes=[...storage.data],writes=f.calls.filter(c=>c.payload), ids=writes.map(c=>c.payload.id??c.payload.version_id)
   assert.equal(c.setAdvice('replacement'),false);assert.equal(c.setAdvice('x'.repeat(4001)),false);assert.equal(await c.save(),false);assert.equal(c.generate(),false)
   assert.deepEqual([...storage.data],bytes)
   stop();const restored=open(storage).controller;const close=await connect(restored,f)
   try {
    assert.equal(restored.snapshot().portionGuidance,'Reserved <b>plain</b> advice')
    assert.equal(await restored.activate(),false);assert.equal(f.calls.filter(c=>c.payload).length,writes.length)
    if(lost!==names[2]) assert.equal(restored.setAdvice('forbidden'),false)
   } finally {close()}
   stop=await connect(c,f)
   if(lost!==names[2]) assert.equal(await c.activate(),true)
   const final=f.calls.filter(c=>c.payload)
   assert.deepEqual(final.slice(0,ids.length).map(c=>c.payload.id??c.payload.version_id),ids)
   for(const n of names) assert.equal(Number((await f.db.query(`select count(*) n from public.${n}`)).rows[0].n),1)
   const v=(await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
   assert.equal(v.portion_guidance,'Reserved <b>plain</b> advice')
   assert.equal(v.id,final.find(c=>c.table===names[1]).payload.id)
   assert.deepEqual(v.meals,final.find(c=>c.table===names[1]).payload.meals)
  } finally {stop()}
 },{lost})
})


test('actual writer freezes advice in the pending fingerprint for each lost SQL response', {timeout:60000}, async()=>{
 for(const lost of names) await withDatabase(async f=>{
  const c=open(memoryStorage()).controller;c.generate();c.setAdvice('Original pending advice')
  const p=plan(c), adapter=createPlanAdapter({enabled:true,client:f.client,...scope})
  await assert.rejects(adapter.activate(p))
  const count=f.calls.filter(c=>c.payload).length, ids=f.calls.filter(c=>c.payload).map(c=>c.payload.id??c.payload.version_id)
  await assert.rejects(adapter.activate({...p,portionGuidance:'Changed pending advice'}),/uafklarede/)
  assert.equal(f.calls.filter(c=>c.payload).length,count)
  await adapter.activate(p)
  for(const n of names) assert.equal(Number((await f.db.query(`select count(*) n from public.${n}`)).rows[0].n),1)
  assert.deepEqual(f.calls.filter(c=>c.payload).slice(0,ids.length).map(c=>c.payload.id??c.payload.version_id),ids)
  assert.equal((await f.db.query('select portion_guidance from public.kostplan_v1_versions')).rows[0].portion_guidance,'Original pending advice')
 },{lost})
})
