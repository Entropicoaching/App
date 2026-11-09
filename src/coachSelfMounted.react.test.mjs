import test from 'node:test'
import assert from 'node:assert/strict'
import {act} from 'react'
import {setup as mountedSetup} from './coachSelfMountedHarness.mjs'
import {load,fixture,session,dual,foreign,week} from './coachSelfMountedFixture.mjs'
const {App,dispose}=await load()
test.after(dispose)
const tick=()=>new Promise(r=>setImmediate(r))
const setup=(t,options)=>mountedSetup(t,App,options)
async function own(f){if(f.button('Menu'))await f.click(f.button('Menu'));await f.click(f.button('Min træning'));if(f.choose())await f.click(f.choose())}
async function log(f){assert.equal(fixture.captured.HomeSession.coachOwnTraining,true,'Actual lazy consumer recognizes session-bound WeakMap entry');const before=fixture.calls.filter(c=>c.table==='exercise_logs'&&c.op==='insert').length;await f.click(f.button('Start dagens pas')||f.button('Start næste pas'));await f.settle();assert.ok(f.host.querySelector('dialog'),'Actual session dialog');await act(async()=>{f.host.querySelector('dialog').querySelector('form').dispatch('submit');await tick()});await f.settle();assert.equal(fixture.calls.filter(c=>c.table==='exercise_logs'&&c.op==='insert').length,before+1);assert.equal(fixture.calls.filter(c=>c.table==='exercise_logs'&&c.op==='insert').at(-1).body.athlete_id,dual.id)}
test('mounted fresh chooser reaches real session writer',async t=>{const f=await setup(t);await own(f);await log(f)})
test('mounted preview has an explicit own-training recovery route',async t=>{const f=await setup(t);await f.click(f.button('Se som atlet'));await f.click(f.choose());assert.match(f.host.textContent,/Forhåndsvisning/);await f.click(f.button('Vælg min egen træning'));await f.click(f.choose());await log(f)})

test('cached coach pending verification cannot strand Min træning in preview',async t=>{
 let release;const pauseRole=new Promise(r=>release=r);const f=await setup(t,{cached:true,legacy:dual.id,pauseRole})
 await f.click(f.button('Min træning'))
 assert.doesNotMatch(f.host.textContent,/Forhåndsvisning/)
 assert.match(f.host.textContent,/bekræft|Bekræft/)
 await act(async()=>{release();await tick()});await f.settle()
 await f.click(f.button('Min træning'));await log(f)
})

