import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { install } from './analyseConclusionLoader.mjs'
import { mount, nodes, text, one } from './analyseTestDom.mjs'
install()
const { analyseConclusion, default: Conclusion } = await import('./analyseConclusion.mjs')
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const baselinePin = 'b08de1810032a1c3e87bdcbd8e8af4248623163762ed946684bdcbf0ddd22d18'
const props = {a:{id:'demo',name:'Demo'},selectedAthlete:{id:'demo',name:'Demo'},athleteLogs:[],athletePRHistory:[],athleteReadiness:[],athleteWeightLogs:[],exerciseLibrary:[],videoAnalyses:[],videoBaselines:[],weeks:[],videoLiftFilter:'all'}
const logs=()=>['2026-10-01','2026-10-08','2026-10-15','2026-10-22'].map((date,i)=>({id:String(i),weight:100,reps_completed:3,logged_at:date,exercises:{name:'Squat',sessions:{deload:false}}}))
const row=extra=>({id:'v',athlete_id:'demo',lift:'squat',analyzed_at:'2026-10-20',status:'coach_approved',athlete_feedback:{focus:[{text:'Hold pausen.'}]},...extra})

test('counterexample: baseline is byte-exact and the former tab body is intact',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('./analyseConclusionBaseline.jsx',import.meta.url),'utf8').replace(/\r\n/g,'\n')).digest('hex'),baselinePin)
 const source=readFileSync(new URL('./AnalyseTab.jsx',import.meta.url),'utf8')
 const base=readFileSync(new URL('./analyseConclusionBaseline.jsx',import.meta.url),'utf8')
 const restored=source.replace('analyseConclusionMessage = false, coachId, sendConclusionMessage, ', '').replace(/^import AnalyseConclusionMessage[^\n]*\r?\n/m,'').replace(/^import AnalyseConclusion[^\n]*\r?\n/m,'').replace(/                <AnalyseConclusion enabled=[\s\S]*?error=\{videoAnalysisError\}>\r?\n/,'').replace(/                <\/AnalyseConclusion>\r?\n/,'')
 assert.equal(restored,base)
})
test('counterexample: no IO, foreign review or invalid timestamp can become a conclusion',()=>{
 const names=['fetch','localStorage','sessionStorage','XMLHttpRequest','WebSocket']
 const saved=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)])
 try {
  for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,get(){throw Error('Forbidden IO '+name)}})
  globalThis.window={location:{search:'?analyseConclusion=1'}}
  const tree=mount(AnalyseTab,{...props,videoAnalyses:[row({})]}).render()
  assert.equal(text(one(tree,n=>n.props['aria-label']==='Konklusion')),'Godkendt videoreview (Squat, 2026-10-20): Hold pausen.')
  for(const bad of [row({athlete_id:'other'}),row({analyzed_at:'2026-10-20Tbogus'}),row({analyzed_at:'2026-02-30'}),row({status:'awaiting_analysis'}),row({athlete_feedback:{focus:[{text:' '}]}})]){
   assert.match(analyseConclusion({athleteId:'demo',analyses:[bad]}),/Der mangler/)
  }
 }finally{for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}}
})
test('counterexample: duplicate days, short periods, mixed rep zones, deload and stale athlete scope fail D21',()=>{
 const cases=[logs().map(r=>({...r,logged_at:'2026-10-01'})),logs().map(r=>({...r,exercises:{...r.exercises,sessions:{weeks:{block_name:'Deload'}}}})),logs().map((r,i)=>({...r,reps_completed:i===0?5:3})),logs().map(r=>({...r,weight:0}))]
 const stale=logs();stale.readEvidence={athleteId:'other',complete:true};cases.push(stale)
 for(const rs of cases)assert.match(analyseConclusion({athleteId:'demo',logs:rs}),/Der mangler/)
 assert.match(analyseConclusion({athleteId:'demo',logs:logs(),liftFilter:'bench'}),/Der mangler/)
 assert.match(analyseConclusion({athleteId:'demo',logs:logs()}),/estimerede 1RM/)
})
test('counterexample: evidence nodes and handlers keep identity and native details owns disclosure',()=>{
 let invoked=0
 const child={type:'button',props:{children:['Måling'],onClick:()=>invoked++}}
 const tree=Conclusion({enabled:true,athleteId:'demo',children:child})
 const details=one(tree,n=>n.type==='details')
 assert.equal(details.props.children[1],child)
 assert.equal(details.props.open,undefined)
 child.props.onClick();assert.equal(invoked,1)
 assert.equal(nodes(tree,n=>n.type==='summary').length,1)
 assert.equal(nodes(tree,n=>n.props['aria-label']==='Konklusion').length,1)
})
test('counterexample: loader rejects packages, extensionless, unlisted and escaping imports',async()=>{
 for(const name of ['react-dom','node:http','./notAllowed.mjs','./dataEnough','../../dataEnough.mjs','../outside.mjs']){
  await assert.rejects(import(name),/Closed loader/)
 }
})
