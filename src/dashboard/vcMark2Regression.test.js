import './vcMark2Loader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const {default: Modal} = await import('./VideoReviewModal.jsx')
const {default: Templates, DEFAULT_VIDEO_REVIEW_TEMPLATES} = await import('./VideoReviewTemplates.mjs')
import { mount, nodes, text, button } from './vcMark2Dom.mjs'

const rows = [{ name: 'Dybde', text: '{atlet}: Hold samme dybde.' }, { name: 'Tempo', text: 'Hold tempoet roligt.' }]
function fixture(overrides = {}) {
  let reads = [], writes = 0, saves = 0, shares = 0
  const storage = { getItem(key) { if (key.startsWith("entropi_coach_message_templates")) reads.push(key); return JSON.stringify(rows) }, setItem() { writes++ } }
  globalThis.localStorage = storage
  let p = {
    coachId: 'coach-a', selectedAthlete: { id: 'athlete-a', name: 'Test Atlet' },
    videoReviewTemplates: true, videoAnalysisReview: { id: 'review-a', athlete_id: 'athlete-a', status: 'draft', analyzed_at: '2026-10-26' },
    videoAnalysisFeedbackDraft: { works: 'Bevar dette', focus: 'Min egen kladde', next_set: 'Mit cue' },
    videoBaselines: [], videoAnalyses: [], videoAnalysisFeedbackDirty: false,
    setVideoAnalysisFeedbackDraft(fn) { p.videoAnalysisFeedbackDraft = fn(p.videoAnalysisFeedbackDraft) },
    setVideoAnalysisFeedbackDirty(v) { p.videoAnalysisFeedbackDirty = v },
    setVideoAnalysisCloseWarning(v) { p.videoAnalysisCloseWarning = v },
    saveVideoAnalysisFeedback() { saves++ }, reviewVideoAnalysis() { shares++ }, saveApproveShareVideoAnalysis() { shares++ },
    ...overrides,
  }
  const app = mount(Modal, p)
  return { render: () => app.render(p), p, reads, counts: () => ({writes,saves,shares}) }
}
function choose(f, name = 'Dybde') {
  button(f.render(), 'Vælg konklusionsskabelon').onClick()
  button(f.render(), name).onClick()
  return f.render()
}

test('default OFF and strict flag: no template UI or library reads', () => {
  assert.equal(DEFAULT_VIDEO_REVIEW_TEMPLATES, false)
  for (const value of [undefined, false, 'true', 1]) {
    const f = fixture({videoReviewTemplates:value})
    assert.equal(text(f.render()).includes('Vælg konklusionsskabelon'), false)
    assert.deepEqual(f.reads, [])
  }
})

test('actual modal: selecting previews, explicit replacement edits only focus and stays local', () => {
  const f=fixture()
  f.render(); assert.deepEqual(f.reads, [])
  const tree=choose(f)
  assert.deepEqual(f.reads, ['entropi_coach_message_templates_v1:coach-a'])
  assert.equal(f.p.videoAnalysisFeedbackDraft.focus, 'Min egen kladde')
  assert.equal(f.p.videoAnalysisFeedbackDirty, false)
  button(tree, 'Erstat fokus med skabelonen').onClick()
  assert.deepEqual(f.p.videoAnalysisFeedbackDraft, {works:'Bevar dette',focus:'Test Atlet: Hold samme dybde.',next_set:'Mit cue'})
  assert.equal(f.p.videoAnalysisFeedbackDirty, true)
  assert.equal(f.p.videoAnalysisCloseWarning, false)
  const area=nodes(f.render(), n=>n.type==='textarea' && n.props.value===f.p.videoAnalysisFeedbackDraft.focus)[0]
  area.props.onChange({target:{value:'Min rettede konklusion'}})
  assert.equal(f.p.videoAnalysisFeedbackDraft.focus, 'Min rettede konklusion')
  assert.deepEqual(f.counts(), {writes:0,saves:0,shares:0})
})