for(const mobile of [false,true]) test(`actual established choice writes on mobile=${mobile}`,async t=>{
 const f=await setup(t,{mobile,legacy:dual.id});await own(f);await log(f)
 assert.ok(fixture.calls.some(c=>c.table==='athletes'&&c.filters.some(([k,v])=>k==='id'&&v===dual.id)),'Actual loaded athlete read')
})
for(const saved of ['broken',JSON.stringify({ownerId:'other-owner',athleteId:dual.id}),JSON.stringify({ownerId:session.user.id,athleteId:'deleted'})])
test('actual chooser repairs corrupt/stale owner binding '+saved,async t=>{const f=await setup(t,{legacy:dual.id,values:[['entropi_coach_self_training_v1',saved]]});await own(f);await log(f);assert.equal(JSON.parse(f.values.get('entropi_coach_self_training_v1')).ownerId,session.user.id)})
test('actual unavailable binding storage gives retry and never grants self',async t=>{const f=await setup(t,{storageUnavailable:true});await own(f);assert.match(f.host.textContent,/kunne ikke/);assert.ok(f.button('Prøv egen træning igen'));assert.equal(fixture.calls.filter(c=>c.op==='insert').length,0)})
test('actual cancelled chooser never creates binding or view',async t=>{const f=await setup(t);await f.click(f.button('Min træning'));await f.click(f.button('Annuller'));assert.equal(f.values.has('entropi_coach_self_training_v1'),false);assert.equal(fixture.captured.HomeSession,undefined)})
test('actual failed verification has usable retry then deliberate selection',async t=>{const f=await setup(t,{cached:true,roleError:{message:'synthetic offline'}});await f.click(f.button('Min træning'));assert.match(f.host.textContent,/bekræftet/);fixture.roleError=null;await f.click(f.button('Prøv egen træning igen'));await own(f);await log(f)})
test('actual same-owner token refresh and navigation re-entry preserve recognized capability',async t=>{const f=await setup(t);await own(f);await act(async()=>{fixture.auth('TOKEN_REFRESHED',{user:{...session.user},access_token:'synthetic-only'});await tick()});await f.settle();await log(f);await f.click(f.button('Til coachportalen'));await own(f);await log(f)})
for(const event of ['SIGNED_OUT','account switch']) test('actual retained session form denies after '+event,async t=>{
 const f=await setup(t);await own(f);await f.click(f.button('Start dagens pas')||f.button('Start næste pas'));const form=f.host.querySelector('dialog').querySelector('form');const handler=fixture.captured.HomeSession.onLogSet
 await act(async()=>{fixture.auth(event,event==='SIGNED_OUT'?null:{user:{id:'another-coach'}});assert.equal(await handler(week.sessions[0].exercises[0],1,1,3,null,{weight:'60'}),false);await tick()});await f.settle()
 await act(async()=>{form.dispatch('submit');await tick()});await f.settle();assert.equal(fixture.calls.filter(c=>c.table==='exercise_logs'&&c.op==='insert').length,0)
})
test('actual queued session write denies after navigation exit',async t=>{
 const f=await setup(t);await own(f);let queued;fixture.queue=fn=>{queued=fn;return Promise.resolve(false)}
 await f.click(f.button('Start dagens pas')||f.button('Start næste pas'));await act(async()=>{f.host.querySelector('dialog').querySelector('form').dispatch('submit');await tick()});await f.settle();assert.equal(typeof queued,'function')
 await f.click(f.button('Til coachportalen'));await assert.rejects(queued(),/Træningskonteksten/);assert.equal(fixture.calls.filter(c=>c.table==='exercise_logs'&&c.op==='insert').length,0)
})
test('actual loaded foreign relation denies a choice made from a stale coach list',async t=>{
 const f=await setup(t);fixture.athleteRead=async()=>({data:{...dual,coach_id:'different-owner'},error:null});await own(f);assert.match(f.host.textContent,/Forhåndsvisning/);assert.equal(f.button('Start dagens pas')||f.button('Start næste pas'),undefined)
})
for(const initialFirst of [true,false])test('actual getSession and INITIAL_SESSION ordering '+initialFirst,async t=>{
 let release;const pendingSession=new Promise(r=>release=r);const f=await setup(t,{pendingSession})
 if(initialFirst){await act(async()=>{fixture.auth('INITIAL_SESSION',{user:{...session.user}});await tick()});await f.settle()}
 await act(async()=>{release({data:{session}});await tick()});await f.settle()
 if(!initialFirst){await act(async()=>{fixture.auth('INITIAL_SESSION',{user:{...session.user}});await tick()});await f.settle()}
 await own(f);await log(f)
})

test('delayed verified role on fresh device enables deliberate chooser and actual write',async t=>{
 let release;const pauseRole=new Promise(r=>release=r);const f=await setup(t,{cached:true,pauseRole});await f.click(f.button('Min træning'));assert.match(f.host.textContent,/bekræftet/)
 await act(async()=>{release();await tick()});await f.settle();await own(f);await log(f)
})
test('ordinary same-coach preview remains read-only until explicit own selection',async t=>{
 const f=await setup(t);await f.click(f.button('Se som atlet'));await f.click([...f.host.querySelectorAll('button'),...f.host.querySelectorAll('div')].find(n=>n.textContent===foreign.name));assert.match(f.host.textContent,/Forhåndsvisning/);assert.equal(f.button('Start dagens pas')||f.button('Start næste pas'),undefined);assert.equal(f.values.has('entropi_coach_self_training_v1'),false)
})
// Marc 9. nov.: coachen åbner sin egen profil via "Se som atlet" og skal kunne logge derfra.
test('own profile opened as preview offers a direct claim and actual write',async t=>{
 const f=await setup(t);await f.click(f.button('Se som atlet'));await f.click(f.choose());assert.match(f.host.textContent,/Forhåndsvisning/)
 assert.equal(f.values.has('entropi_coach_self_training_v1'),false,'No binding before the explicit claim')
 await f.click(f.button('Det er min egen profil · log min træning'))
 assert.equal(JSON.parse(f.values.get('entropi_coach_self_training_v1')).athleteId,dual.id)
 assert.doesNotMatch(f.host.textContent,/Forhåndsvisning · du kan ikke gemme/);await log(f)
})
test('claim is refused without verified coach role and stays read-only',async t=>{
 let release;const pauseRole=new Promise(r=>release=r);const f=await setup(t,{cached:true,pauseRole});await f.click(f.button('Se som atlet'));await f.click(f.choose())
 await f.click(f.button('Det er min egen profil · log min træning'));assert.match(f.host.textContent,/kunne ikke bekræftes/);assert.equal(f.button('Start dagens pas')||f.button('Start næste pas'),undefined)
 assert.equal(fixture.calls.filter(c=>c.table==='exercise_logs'&&c.op==='insert').length,0);await act(async()=>{release();await tick()})
})
