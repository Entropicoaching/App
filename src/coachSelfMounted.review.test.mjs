import test from 'node:test'
import assert from 'node:assert/strict'
import {act} from 'react'
import {load,fixture,session,week,dual} from './coachSelfMountedFixture.mjs'
import {setup} from './coachSelfMountedHarness.mjs'
import {requestCoachSelfTraining,createCoachSelfContext,isCoachSelfTraining} from './coachSelfTraining.mjs'
// Separate synthetic control scenarios in a separate Node process. Same-engine Codex;
// this is not a claim of an independent reviewer or fresh native agent context.
const {App,dispose}=await load();test.after(dispose)
const tick=()=>new Promise(r=>setImmediate(r))
const choose=(f,name)=>[...f.host.querySelectorAll('button'),...f.host.querySelectorAll('div')].find(n=>n.textContent===name)
const writes=()=>fixture.calls.filter(c=>c.table==='exercise_logs'&&c.op==='insert')
test('control: recover separate synthetic profile from actual preview then one form write',async t=>{
 const f=await setup(t,App);const row={id:'control-r2-self',coach_id:session.user.id,user_id:'control-r2-separate',name:'Control Round Two'};fixture.rows=[row]
 // Re-enter the real Dashboard so its real reader receives this independent dataset.
 await act(async()=>{fixture.auth('SIGNED_OUT',null);await tick()});await f.settle()
 await act(async()=>{fixture.auth('SIGNED_IN',session);await tick()});await f.settle()
 await f.click(f.button('Se som atlet'));await f.click(choose(f,row.name));assert.match(f.host.textContent,/Forh\u00e5ndsvisning/)
 await f.click(f.button('V\u00e6lg min egen tr\u00e6ning'));await f.click(choose(f,row.name));assert.equal(fixture.captured.HomeSession.coachOwnTraining,true)
 await f.click(f.button('Start dagens pas')||f.button('Start n\u00e6ste pas'))
 await act(async()=>{f.host.querySelector('dialog').querySelector('form').dispatch('submit');await tick()});await f.settle()
 assert.equal(writes().length,1);assert.equal(writes()[0].body.athlete_id,row.id)
})
test('control: wrong owner and forged capability never produce self authority',async t=>{
 const f=await setup(t,App)
 assert.equal(requestCoachSelfTraining({session,athlete:{...dual,coach_id:'control-r2-other'},explicit:true}),null)
 const ctx=createCoachSelfContext(session.user.id,'coach','control-r2-unverified');t.after(()=>ctx.dispose())
 const request=requestCoachSelfTraining({session,athlete:dual,explicit:true});assert.ok(request);assert.equal(ctx.open(request,session),null)
 for(const forged of [true,{},Object.freeze({ownerId:session.user.id,athleteId:dual.id})])assert.equal(isCoachSelfTraining(forged,{session,role:'coach',athlete:dual,coachAthleteId:dual.id}),false)
 assert.equal(writes().length,0)
})
test('control: changed current relation blocks apparent remembered self and permits repair',async t=>{
 const f=await setup(t,App,{legacy:dual.id});fixture.athleteRead=async()=>({data:{...dual,coach_id:'control-r2-reassigned'},error:null})
 await f.click(f.button('Min tr\u00e6ning'));assert.equal(fixture.captured.HomeSession.coachOwnTraining,false);assert.equal(fixture.captured.HomeSession.onLogSet,undefined)
 fixture.athleteRead=null;await f.click(f.button('V\u00e6lg min egen tr\u00e6ning'));await f.click(choose(f,dual.name));assert.equal(fixture.captured.HomeSession.coachOwnTraining,true)
 const old=fixture.captured.HomeSession.onLogSet;await f.click(f.button('Til coachportalen'))
 assert.equal(await old(week.sessions[0].exercises[0],1,1,3,null,{weight:'61'}),false);assert.equal(writes().length,0)
})
