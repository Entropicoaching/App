import './reviewLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, button, text, nodes } from './reviewDom.mjs'
const { default: Modal } = await import('./VideoReviewModal.jsx')
const { default: Templates } = await import('./VideoReviewTemplates.mjs')

function modal(overrides = {}) {
  let writes = 0, saves = 0, shares = 0, reads = 0
  globalThis.localStorage = {
    getItem(key) { if (key.startsWith('entropi_coach_message_templates')) reads++; return JSON.stringify([{name:'Tempo',text:'{atlet}: Hold tempoet.'}]) },
    setItem() { writes++ },
  }
  const p = { coachId:'synthetic-coach', selectedAthlete:{id:'a',name:'$& $1 <b>A</b>'},
    videoAnalysisReview:{id:'r',athlete_id:'a',status:'draft'}, videoReviewTemplates:true,
    videoAnalysisFeedbackDraft:{works:'Bevar',focus:'Eget fokus',next_set:'Cue'},
    videoBaselines:[], videoAnalyses:[],
    setVideoAnalysisFeedbackDraft(fn) { p.videoAnalysisFeedbackDraft=fn(p.videoAnalysisFeedbackDraft) },
    setVideoAnalysisFeedbackDirty(v) { p.dirty=v }, setVideoAnalysisCloseWarning() {},
    saveVideoAnalysisFeedback() { saves++ }, reviewVideoAnalysis() { shares++ },
    saveApproveShareVideoAnalysis() { shares++ }, ...overrides }
  const app=mount(Modal,p)
  return {p,render:()=>app.render(p),counts:()=>({writes,saves,shares,reads})}
}
function choose(f) {
  button(f.render(),'Vælg konklusionsskabelon').onClick()
  button(f.render(),'Tempo').onClick()
}

test('R2 counter: literal athlete name, explicit edit, no automatic persistence or status change',()=>{
  const f=modal(); choose(f)
  assert.equal(f.p.videoAnalysisFeedbackDraft.focus,'Eget fokus')
  button(f.render(),'Erstat fokus med skabelonen').onClick()
  assert.equal(f.p.videoAnalysisFeedbackDraft.focus,'$& $1 <b>A</b>: Hold tempoet.')
  assert.equal(f.p.videoAnalysisReview.status,'draft')
  assert.deepEqual(f.counts(),{writes:0,saves:0,shares:0,reads:1})
  assert.equal(nodes(f.render(),n=>n.type==='b').length,0)
})

test('R2 counter: removing permission after preview removes the apply action',()=>{
  for (const change of [p=>p.videoReviewTemplates=false,p=>p.coachId='',
    p=>p.videoAnalysisReview={...p.videoAnalysisReview,status:'shared'},
    p=>p.selectedAthlete={id:'other'}]) {
    const f=modal(); choose(f); change(f.p)
    assert.doesNotMatch(text(f.render()),/Erstat fokus med skabelonen|Vælg konklusionsskabelon/)
    assert.equal(f.p.videoAnalysisFeedbackDraft.focus,'Eget fokus')
    assert.deepEqual(f.counts(),{writes:0,saves:0,shares:0,reads:1})
  }
})

test('R2 counter: close and reopen observes a changed library and clears old selection',()=>{
  const f=modal(); choose(f)
  button(f.render(),'Luk konklusionsskabeloner').onClick(); f.render()
  globalThis.localStorage.getItem=()=>JSON.stringify([{name:'Ny',text:'Ny kladde'}])
  button(f.render(),'Vælg konklusionsskabelon').onClick()
  assert.doesNotMatch(text(f.render()),/Erstat fokus med skabelonen/)
  button(f.render(),'Ny').onClick()
  button(f.render(),'Erstat fokus med skabelonen').onClick()
  assert.equal(f.p.videoAnalysisFeedbackDraft.focus,'Ny kladde')
})

test('R2 counter: exact expanded boundary guards directly invoked handlers',()=>{
  for (const size of [600,601]) {
    let applied=[]
    const app=mount(Templates,{coachId:'c',athleteName:'$&',focus:'',onApply:v=>applied.push(v),
      storage:()=>({getItem:()=>JSON.stringify([{name:'Graense',text:'{atlet}'+ 'x'.repeat(size-2)}])})})
    button(app.render(),'Vælg konklusionsskabelon').onClick()
    button(app.render(),'Graense').onClick()
    const apply=button(app.render(),'Indsæt i Atletens fokus')
    assert.equal(apply.disabled,size===601); apply.onClick()
    assert.deepEqual(applied,size===600?['$&'+'x'.repeat(598)]:[])
  }
})

test('R2 counter: OFF values and missing coach never access storage even through layout route',()=>{
  for (const coachRyd of [false,true]) for (const flag of [undefined,false,0,1,'true',null]) {
    const f=modal({coachRyd,videoReviewTemplates:flag})
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Forbidden read')}})
    assert.doesNotMatch(text(f.render()),/Vælg konklusionsskabelon/)
    Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:undefined})
    assert.equal(f.counts().reads,0)
  }
})

test('R2 counter: storage failure can be retried and never marks feedback dirty',()=>{
  const f=modal()
  globalThis.localStorage.getItem=()=>{throw Error('Denied synthetic storage')}
  button(f.render(),'Vælg konklusionsskabelon').onClick()
  assert.match(text(f.render()),/kunne ikke læses/)
  assert.equal(f.p.dirty,undefined)
  assert.equal(f.p.videoAnalysisReview.status,'draft')
  assert.equal(f.counts().writes+f.counts().saves+f.counts().shares,0)
})