test('empty focus has explicit insertion and other fields survive', () => {
  const f=fixture({videoAnalysisFeedbackDraft:{works:'Godt',focus:'',next_set:'Cue'}})
  button(choose(f,'Tempo'), 'Indsæt i Atletens fokus').onClick()
  assert.deepEqual(f.p.videoAnalysisFeedbackDraft,{works:'Godt',focus:'Hold tempoet roligt.',next_set:'Cue'})
})

test('noneditable status and mismatched athlete scope do not expose templates', () => {
  for (const status of ['shared','invalid','unknown']) {
    const f=fixture({videoAnalysisReview:{id:'x',athlete_id:'athlete-a',status}})
    assert.equal(text(f.render()).includes('Vælg konklusionsskabelon'), false)
    assert.deepEqual(f.reads,[])
  }
  for (const overrides of [{coachId:''},{selectedAthlete:{id:'other'}}]) {
    const f=fixture(overrides)
    assert.equal(text(f.render()).includes('Vælg konklusionsskabelon'),false)
  }
})

test('updating blocks opening and insertion even if handlers are invoked directly', () => {
  const f=fixture()
  choose(f)
  f.p.videoAnalysisUpdatingId='review-a'
  const apply=button(f.render(),'Erstat fokus med skabelonen')
  assert.equal(apply.disabled,true); apply.onClick()
  assert.equal(f.p.videoAnalysisFeedbackDirty,false)
  assert.equal(button(f.render(),'Luk konklusionsskabeloner').disabled,true)
})

test('coach, athlete and review changes clear selection and use the current coach library', () => {
  const f=fixture(); choose(f)
  f.p.coachId='coach-b'
  assert.equal(text(f.render()).includes('Erstat fokus med skabelonen'),false)
  choose(f)
  assert.equal(f.reads.at(-1),'entropi_coach_message_templates_v1:coach-b')
  f.p.videoAnalysisReview={...f.p.videoAnalysisReview,id:'review-b'}
  assert.equal(text(f.render()).includes('Erstat fokus med skabelonen'),false)
  choose(f)
  f.p.selectedAthlete={id:'athlete-b',name:'Anden'}
  f.p.videoAnalysisReview={...f.p.videoAnalysisReview,athlete_id:'athlete-b'}
  assert.equal(text(f.render()).includes('Erstat fokus med skabelonen'),false)
})

test('storage denial, malformed library and empty library preserve editable feedback', () => {
  for (const raw of ['bad','{}','[]','[{"name":"x","text":5}]']) {
    const f=fixture(); globalThis.localStorage={getItem:()=>raw}
    button(f.render(),'Vælg konklusionsskabelon').onClick()
    assert.equal(nodes(f.render(),n=>n.props.onClick && text(n)==='Erstat fokus med skabelonen').length,0)
    assert.equal(f.p.videoAnalysisFeedbackDraft.focus,'Min egen kladde')
  }
  const f=fixture(); Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('denied')}})
  button(f.render(),'Vælg konklusionsskabelon').onClick()
  assert.match(text(f.render()),/kunne ikke læses/)
  Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:undefined})
})

test('600 character limit is enforced after placeholder expansion without truncation', () => {
  for (const size of [600,601]) {
    let applied=''
    const app=mount(Templates,{coachId:'c',athleteName:'X',focus:'',onApply:v=>{applied=v},storage:()=>({getItem:()=>JSON.stringify([{name:'Lang',text:'{atlet}'.repeat(size)}])})})
    button(app.render(),'Vælg konklusionsskabelon').onClick()
    button(app.render(),'Lang').onClick()
    const b=button(app.render(),'Indsæt i Atletens fokus')
    assert.equal(b.disabled,size>600); b.onClick()
    assert.equal(applied,size===600?'X'.repeat(600):'')
  }
})
