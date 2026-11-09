import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerHooks } from 'node:module'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { createNutritionController, foodPortion } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { fridaLogFoods, extendedFridaLogFoods } from './fridaLogFoods.mjs'
import { FRIDA_FOODS } from '../kostplan/foedevarer/frida55.mjs'
import { createFood } from '../kostplan/foedevarer/catalog.mjs'
import { LOCAL_FOODS } from '../../athlete/lokaleFoedevarer.js'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from '../kostplan/atlet/daySession.fixture.mjs'

const key=(host,name)=>host.querySelectorAll('[data-focus]').find(n=>n.getAttribute('data-focus')===name)
const enter=(host,name,value,event='input')=>{ const n=key(host,name); assert.ok(n,name); n.value=value; n.dispatch(event,{target:n}) }
const click=(host,name)=>{ const n=key(host,name); assert.ok(n,name); n.dispatch('click') }
const deferred=()=>{ let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b}); return {promise,resolve,reject} }
const manual=['Måltid','Energi (kcal)','Protein (g)','Kulhydrat (g)','Fedt (g)'].map(k=>'field-'+k)
const draft=host=>[...manual,'food-search','food-choice','field-Mængde','unit-choice'].map(k=>key(host,k)?.value)
const own=Object.freeze({id:'synthetic-custom',name:'Egen skål',isCustom:true,unit_label:'skål',unit_grams:60,kcal100:130,protein100:12,carb100:15,fat100:3})
const prefix=Object.freeze([own,...LOCAL_FOODS])
const form=host=>key(host,'log-portion').parentElement
async function wait(host,name) { for(let i=0;i<80 && key(host,name)?.disabled;i++) await flush() }
async function mounted(t, options={}) {
  const doc=sessionReactDocument(), host=doc.createElement('div'); doc.body.append(host)
  let day=date, imports=0
  const saves=[],writes=[]
  const c=createNutritionController({enabled:true,athlete:{id:athleteId},date,foods:prefix,currentDay:()=>day,
    now:()=>Date.parse(date+'T12:00:00Z'),storage:{getItem:()=>null,setItem:(...args)=>writes.push(args)},
    contracts:{load:async()=>[],save:async row=>{saves.push(row);return options.save ? options.save(row):true},...options.contracts},
    loadExtendedFridaFoods:()=>{imports++;return options.load ? options.load():extendedFridaLogFoods()},...options.controller})
  const cleanup=mountNutrition(host,c,{clock:()=>new Date(day+'T12:00:00Z')}); t.after(cleanup); await flush()
  const old=async()=>{click(host,'enable-frida-log');await wait(host,'enable-frida-log')}
  return {host,doc,c,cleanup,saves,writes,old,imports:()=>imports,setDay:d=>{day=d}}
}
async function route(t) {
  t.mock.timers.enable({apis:['Date'],now:new Date(date+'T12:00:00Z')})
  const f=fixture(),doc=sessionReactDocument(),host=doc.createElement('div');doc.body.append(host)
  const globals={window:doc.defaultView,IS_REACT_ACT_ENVIRONMENT:true,localStorage:f.storage}
  const originals=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
  for(const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis,k,{configurable:true,value:v})
  const props={enabled:true,athlete:{id:athleteId},date,client:f.client,foods:prefix,currentDay:()=>date,weightLogs:[],weightStatus:{athleteId,state:'ready'}}
  const root=createRoot(host),show=()=>act(async()=>{root.render(h(StrictMode,null,h(Entropi2Kost,props)));await flush();await flush()})
  t.after(async()=>{try{await act(async()=>root.unmount())}finally{
    for(const [k,d] of originals) {if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}
    t.mock.timers.reset()
  }})
  await show()
  const press=node=>act(async()=>{host.dispatch('click',{type:'click',target:node,button:0,bubbles:true,stopPropagation(){}});await flush()})
  return {f,doc,host,props,root,show,press}
}

