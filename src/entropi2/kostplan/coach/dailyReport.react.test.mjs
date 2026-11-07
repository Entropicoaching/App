// Required actual ReactDOM effects and existing mounted PortalPlan consumer.
// Existing in-memory DOM only; no replacement React, browser/server or live UI.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import PortalPlan from './PortalPlan.mjs'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import { readCoachNutrition } from '../../coachNutritionRead.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import { historyFixture, athleteId, coachId, uuid } from '../dailyReference.fixture.mjs'
import { flush, tableNames } from './activation.fixture.mjs'
const date='2026-11-05'
const log={id:'synthetic-Nov1',athlete_id:athleteId,date:'2026-11-01',meal:'Synthetic actual meal',kcal:500,protein:40,carb:50,fat:15}
const receipt=()=>({coachId,athleteId,date,state:'ready',complete:true,planHistory:'unavailable',mealLogs:[{...log}]})
const props=f=>({enabled:true,coachId,athlete:{id:athleteId},date,today:date,session:{user:{id:coachId}},client:f.client,nutritionRead:receipt()})
async function withRoot(run) {
  const doc=sessionReactDocument(),host=doc.createElement('div');doc.body.append(host)
  const globals={window:doc.defaultView,IS_REACT_ACT_ENVIRONMENT:true}
  const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
  for(const [k,v] of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,value:v})
  const root=createRoot(host)
  const show=p=>act(async()=>{root.render(h(PortalPlan,p));await flush();await flush()})
  try{await run({host,show,root})}
  finally{try{await act(async()=>root.unmount())}finally{for(const[k,d]of prior){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}}
}

test('R4 Nov1/Nov5: actual coach read -> host receipt -> mounted PortalPlan keeps consumption and shows unknown reference', async()=>{
  const f=historyFixture();f.plan(1,date);f.version(10,uuid(1),date,1,500);f.approve(10,uuid(1),date+'T12:00:00.000001Z')
  const calls=[]
  const client={from(table){calls.push(table);let columns;const q={select(s){columns=s;return q},in(){return q},gte(){return q},lte(){return q},order(){return q},limit(){return q},then(resolve){return Promise.resolve({data:table==='meal_logs'?[Object.fromEntries(columns.split(',').map(s=>s.trim()).map(k=>[k,log[k]]))]:[],error:null}).then(resolve)}};return q}}
  const context={coachId,day:date,athleteIds:[athleteId]}
  const batch=await readCoachNutrition(client,context)
  const hostElement=CoachKostMaal({...props(f),nutritionRead:undefined,coachNutrition:batch,readContext:context,
    weightStatus:{athleteId,state:'ready',rows:[]}})
  const portal=hostElement.props.children.find(child=>child.type===PortalPlan)
  assert.equal(portal.props.nutritionRead.mealLogs[0].carb,50)
  await withRoot(async({host,show})=>{
    await show({...portal.props,client:f.client})
    assert.match(host.textContent,/500 kcal registreret/)
    assert.match(host.textContent,/50 g registreret/);assert.match(host.textContent,/15 g registreret/)
    assert.match(host.textContent,/Historisk planreference ukendt/)
    assert.match(host.textContent,/1 af 7 dage med bekræftet planreference/)
    assert.match(host.textContent,/Planindhold er ikke et fysiologisk mål eller behov/)
    assert.doesNotMatch(host.textContent,/100 %|Den aktive plans dagsmål|Vælg måltider|Vægttrend|Profilens mål/)
    assert.equal(host.querySelectorAll('time').length,7)
    assert.ok(host.querySelectorAll('details').every(n=>!n.open))
  })
  assert.deepEqual(calls,['meal_logs','athletes']);assert.equal(f.writes().length,0)
})

test('real mounted report retries partial history while preserving actuals; error cannot become empty history', async()=>{
  let broken=true
  const f=historyFixture({response(call,rows){return {data:rows,error:null,...(broken&&call.table===tableNames[1]?{}:{count:rows.length})}}})
  f.plan();f.version();f.approve()
  await withRoot(async({host,show})=>{
    await show(props(f))
    assert.match(host.textContent,/Historisk planreference kunne ikke bekræftes/)
    assert.match(host.textContent,/500 kcal registreret/);assert.doesNotMatch(host.textContent,/500 %/)
    const retry=host.querySelectorAll('button').find(n=>n.textContent==='Hent planhistorik igen')
    assert.ok(retry)
    broken=false
    await act(async()=>{host.dispatch('click',{type:'click',target:retry,button:0,bubbles:true,stopPropagation(){}});await flush();await flush()})
    assert.doesNotMatch(host.textContent,/Historisk planreference kunne ikke bekræftes/)
    assert.match(host.textContent,/500 % af planindhold/)
  })
  assert.equal(f.writes().length,0)
})

test('real mounted report clears stale receipt/owner/client evidence and ignores delayed reads after switch or OFF', async()=>{
  const f=historyFixture();f.plan();f.version();f.approve()
  let release;const held=new Promise(resolve=>{release=resolve})
  const delayed=historyFixture({before:()=>held})
  await withRoot(async({host,show})=>{
    try{
      await show(props(f));assert.match(host.textContent,/500 kcal registreret/)
      await show({...props(f),client:delayed.client});assert.doesNotMatch(host.textContent,/500 kcal registreret/)
      await show({...props(f),coachId:'another-coach',session:{user:{id:'another-coach'}}})
      assert.doesNotMatch(host.textContent,/500 kcal registreret/)
      await act(async()=>{release();await flush();await flush()})
      assert.doesNotMatch(host.textContent,/500 kcal registreret/)
      for(const enabled of [undefined,false,1,'true']){
        assert.equal(PortalPlan({enabled,get nutritionRead(){assert.fail('OFF read')},get athlete(){assert.fail('OFF athlete')}}),null)
        await show({enabled})
        assert.equal(host.textContent,'')
      }
    }finally{release()}
  })
  assert.equal(f.writes().length+delayed.writes().length,0)
})


test('real mounted report preserves read meals when the existing client cannot be loaded', async()=>{
  await withRoot(async({host,show})=>{
    const f=historyFixture()
    await show({...props(f),client:undefined,loadClient:async()=>{throw Error('synthetic client unavailable')}})
    assert.match(host.textContent,/500 kcal registreret/)
    assert.match(host.textContent,/Historisk planreference kunne ikke bekræftes/)
    assert.ok(host.querySelectorAll('button').some(n=>n.textContent==='Hent planhistorik igen'))
    assert.equal(f.calls.length,0)
  })
})
