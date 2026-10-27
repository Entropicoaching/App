import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text, normalized } from './coachRydHarness.mjs'
const load=await app(), old=await app(true)
const { CoachFold, WorkInboxLink, ReviewConclusion, coachRydEnabled }=await import('coachryd-test://1/coachRyd.mjs')
test('counterexample: duplicate flags, other previews and truthy values never opt in',()=>{
  for(const query of ['?enkel=1','?coach=inbox','?coachRyd=1&coachRyd=0','?coachRyd=0&coachRyd=1','?coachRyd=01','?coachRyd=true']) assert.equal(coachRydEnabled(query),false)
  for(const enabled of [undefined,false,'true',1]) assert.equal(nodes(CoachFold({enabled,title:'Mere',children:['indhold']})).some(x=>x.type==='details'),false)
})
test('counterexample: shared conclusion uses saved feedback, not unsaved draft or findings',()=>{
  const tree=ReviewConclusion({analysis:{status:'shared',athlete_feedback:{focus:[{text:'Gemt fokus'}],next_set:[{text:'Gemt handling'}]}},draft:{focus:'Forkert udkast'},editable:false,quality:{canShare:true}})
  assert.match(text(tree),/Gemt fokus/);assert.doesNotMatch(text(tree),/Forkert udkast/)
  assert.match(text(tree),/Feedback er delt/)
})
test('counterexample: untrusted text is a child, never inserted as HTML; empty queue is not claimed complete',()=>{
  const title='<img src=x onerror=alert(1)>', calls=[]
  const tree=WorkInboxLink({count:0,next:{title},open:()=>calls.push('inbox')})
  assert.match(text(tree),/Arbejdsindbakke/)
  assert.equal(nodes(tree).some(x=>x.props.dangerouslySetInnerHTML),false)
  assert.match(text(tree),/<img src=x/)
  nodes(tree).find(x=>x.type==='button').props.onClick();assert.deepEqual(calls,['inbox'])
  assert.match(text(WorkInboxLink({count:0,open:()=>{}})),/Åbn for status og opdatering/)
})
test('counterexample: populated review OFF remains exact for every status, dirty state and mobile layout',async()=>{
  const Review=await load('VideoReviewModal.jsx'),Baseline=await old('VideoReviewModal.jsx')
  for(const status of ['draft','coach_approved','shared','invalid']) for(const isMobile of [true,false]) for(const dirty of [true,false]) {
    const props={coachRyd:false,isMobile,selectedAthlete:{id:'synthetic-b'},videoAnalyses:[],videoBaselines:[],videoAnalysisReview:{id:'review-b',athlete_id:'synthetic-b',status,lift:'squat',analyzed_at:'2026-10-26',findings:[{summary:'Syntetisk fund'}],session_context:{athlete_note:'Langt spørgsmål '.repeat(20),baseline_snapshot:[{}]},athlete_feedback:{focus:[{text:'Gemt fokus'}],next_set:[{text:'Pres gulvet'}]}},videoAnalysisFeedbackDraft:{works:'Stabil start',focus:'Fokus',next_set:'Pres gulvet'},videoAnalysisFeedbackDirty:dirty}
    assert.deepEqual(normalized(Review(props)),normalized(Baseline(props)))
  }
})
test('counterexample: automation action stays disabled while saving; priority error stays on first layer',async()=>{
  const Inbox=await load('IndbakkeView.jsx')
  const tree=Inbox({coachRyd:true,athletes:[],hiddenAthleteIds:new Set(),coachPriorityItems:[{kind:'automation',key:'automation-x',title:'Fejl',label:'Automatisering',color:'#fff',alert:{id:'synthetic-alert'}}],latestByTrack:{},unreadByTrack:{},automationAlertUpdatingId:'synthetic-alert',automationAlertsError:'synthetic-failure'})
  assert.equal(nodes(tree).find(x=>x.type==='button'&&text(x)==='Gemmer…').props.disabled,true)
  assert.match(text(tree),/Noget af prioriteringskøen kunne ikke opdateres/)
  const topText=tree.children.filter(x=>x?.type!=='details').map(text).join(' ')
  assert.match(topText,/kunne ikke opdateres/)
})
