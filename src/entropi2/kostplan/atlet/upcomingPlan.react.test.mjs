import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import UpcomingPlan from './UpcomingPlan.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { all, byKey, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'
import { uuid } from '../dailyReference.fixture.mjs'

const seed = f => {
 f.approve()
 for(let i=1;i<=3;i++){
  const version=structuredClone(f.plan.data[tableNames[1]][0])
  version.id=uuid(100+i);version.version_no=i+1;version.effective_from=`2026-11-${5+i<10?'0':''}${5+i}`
  version.portion_guidance=`  Timing ${i}\nVæske <b>tekst</b>\nMineralnotat ${i}  `;version.meals[0].name=`Fremtid ${i}`
  f.plan.data[tableNames[1]].push(version)
  f.plan.data[tableNames[2]].push({...f.plan.data[tableNames[2]][0],version_id:version.id})
 }
 f.plan.data[tableNames[1]][0].portion_guidance='Dagens råd\nEksakt tekst'
}
async function route(t, options={}) {
 t.mock.timers.enable({apis:['Date'],now:new Date(date+'T12:00:00+01:00')})
 const f=fixture(options);seed(f)
 f.rows.push({id:'synthetic-existing-row',athlete_id:athleteId,date,meal:'Syntetisk log',kcal:100,protein:5,carb:8,fat:3})
 const dom=hostFixture(), root=createRoot(dom.host), warnings=[]
 dom.globals({localStorage:f.storage})
 const original=console.error;console.error=(...args)=>{warnings.push(args.map(String).join(' '))}
 const weightCalls=[]
 const props={enabled:true,athlete:{id:athleteId},date,client:f.client,foods:[{id:'synthetic-food-search',name:'Syntetisk fødevare',kcal100:120,protein100:4,carb100:10,fat100:2}],currentDay:()=>date,
  weightLogs:[],weightInput:'',onWeightInput:v=>weightCalls.push(v),logWeight(){},weightStatus:{athleteId,state:'ready'}}
 let alive=true
 const render=async()=>act(async()=>{root.render(h(StrictMode,null,h(Entropi2Kost,props)));await tick()})
 const unmount=async()=>{if(alive){alive=false;await act(async()=>{root.unmount();await tick()})}}
 t.after(async()=>{try{await unmount()}finally{console.error=original;dom.restore()}})
 await render()
 const select=()=>all(dom.host,'select').find(n=>n.getAttribute('aria-label')==='Vælg plandato')
 const choose=async day=>act(async()=>{propsOf(select()).onChange({currentTarget:{value:day}});await tick()})
 return {...dom,f,props,render,root,choose,select,warnings,weightCalls,unmount}
}
const input=(host,key,value)=>{const n=byKey(host,key);assert.ok(n,key);n.value=value;n.dispatch('input',{target:n});return n}
const click=async(host,label)=>{const n=button(host,label);assert.ok(n,label);await act(async()=>{n.click();await tick()})}
const preview=host=>all(host,'section').find(n=>n.getAttribute('aria-label')==='Kommende kostplan')

test('actual StrictMode Kost route: all three future dates, literal advice, readonly actions and today draft/receipt identities survive',async t=>{
 const r=await route(t)
 assert.ok(r.select());assert.equal(all(r.select(),'option').length,4)
 const todayAdvice=all(r.host,'section').find(n=>n.getAttribute('aria-label')==='Planens råd');assert.match(todayAdvice.textContent,/Dagens råd/)
 const eaten=all(r.host,'button').find(n=>n.getAttribute('aria-label')==='Frokost <syntetisk>: Spist som planlagt')
 assert.ok(eaten);await act(async()=>{await propsOf(eaten).onClick();await tick()})
 assert.equal(r.f.rows.length,2)
 await click(r.host,'Gem som skabelon: Syntetisk log')
 await click(r.host,'Tilføj ingrediens')
 input(r.host,'template-ingredients-0-0-name','Ugemt ingrediens')
 byKey(r.host,'log-form').open=true
 input(r.host,'field-Måltid','Manuel kladde');input(r.host,'field-Protein (g)','12,5')
 input(r.host,'food-search','Søgning bevaret')
 input(r.host,'field-Vægt (kg)','81,2')
 const gram=all(r.host,'input').find(n=>n.getAttribute('aria-label')==='Aftensmad: Syntetisk mad 2 (g)')
 await act(async()=>{propsOf(gram).onChange({currentTarget:{value:'245,5'}});await tick()})
 const tracker=all(r.host,'[data-entropi2-kost]')[0], manual=byKey(r.host,'field-Måltid'), ingredient=byKey(r.host,'template-ingredients-0-0-name')
 const bytes=[...r.f.values],writes=r.f.writes.length,logCalls=r.f.calls.length,weightCalls=[...r.weightCalls]
 for(const day of ['2026-11-06','2026-11-07','2026-11-08',date,'2026-11-07',date]){
  await r.choose(day)
  if(day!==date){
   const p=preview(r.host);assert.ok(p);assert.match(p.textContent,/Forhåndsvisning · kun læsning/)
   assert.match(p.textContent,/Fremtid/);assert.match(p.textContent,/Væske <b>tekst<\/b>/)
   assert.equal(all(p,'input').length,0);assert.equal(all(p,'form').length,0);assert.equal(all(p,'button').length,1)
   assert.equal(all(p,'button')[0].textContent,'Hent planen igen');assert.equal(all(p,'b').length,0)
   assert.equal(tracker.parentElement.parentElement.getAttribute('hidden'),'')
  }
  assert.strictEqual(all(r.host,'[data-entropi2-kost]')[0],tracker)
  assert.strictEqual(byKey(r.host,'field-Måltid'),manual);assert.equal(manual.value,'Manuel kladde')
  assert.strictEqual(byKey(r.host,'template-ingredients-0-0-name'),ingredient);assert.equal(ingredient.value,'Ugemt ingrediens')
  assert.equal(byKey(r.host,'food-search').value,'Søgning bevaret');assert.equal(byKey(r.host,'field-Vægt (kg)').value,'81,2')
  assert.equal(propsOf(all(r.host,'input').find(n=>n.getAttribute('aria-label')==='Aftensmad: Syntetisk mad 2 (g)')).value,'245,5')
  assert.deepEqual([...r.f.values],bytes);assert.equal(r.f.writes.length,writes);assert.equal(r.f.calls.length,logCalls)
  assert.deepEqual(r.weightCalls,weightCalls);assert.equal(r.f.rows.length,2);assert.equal(r.f.plan.writes().length,0)
 }
 assert.match(r.host.textContent,/1 af 2 måltider spist/)
 assert.deepEqual(r.warnings,[])
})

