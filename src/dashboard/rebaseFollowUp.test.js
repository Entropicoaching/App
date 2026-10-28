import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './rebaseFollowUpLoader.mjs'
import { mount, nodes, text } from './followUpDom.mjs'
install()
const { default: Home } = await import('./ForsideView.jsx')
const { default: Base } = await import('./followUpBaseline.jsx')
const { saveFollowUp, followUpKey } = await import('./coachFollowUp.mjs')
const athletes = [{id:'a',name:'Anna'},{id:'b',name:'Bo'}]
const snapshot = tree => JSON.stringify(tree,(k,v)=>typeof v === 'function'?'handler':v)
const baseProps = {athletes, hiddenAthleteIds:new Set(), athleteCurrentWeek:{},calendarWeeks:{},coachPriorityItems:[],
 unreadCounts:{},videoMeasurementByAthlete:{},coachPriorityCount:0,coachBriefingSeen:{},athleteWeekSummary:{},athleteLastLogs:{},athleteWeekCompletion:{},
 coachId:'synthetic',sendTemplateMessage:()=>assert.fail('No automatic send'),
 latestByTrack:{a:{besked:{sender_role:'athlete',created_at:'2026-10-27T10:00:00Z',content:'synthetic'}}},
 coachActionsStatus:{calendar:'ready',progress:'ready'}}
const store = () => { const values=new Map(),calls=[];return {values,calls,getItem:k=>{calls.push(['get',k]);return values.get(k)??null},setItem:(k,v)=>{calls.push(['set',k]);values.set(k,v)}} }

test('rebase matrix: real home, morning, folds and template modules with flags alone and together',()=>{
 for(const isMobile of [false,true]) for(const coachMorning of [false,true]) for(const coachRyd of [false,true])
 for(const coachTemplateMessages of [false,true]) for(const coachActions of [false,true]) {
  const storage=store();globalThis.localStorage=storage
  saveFollowUp({storage,coachId:'synthetic',athletes,athleteId:'b',note:'Synthetic marker'})
  const props={...baseProps,isMobile,coachMorning,coachRyd,coachTemplateMessages,coachActions}
  const off=mount(Home,props).render(), baseline=mount(Base,props).render()
  assert.equal(snapshot(off),snapshot(baseline),'OFF baseline with all surrounding flag combinations')
  const on=mount(Home,{...props,coachFollowUp:true}).render()
  assert.deepEqual(nodes(on,n=>n.props['data-follow-up-athlete']).map(n=>n.props['data-follow-up-athlete']),['b','a'])
  assert.equal(nodes(on,n=>n.type==='summary'&&/Opgaver/.test(text(n))).length,nodes(baseline,n=>n.type==='summary'&&/Opgaver/.test(text(n))).length,'task folds retain pinned conditions')
  assert.equal(nodes(on,n=>n.props['data-coach-actions']).length,Number(coachActions || coachTemplateMessages))
  assert.equal(nodes(on,n=>n.props['aria-label']==='Coachens morgenoverblik').length,Number(coachMorning))
  assert.equal(nodes(on,n=>n.type==='button'&&text(n)==='Skabelonbesked til Anna').length,Number(coachTemplateMessages))
  assert.equal(storage.calls.filter(c=>c[0]==='set').length,1,'render never writes')
 }
})

test('rebase OFF and missing coach do not even request localStorage',()=>{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){assert.fail('OFF touched storage')}})
 for(const coachFollowUp of [undefined,false,0,1,'1']) for(const coachId of ['synthetic',undefined,'']) {
  const props={...baseProps,coachFollowUp,coachId}
  assert.equal(snapshot(mount(Home,props).render()),snapshot(mount(Base,props).render()))
 }
 assert.equal(snapshot(mount(Home,{...baseProps,coachFollowUp:true,coachId:''}).render()),snapshot(mount(Base,{...baseProps,coachId:''}).render()))
 Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:store()})
})

test('rebase exact loader remains restrictive on an unapproved dependency',async()=>{
 await assert.rejects(import('./unapproved-rebase-dependency.mjs'),{code:'ERR_MODULE_NOT_FOUND'})
 const storage=store();globalThis.localStorage=storage
 const tree=mount(Home,{...baseProps,coachFollowUp:true,hiddenAthleteIds:new Set(['b'])}).render()
 assert.deepEqual(nodes(tree,n=>n.props['data-follow-up-controls']).map(n=>n.props['data-follow-up-controls']),['a'])
 assert.equal(storage.values.has(followUpKey('synthetic')),false)
})