test('cold normal StrictMode and original40 click never load new80; new80 remains a second explicit choice',async t=>{
  const evaluated=[]
  const observer=registerHooks({load(url,context,next){if(/frida55Extended(?:Loader|\.data)?\.mjs$/.test(url))evaluated.push(url);return next(url,context)}})
  try{
    const r=await route(t)
    assert.deepEqual(evaluated,[])
    assert.equal(key(r.host,'enable-extended-frida-log'),undefined)
    await act(async()=>{click(r.host,'enable-frida-log');await wait(r.host,'enable-frida-log')})
    assert.deepEqual(evaluated,[])
    assert.ok(key(r.host,'enable-extended-frida-log'))
    assert.equal(r.f.rows.length+r.f.writes.length,0)
  }finally{observer.deregister()}
})

test('normal StrictMode: progressive old40/new80, dirty drafts/source, top Log mad, actual new portion and only explicit original seven-field writer',async t=>{
  const r=await route(t),{host,f}=r
  assert.equal(key(host,'enable-extended-frida-log'),undefined)
  assert.equal(key(host,'food-choice').querySelectorAll('option').length,prefix.length)
  for(const [i,k]of manual.entries()) enter(host,k,['Bevar manuel','100,5','','0','2,5'][i])
  enter(host,'unit-choice','1','change');enter(host,'field-Mængde','1,75');enter(host,'food-search','skål')
  const original=draft(host)
  await act(async()=>{click(host,'enable-frida-log');await wait(host,'enable-frida-log')})
  assert.deepEqual(draft(host),original)
  enter(host,'food-search','')
  assert.equal(key(host,'food-choice').querySelectorAll('option').length,prefix.length+40)
  enter(host,'food-choice',String(prefix.length),'change');enter(host,'field-Mængde','37,5');enter(host,'food-search','Jordbær')
  key(host,'frida-source-frida55:1').open=true
  const before=draft(host), calls=[f.calls.length,f.plan.calls.length,f.writes.length]
  assert.ok(Number.parseFloat(key(host,'enable-extended-frida-log').style.minHeight)>=44)
  await act(async()=>{click(host,'enable-extended-frida-log');await wait(host,'enable-extended-frida-log')})
  assert.equal(key(host,'enable-extended-frida-log'),undefined)
  assert.deepEqual(draft(host),before);assert.equal(key(host,'frida-source-frida55:1').open,true)
  assert.deepEqual([f.calls.length,f.plan.calls.length,f.writes.length],calls)
  const top=host.querySelectorAll('button').find(n=>n.textContent==='Log mad')
  const currentForm=form(host);await r.press(top)
  assert.equal(form(host),currentForm);assert.equal(r.doc.activeElement,key(host,'food-search'))
  enter(host,'food-search','')
  const options=key(host,'food-choice').querySelectorAll('option'), added=await extendedFridaLogFoods()
  assert.equal(options.length,prefix.length+120)
  assert.deepEqual(options.slice(prefix.length+40).map(n=>n.textContent),added.map(food=>food.name+' · Frida-reference ('+food.id+')'))
  assert.deepEqual(options.slice(0,prefix.length).map(n=>n.textContent),prefix.map(food=>food.name))
  const food=added[0], index=prefix.length+40
  enter(host,'food-search',food.name);enter(host,'food-choice',String(index),'change');enter(host,'field-Mængde','137,5')
  assert.ok(key(host,'frida-source-'+food.id).textContent.includes(food.source.citation))
  assert.ok(key(host,'frida-source-'+food.id).textContent.includes(food.preparation))
  assert.equal(key(host,'extended-frida-per100').textContent,
    `Pr. 100 g: ${food.kcal100} kcal · ${food.protein100} g protein · ${food.carb100} g kulhydrat · ${food.fat100} g fedt`)
  assert.equal(f.rows.length,0)
  r.props.weightInput='73,5';await r.show();assert.equal(key(host,'field-Mængde').value,'137,5')
  const reference=(await import('../kostplan/foedevarer/frida55Extended.mjs')).ADDITIONAL_FRIDA_FOODS[0]
  const expected={meal:reference.name+' · 138 g',...Object.fromEntries(Object.entries({kcal:'energyKcal',protein:'proteinG',carb:'carbohydrateG',fat:'fatG'})
    .map(([flat,nutrient])=>[flat,Math.round(reference.nutrientsPer100g[nutrient]*1.375)]))}
  await act(async()=>{form(host).dispatch('submit');await flush();await flush()})
  assert.deepEqual(f.rows,[{athlete_id:athleteId,date,id:'synthetic-diary-1',...expected}])
  const insert=f.calls.find(c=>c.action==='insert')
  assert.equal(f.calls.filter(c=>c.action==='insert').length,1)
  assert.deepEqual(insert.value,{athlete_id:athleteId,date,...expected})
  assert.equal(Object.keys(f.rows[0]).length,8) // seven original payload fields + synthetic identity
  assert.ok(insert);assert.equal(f.plan.writes().length,0)
})