for (const changed of ['date', 'client', 'athlete']) test('actual StrictMode preview: late response after ' + changed + ' swap and retained retry after dispose', async t => {
 const dom = hostFixture(), root = createRoot(dom.host), f = fixture(); seed(f)
 let release, held = false
 const gate = new Promise(resolve => { release = resolve })
 f.plan.options.before = async call => {
  if (call.table === tableNames[1] && call.limit !== 0) { held = true; await gate }
 }
 const other = fixture(); seed(other)
 const props = { athleteId, today: date, date: '2026-11-06', client: f.client }
 const render = async () => act(async () => { root.render(h(StrictMode, null, h(UpcomingPlan, props))); await tick() })
 t.after(async () => { try { release(); await act(async () => root.unmount()) } finally { dom.restore() } })
 await render(); assert.ok(held)
 if (changed === 'date') props.date = '2026-11-07'
 if (changed === 'athlete') props.athleteId = 'synthetic-other'
 if (changed === 'client') props.client = other.client
 f.plan.options.before = undefined
 await render()
 if (changed === 'athlete') assert.match(dom.host.textContent, /ingen godkendt/)
 else assert.match(dom.host.textContent, changed === 'date' ? /Timing 2/ : /Timing 1/)
 const confirmed = dom.host.textContent
 await act(async () => { release(); await tick() }); assert.equal(dom.host.textContent, confirmed)
 const retry = propsOf(button(dom.host, 'Hent planen igen')).onClick
 const transport = changed === 'client' ? other : f, count = transport.plan.calls.length
 await act(async () => { await retry(); await tick() }); assert.ok(transport.plan.calls.length > count)
 await act(async () => { root.render(null); await tick() }); const disposed = transport.plan.calls.length
 assert.equal(await retry(), false); assert.equal(transport.plan.calls.length, disposed)
 assert.equal(f.plan.writes().length + other.plan.writes().length, 0)
})

test('actual preview states are honest and visible retry recovers after missing schema or read error', async t => {
 const dom = hostFixture(), root = createRoot(dom.host)
 t.after(async () => { try { await act(async () => root.unmount()) } finally { dom.restore() } })
 for (const kind of ['empty', 'unavailable', 'read-error']) {
  const f = fixture(); if (kind !== 'empty') seed(f)
  if (kind === 'unavailable') f.plan.options.missing = tableNames[1]
  if (kind === 'read-error') f.plan.options.error = '42501'
  const props = { athleteId, today: date, date: '2026-11-06', client: f.client }
  await act(async () => { root.render(h(StrictMode, null, h(UpcomingPlan, props))); await tick() })
  assert.match(dom.host.textContent, kind === 'empty' ? /ingen godkendt/ : kind === 'unavailable' ? /ikke tilgængelige endnu/ : /kunne ikke hentes/)
  assert.doesNotMatch(dom.host.textContent, /Timing|Fremtid|100%/)
  if (kind === 'empty') seed(f)
  f.plan.options.missing = false; f.plan.options.error = null
  const count = f.plan.calls.length
  await act(async () => { await propsOf(button(dom.host, 'Hent planen igen')).onClick(); await tick() })
  assert.match(dom.host.textContent, /Timing 1/); assert.ok(f.plan.calls.length > count)
  assert.equal(f.plan.writes().length, 0); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0)
 }
})

test('actual route keeps open Ugeplan mounted during browsing; outer cleanup gate',async t=>{
 const r=await route(t)
 await click(r.host,'Gem som skabelon: Syntetisk log')
 const fold=byKey(r.host,'week-plan');assert.ok(fold)
 await act(async()=>{fold.open=true;fold.dispatch('toggle');await tick()})
 for(let i=0;i<100&&!byKey(r.host,'week-plan-add-0');i++) await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5))})
 assert.ok(byKey(r.host,'week-plan-add-0'),'Actual lazy React Ugeplan mounted')
 const nested=byKey(r.host,'week-plan-add-0')
 await r.choose('2026-11-06');await r.choose(date)
 assert.strictEqual(byKey(r.host,'week-plan-add-0'),nested);assert.equal(fold.open,true);assert.deepEqual(r.warnings,[])
 await r.unmount()
 assert.deepEqual(r.warnings,[],'Outer cleanup must not synchronously unmount a nested React root')
})
