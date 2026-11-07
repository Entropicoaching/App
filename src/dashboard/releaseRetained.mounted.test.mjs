// Actual React 19 / ReactDOM on an inert in-memory host; no browser or network.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createElement as h, act, StrictMode } from 'react'
import { programDocument, elements, dispatch } from './releaseReactHost.mjs'
import { installCoachTabsFixture, baseProps, ready, service } from './coachTabsFixture.mjs'

const globals=Object.fromEntries(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
const document=programDocument()
globalThis.document=document;globalThis.window=document.defaultView;globalThis.IS_REACT_ACT_ENVIRONMENT=true
const { createRoot }=await import('react-dom/client')
const fixture=installCoachTabsFixture({realReact:true})
const realChildren=registerHooks({resolve(name,context,next){
 if(context.parentURL===new URL('./ProgramTab.jsx',import.meta.url).href&&['./CoachPlanCopy.jsx','./ProgramCopyOptions.jsx'].includes(name))return {url:new URL(name,context.parentURL).href,shortCircuit:true}
 return next(name,context)
}})
const {default:ProgramTab}=await import('./ProgramTab.jsx')
test.after(()=>{realChildren.deregister();fixture.deregister();for(const [k,v]of Object.entries(globals)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}})

const owner='release-mounted-owner'
function week(id=owner){return {id:'release-source',athlete_id:id,week_number:6,start_date:'2026-11-02',sessions:[{id:'release-pas',title:'Synthetic training',weekday:1,exercises:[{id:'release-ex',name:'Press',sets:2,reps:'5',recommended_weight:40}]}]}}
async function mount(extra={}){
 service.calls.length=0;service.responses.length=0
 const host=document.createElement('div');document.body.append(host)
 const root=createRoot(host),events=[]
 let props=baseProps({selectedAthlete:{id:owner},weeks:ready([week()],owner),openWeekId:'release-source',openSessionId:null,
  coachPlanCopyEnabled:true,programCopyEnabled:false,coachProgramToolsEnabled:false,sessionLogStatus:()=>({color:'#aaa',total:1,logged:0}),
  setOpenWeekId:()=>{},fetchWeeks:id=>events.push(['refresh',id]),showFlash:(...args)=>events.push(['flash',...args]),...extra})
 const render=()=>root.render(h(StrictMode,null,h(ProgramTab,{...props,programShownWeeks:()=>props.weeks})))
 try{await act(async()=>render())}catch(error){await act(async()=>root.unmount());document.body.removeChild(host);throw error}
 return {host,events,update:async change=>act(async()=>{props={...props,...change};render()}),close:async()=>{await act(async()=>root.unmount());document.body.removeChild(host)}}
}
function button(app,label){const node=elements(app.host).find(n=>n.tagName==='BUTTON'&&n.textContent.trim()===label);assert.ok(node,label);return node}
const click=(app,label)=>act(async()=>dispatch(app.host,button(app,label),'click'))
async function input(app,label,value){const group=elements(app.host).find(n=>n.tagName==='LABEL'&&n.childNodes[0]?.textContent===label);assert.ok(group,label);const node=elements(group).find(n=>n.tagName==='INPUT');assert.ok(node);node.value=value;await act(async()=>dispatch(app.host,node,'input'))}
const inserts=()=>service.calls.filter(c=>c.steps.some(([op])=>op==='insert'))
const payload=call=>call.steps.find(([op])=>op==='insert')[1]

test('release mounted: baseline ignores rejected entry flag at every value and keeps explicit legacy copy',async()=>{
 const app=await mount({coachPlanCopyEnabled:undefined})
 try{
  for(const value of [undefined,false,'true',true]){
   await app.update({coachWeekStudioEnabled:value})
   assert.doesNotMatch(app.host.textContent,/Åbn ugestudiet|Gem næste uge i atletens program/)
   assert.equal(service.calls.length,0)
  }
  await app.update({coachPlanCopyEnabled:true})
  assert.ok(button(app,'Kopiér til næste uge'));assert.equal(service.calls.length,0)
 }finally{await app.close()}
})

test('release mounted: exact raw fractional sets disable send; valid comma payload is sent once after explicit action',async()=>{
 const app=await mount()
 try{
  await click(app,'Kopiér til næste uge')
  for(const value of ['1.0000000000000001','0,99999999999999999','2e-1','0']){
   await input(app,'Sæt',value);assert.equal(button(app,'Send til atleten').disabled,true)
   assert.equal(service.calls.length,0)
  }
  await input(app,'Sæt','3,00e0');await input(app,'Vægt','42,5')
  assert.equal(button(app,'Send til atleten').disabled,false);assert.equal(service.calls.length,0)
  service.responses.push({data:{id:'release-created-week'}},{data:{id:'release-created-session'}},{data:null})
  await click(app,'Send til atleten')
  assert.deepEqual(inserts().map(c=>c.table),['weeks','sessions','exercises'])
  assert.equal(payload(inserts()[0]).athlete_id,owner);assert.equal(payload(inserts()[0]).week_number,7)
  assert.equal(payload(inserts()[2]).sets,3);assert.equal(payload(inserts()[2]).recommended_weight,42.5)
  assert.deepEqual(app.events,[['refresh',owner],['flash','Ugen er sendt til atleten','success']])
  await app.update({athleteLogs:ready([],owner)})
  assert.equal(inserts().length,3);assert.equal(service.responses.length,0)
 }finally{await app.close()}
})

test('release mounted: cancel and athlete switch discard local drafts without transport',async()=>{
 const app=await mount()
 try{
  await click(app,'Kopiér til næste uge');await input(app,'Sæt','4,0');await click(app,'Annuller kladde')
  assert.doesNotMatch(app.host.textContent,/Kladde til næste uge/);assert.equal(service.calls.length,0)
  await click(app,'Kopiér til næste uge')
  await app.update({selectedAthlete:{id:'release-next'},weeks:ready([week('release-next')],'release-next')})
  assert.doesNotMatch(app.host.textContent,/Kladde til næste uge/);assert.equal(service.calls.length,0)
  assert.deepEqual(app.events,[])
 }finally{await app.close()}
})

test('release mounted: late explicit send completion cannot notify a different athlete context',async()=>{
 let finish
 const pending=new Promise(resolve=>{finish=resolve}),app=await mount()
 try{
  await click(app,'Kopiér til næste uge')
  service.responses.push(()=>pending,{data:{id:'release-late-session'}},{data:null})
  await click(app,'Send til atleten');assert.equal(inserts().length,1)
  await app.update({selectedAthlete:{id:'release-next'},weeks:ready([week('release-next')],'release-next')})
  await act(async()=>{finish({data:{id:'release-late-week'}});await pending})
  assert.deepEqual(app.events,[]);assert.equal(service.responses.length,0)
  assert.equal(payload(inserts()[0]).athlete_id,owner)
 }finally{finish({data:{id:'release-late-week'}});await app.close()}
})