test('pending exactly80 append once, preserves default objects/order, drafts, query/units; no automatic retry',async t=>{
  const gate=deferred(), added=await extendedFridaLogFoods(), r=await mounted(t,{load:()=>gate.promise})
  assert.equal(await r.c.enableExtendedFridaFoods(()=>true),false);assert.equal(r.imports(),0)
  await r.old();const beforeFoods=r.c.snapshot().foods
  enter(r.host,manual[0],'Manuel kladde');enter(r.host,'field-Mængde','2,75');enter(r.host,'unit-choice','1','change');enter(r.host,'food-search','skål')
  const before=draft(r.host)
  click(r.host,'enable-extended-frida-log');click(r.host,'enable-extended-frida-log')
  assert.equal(r.imports(),1);assert.equal(await r.c.enableExtendedFridaFoods(()=>true),false)
  gate.resolve(added);await flush()
  assert.equal(r.c.snapshot().extendedFridaLog.status,'enabled')
  assert.deepEqual(r.c.snapshot().foods.slice(0,beforeFoods.length),beforeFoods)
  assert.deepEqual(draft(r.host),before);assert.equal(r.saves.length+r.writes.length,0)
  assert.equal(await r.c.enableExtendedFridaFoods(()=>true),false);assert.equal(r.imports(),1)
  // The caller's original prefix remains untouched, including its unit identity.
  assert.equal(prefix[0],own);assert.equal(Object.isFrozen(own),true)
})

for(const kind of ['null','nan','infinite','negative','missing','collision','duplicate','source','too-many']) {
  test('rejects entire new80 batch and explicit retry preserves dirty state: '+kind,async t=>{
    const actual=await extendedFridaLogFoods(),bad=actual.map(f=>({...f}));let calls=0
    if(kind==='null')bad[79].fat100=null
    if(kind==='nan')bad[79].kcal100=NaN
    if(kind==='infinite')bad[79].protein100=Infinity
    if(kind==='negative')bad[79].carb100=-1
    if(kind==='missing')delete bad[79].fat100
    if(kind==='collision')bad[79]={...fridaLogFoods()[0]}
    if(kind==='duplicate')bad[79]={...bad[0]}
    if(kind==='source')bad[79].source={citation:'FoodID=999999;',verification:'Synthetic'}
    if(kind==='too-many')bad.push({...bad[0]})
    const r=await mounted(t,{load:async()=>++calls===1?bad:actual});await r.old()
    enter(r.host,manual[0],'Bevar');enter(r.host,'field-Mængde','73,25');const before=draft(r.host),foods=r.c.snapshot().foods
    click(r.host,'enable-extended-frida-log');await flush()
    assert.equal(r.c.snapshot().extendedFridaLog.status,'error');assert.deepEqual(r.c.snapshot().foods,foods);assert.deepEqual(draft(r.host),before)
    r.cleanup.updateWeight({weightInput:'75'});await flush();assert.equal(calls,1)
    click(r.host,'enable-extended-frida-log');await flush()
    assert.equal(r.c.snapshot().extendedFridaLog.status,'enabled');assert.equal(calls,2)
    assert.deepEqual(draft(r.host),before);assert.equal(r.saves.length+r.writes.length,0)
  })
}

