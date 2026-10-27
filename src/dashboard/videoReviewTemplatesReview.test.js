import './reviewLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { mount, text, button, nodes } from './reviewDom.mjs'
const {default: Templates} = await import('./VideoReviewTemplates.mjs')

function setup(rows, extra={}) {
  let applied=[], reads=[]
  const props={coachId:'coach / A',athleteName:'<script>$&',focus:'Min tekst',
    onApply:t=>applied.push(t), storage:()=>({getItem:key=>{reads.push(key);return JSON.stringify(rows)},setItem(){throw Error('No writes')}}),...extra}
  const app=mount(Templates,props)
  return {props,app,applied,reads}
}
test('counter: arbitrary markup and replacement tokens remain literal text',()=>{
  const f=setup([{name:'<img>',text:'{atlet}: <b>Tempo</b>'}])
  button(f.app.render(),'Vælg konklusionsskabelon').onClick()
  button(f.app.render(),'<img>').onClick()
  const tree=f.app.render()
  assert.equal(nodes(tree,n=>n.type==='script'||n.type==='img'||n.type==='b').length,0)
  assert.match(text(tree),/<script>\$&: <b>Tempo<\/b>/)
  button(tree,'Erstat fokus med skabelonen').onClick()
  assert.deepEqual(f.applied,['<script>$&: <b>Tempo</b>'])
  assert.deepEqual(f.reads,['entropi_coach_message_templates_v1:coach%20%2F%20A'])
})
test('counter: reopening retries a failed storage read and clears selection',()=>{
  const f=setup([{name:'Tempo',text:'Roligt tempo'}])
  const real=f.props.storage
  f.props.storage=()=>{throw Error('denied')}
  button(f.app.render(),'Vælg konklusionsskabelon').onClick()
  assert.match(text(f.app.render()),/kunne ikke læses/)
  button(f.app.render(),'Luk konklusionsskabeloner').onClick(); f.app.render()
  f.props.storage=real
  button(f.app.render(),'Vælg konklusionsskabelon').onClick()
  button(f.app.render(),'Tempo').onClick()
  button(f.app.render(),'Luk konklusionsskabeloner').onClick(); f.app.render()
  button(f.app.render(),'Vælg konklusionsskabelon').onClick()
  assert.equal(text(f.app.render()).includes('Erstat fokus med skabelonen'),false)
  assert.deepEqual(f.applied,[])
})
test('counter: whitespace and oversized expanded text cannot alter draft',()=>{
  const f=setup([{name:'Lang',text:'{atlet}'.repeat(100)}],{athleteName:'x'.repeat(100)})
  button(f.app.render(),'Vælg konklusionsskabelon').onClick()
  button(f.app.render(),'Lang').onClick()
  const b=button(f.app.render(),'Erstat fokus med skabelonen')
  assert.equal(b.disabled,true); b.onClick(); assert.deepEqual(f.applied,[])
})
test('counter: approved modal, both layout routes, and unchanged OFF tree',async()=>{
  const {default: Modal}=await import('./VideoReviewModal.jsx')
  const base={coachId:'c',selectedAthlete:{id:'a',name:'A'},videoAnalysisReview:{id:'r',athlete_id:'a',status:'coach_approved'},
    videoAnalysisFeedbackDraft:{works:'',focus:'',next_set:''},videoBaselines:[],videoAnalyses:[]}
  const off=mount(Modal,base).render()
  const explicitOff=mount(Modal,{...base,videoReviewTemplates:false}).render()
  const {default: Baseline}=await import('./reviewBaseline.jsx')
  const original=mount(Baseline,base).render()
  const snapshot=tree=>JSON.stringify(tree,(_key,value)=>typeof value==='function'?'[handler]':value)
  assert.equal(snapshot(off),snapshot(explicitOff))
  assert.equal(snapshot(off),snapshot(original))
  const on=mount(Modal,{...base,videoReviewTemplates:true}).render()
  assert.match(text(on),/Vælg konklusionsskabelon/)
  assert.match(text(mount(Modal,{...base,coachRyd:true,videoReviewTemplates:true}).render()),/Vælg konklusionsskabelon/)
})
test('counter: Dashboard forwards a default-OFF prop and session identity with explicit module extension',()=>{
  const source=readFileSync(new URL(existsSync(new URL('./Dashboard.jsx',import.meta.url)) ? './Dashboard.jsx' : '../Dashboard.jsx',import.meta.url),'utf8').replace(/\r\n/g,'\n')
  assert.match(source,/videoReviewTemplates = DEFAULT_VIDEO_REVIEW_TEMPLATES/)
  assert.match(source,/coachId=\{session\?\.user\?\.id\} videoReviewTemplates=\{videoReviewTemplates\}/)
  assert.match(source,/from '\.\/dashboard\/VideoReviewTemplates\.mjs'/)
})