for(const revoked of ['hidden','inert','readOnly','future-precommit','midnight','owner','dispose','same-host']) {
  test('new80 precommit completion and retained capability refuse '+revoked,async t=>{
    const gate=deferred(),owner={},other={};let target={owner,athleteId,date,state:'ready'}
    const dayTargets={owner,athleteId,date,snapshot:()=>target}
    const r=await mounted(t,{load:()=>gate.promise,contracts:{dayTargets}});await r.old()
    const stale=key(r.host,'enable-extended-frida-log'), amount=key(r.host,'field-Mængde'),count=r.c.snapshot().foods.length
    click(r.host,'enable-extended-frida-log')
    if(revoked==='hidden')r.host.hidden=true
    if(revoked==='inert')r.host.inert=true
    if(revoked==='readOnly')r.host.readOnly=true
    if(revoked==='midnight')r.setDay('2026-11-06')
    if(revoked==='owner')target={...target,owner:other}
    if(revoked==='dispose')r.cleanup()
    if(revoked==='future-precommit'){
      const frame=r.doc.createElement('div'),select=r.doc.createElement('select');select.setAttribute('aria-label','Vælg plandato')
      r.doc.body.append(frame);frame.append(r.host,select);select.value='2026-11-06'
    }
    if(revoked==='same-host'){
      const newer=createNutritionController({enabled:true,athlete:{id:'new-owner'},date,foods:prefix,currentDay:()=>date,contracts:{load:async()=>[],save:async()=>true}})
      const cleanup=mountNutrition(r.host,newer,{clock:()=>new Date(date+'T12:00:00Z')});t.after(cleanup);await flush()
    }
    gate.resolve(await extendedFridaLogFoods());await flush()
    assert.equal(r.c.snapshot().foods.length,count);assert.notEqual(r.c.snapshot().extendedFridaLog.status,'enabled')
    stale.dispatch('click');amount.value='999';amount.dispatch('input',{target:amount});await flush()
    assert.equal(r.saves.length+r.writes.length,0)
  })
}

test('write version boundary rejects settled write during pending import, retry requires new intent',async t=>{
  const loading=deferred(),saving=deferred();let calls=0
  const r=await mounted(t,{load:()=>++calls===1?loading.promise:extendedFridaLogFoods(),save:()=>saving.promise});await r.old()
  click(r.host,'enable-extended-frida-log');form(r.host).dispatch('submit');assert.equal(r.c.snapshot().pending,true)
  assert.equal(await r.c.enableExtendedFridaFoods(()=>true),false)
  saving.resolve(true);await flush();loading.resolve(await extendedFridaLogFoods());await flush()
  assert.equal(r.c.snapshot().extendedFridaLog.status,'error');assert.equal(r.c.snapshot().foods.length,prefix.length+40)
  click(r.host,'enable-extended-frida-log');await flush();assert.equal(r.c.snapshot().extendedFridaLog.status,'enabled')
  assert.equal(r.saves.length,1)
})

test('extended opt-in refuses notloaded, pending and disabled controls before loading; no partial catalogue',async t=>{
  const r=await mounted(t);await r.old()
  const count=r.c.snapshot().foods.length
  r.host.disabled=true;click(r.host,'enable-extended-frida-log');await flush();assert.equal(r.imports(),0)
  r.host.disabled=false
  const loading=r.c.load()
  assert.equal(await r.c.enableExtendedFridaFoods(()=>true),false)
  await loading
  const write=r.c.log({meal:'Synthetic boundary',kcal:10,protein:0,carb:1,fat:0},'bounded-intent')
  assert.equal(await r.c.enableExtendedFridaFoods(()=>true),false)
  await write
  assert.equal(r.imports(),0);assert.equal(r.c.snapshot().foods.length,count)
})

test('normal StrictMode future preview rejects retained new80 food controls before commit and preserves draft on return',async t=>{
  const r=await route(t),{host}=r
  await act(async()=>{click(host,'enable-frida-log');await wait(host,'enable-frida-log');click(host,'enable-extended-frida-log');await wait(host,'enable-extended-frida-log')})
  enter(host,'food-choice',String(prefix.length+40),'change');enter(host,'field-Mængde','57,75');enter(host,manual[0],'Bevar fremtid')
  const before=draft(host),select=host.querySelectorAll('select').find(n=>n.getAttribute('aria-label')==='Vælg plandato')
  const oldForm=form(host),oldAmount=key(host,'field-Mængde')
  const event=(n,type)=>host.dispatch(type,{type,target:n,button:0,bubbles:true,stopPropagation(){}})
  await act(async()=>{
    select.value='2026-11-06';event(select,'change')
    oldAmount.value='999';oldAmount.dispatch('input',{target:oldAmount});oldForm.dispatch('submit');await flush()
  })
  assert.equal(r.f.rows.length+r.f.writes.length,0)
  await act(async()=>{select.value=date;event(select,'change');await flush()})
  r.props.weightInput='73';await r.show()
  assert.deepEqual(draft(host),before)
  assert.equal(r.f.rows.length+r.f.writes.length+r.f.plan.writes().length,0)
})

for(const replacement of ['OFF','owner','date','client','unmount']) {
  test('normal StrictMode new80 source and retained form cannot cross '+replacement,async t=>{
    const r=await route(t),{host}=r
    await act(async()=>{click(host,'enable-frida-log');await wait(host,'enable-frida-log');click(host,'enable-extended-frida-log');await wait(host,'enable-extended-frida-log')})
    enter(host,'food-choice',String(prefix.length+40),'change');enter(host,'field-Mængde','83,5')
    const oldForm=form(host),oldAmount=key(host,'field-Mængde')
    if(replacement==='OFF')r.props.enabled=false
    if(replacement==='owner')r.props.athlete={id:'other'}
    if(replacement==='date')r.props.date='2026-11-06'
    if(replacement==='client')r.props.client=fixture().client
    if(replacement==='unmount')await act(async()=>r.root.render(null));else await r.show()
    oldAmount.value='999';oldAmount.dispatch('input',{target:oldAmount});oldForm.dispatch('submit');await flush()
    assert.equal(r.f.rows.length+r.f.writes.length+r.f.plan.writes().length,0)
    if(key(host,'food-choice'))assert.equal(key(host,'food-choice').querySelectorAll('option').length,prefix.length)
  })
}

test('actual factories preserve raw/cooked IDs, known zero; unknown/nonfinite macro never logs',async()=>{
  const {ADDITIONAL_FRIDA_FOODS}=await import('../kostplan/foedevarer/frida55Extended.mjs')
  const added=await extendedFridaLogFoods()
  for(const [i,food]of added.entries()){
    const raw=ADDITIONAL_FRIDA_FOODS[i]
    assert.equal(food.id,raw.id);assert.equal(food.name,raw.name);assert.equal(food.preparation,raw.preparation)
    for(const [flat,nutrient]of Object.entries({kcal100:'energyKcal',protein100:'proteinG',carb100:'carbohydrateG',fat100:'fatG'}))assert.equal(food[flat],raw.nutrientsPer100g[nutrient])
    assert.equal(FRIDA_FOODS.some(old=>old.id===raw.id),false)
  }
  const zero=added.find(f=>f.fat100===0||f.protein100===0||f.carb100===0);assert.ok(zero);assert.ok(foodPortion(zero,'50,5'))
  assert.equal(foodPortion({...zero,protein100:null},'50,5'),null)
  assert.equal(foodPortion({...zero,protein100:Infinity},'50,5'),null)
  assert.throws(()=>createFood({...ADDITIONAL_FRIDA_FOODS[0],nutrientsPer100g:{...ADDITIONAL_FRIDA_FOODS[0].nutrientsPer100g,energyKcal:Infinity}}))
  const raw=added.find(f=>/rå/i.test(f.name)),cooked=added.find(f=>/kogt|stegt|bagt/i.test(f.name));assert.ok(raw&&cooked);assert.notEqual(raw.id,cooked.id)
})
