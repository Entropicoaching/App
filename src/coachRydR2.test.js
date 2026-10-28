import test from 'node:test'
import assert from 'node:assert/strict'
import {app,nodes,text,normalized} from './coachRydHarness.mjs'
const load=await app(), before=await app(false,false,true), baseline=await app(true)
const {ProfileActions}=await import('coachryd-test://1/coachRyd.mjs')
const noop=()=>{}
const athlete={id:'synthetic-a',name:'Eksempelatlet',status:'active'}
const common={athletes:[],hiddenAthleteIds:new Set(),unreadCounts:{},weeklyActivity:{},athleteCurrentWeek:{},athleteLastLogs:{},athleteWeekCompletion:{},athleteWeekSummary:{},calendarWeeks:[],coachBriefingSeen:{},coachPriorityItems:[],coachPriorityCount:0,videoMeasurementByAthlete:{},profilesLastSeen:{},athleteSortMode:'navn',latestByTrack:{},unreadByTrack:{},a:athlete,activeTab:'hub',profileReturnView:'inbox',setView:noop,setSelectedAthlete:noop,setActiveTab:noop,setEditing:noop,setNavMenuOpen:noop}
const fold=(tree,label)=>nodes(tree).find(n=>n.type==='details'&&text(n.children[0])===label)
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&text(n).trim()===label)
const video=(status,isMobile=false,evidence)=>({selectedAthlete:athlete,isMobile,videoBaselines:[],videoAnalyses:[],videoAnalysisReview:{id:'synthetic-video',athlete_id:athlete.id,status,lift:'squat',athlete_feedback:{},session_context:{feedback_evidence:evidence}},videoAnalysisFeedbackDraft:{},reviewVideoAnalysis:noop})

test('K-FUND1: empty home fold fails before and passes after, both widths',async()=>{
 const Old=await before('ForsideView.jsx'),Final=await load('ForsideView.jsx')
 for(const isMobile of [false,true]) {
  const p={...common,isMobile,coachRyd:true}
  const check=tree=>assert.equal(fold(tree,'Opgaver på forsiden'),undefined)
  assert.throws(()=>check(Old(p)),assert.AssertionError);check(Final(p))
 }
})

test('K-FUND2: empty evidence fold fails before and passes after in every status',async()=>{
 const Old=await before('VideoReviewModal.jsx'),Final=await load('VideoReviewModal.jsx')
 for(const status of ['draft','coach_approved','shared','invalid']) for(const isMobile of [false,true]) for(const evidence of [undefined,{},[],{priority:{title:'Mangler belæg'}}]) {
  const p={...video(status,isMobile,evidence),coachRyd:true}
  const check=tree=>assert.equal(fold(tree,'Målegrundlag for feedback'),undefined)
  assert.throws(()=>check(Old(p)),assert.AssertionError);check(Final(p))
 }
})

test('K-FUND3: profile task occurs twice before and once after, both widths',async()=>{
 const Old=await before('ProfilHoved.jsx'),Final=await load('ProfilHoved.jsx')
 for(const isMobile of [false,true]) {
  const p={...common,isMobile,coachRyd:true,profilePriorityContext:{summary:'Unik opgavekontekst',detail:'Unikt belæg',label:'Svar',color:'#fff'}}
  const check=tree=>assert.equal(text(tree).split('Unik opgavekontekst').length-1,1)
  assert.equal(text(Old(p)).split('Unik opgavekontekst').length-1,2)
  assert.throws(()=>check(Old(p)),assert.AssertionError);check(Final(p))
  assert.equal(text(Final(p)).split('Unikt belæg').length-1,1)
 }
})

test('counterexample: populated home fold retains scoped task click',async()=>{
 const Home=await load('ForsideView.jsx'),calls=[]
 const item={key:'synthetic-item',title:'Unik opgave',kind:'message',label:'Svar',detail:'Svar på besked',color:'#fff',athlete}
 for(const isMobile of [false,true]) {
  const tree=Home({...common,isMobile,coachRyd:false,coachPriorityItems:[item],coachPriorityCount:1,openCoachPriorityItem:(...x)=>calls.push(x)})
  assert.equal(fold(tree,'Opgaver på forsiden'),undefined); const details=tree
  nodes(details).find(n=>n.type==='button'&&text(n).includes('Unik opgave')).props.onClick()
 }
 assert.deepEqual(calls,[[item,'list'],[item,'list']])
})

test('counterexample: valid evidence remains folded and approval remains outside folds',async()=>{
 const Review=await load('VideoReviewModal.jsx')
 const evidence={priority:{title:'Syntetisk fokus',why:'Fordi',evidence:'Syntetisk grundlag'}}
 for(const isMobile of [false,true]) {
  const calls=[],tree=Review({...video('draft',isMobile,evidence),coachRyd:true,reviewVideoAnalysis:(...x)=>calls.push(x)})
  assert.match(text(fold(tree,'Målegrundlag for feedback')),/Syntetisk grundlag/)
  const approve=button(tree,'Godkend til baseline');assert.ok(approve)
  assert.equal(nodes(tree).filter(n=>n.type==='details').some(n=>nodes(n).includes(approve)),false)
  approve.props.onClick();assert.equal(calls[0][0].id,'synthetic-video');assert.equal(calls[0][1],'coach_approved')
  assert.equal(fold(tree,'Baseline og måling').props.open,true)
 }
})

test('counterexample: absent context gets guidance, null suppresses it, handlers retain scope',async()=>{
 const hint='Plan, træning og svar samlet for den valgte atlet.'
 assert.ok(text(ProfileActions({athlete,go:noop})).includes(hint))
 assert.ok(!text(ProfileActions({athlete,task:null,go:noop})).includes(hint))
 const Profile=await load('ProfilHoved.jsx'),calls=[]
 for(const context of [undefined,{summary:'Aktuel sag',label:'Svar',color:'#fff'}]) {
  const tree=Profile({...common,coachRyd:true,profilePriorityContext:context,setActiveTab:x=>calls.push(x),setEditing:x=>calls.push(x),setNavMenuOpen:x=>calls.push(x)})
  for(const label of ['Plan','Log','Svar']) button(tree,label).props.onClick()
  assert.equal(text(tree).includes(hint),!context)
 }
 assert.deepEqual(calls,Array(2).fill(['program',null,false,'log',null,false,'beskeder',null,false]).flat())
})

test('counterexample: OFF and absent flag match newest baseline with empty or populated data',async()=>{
 for(const name of ['ForsideView','ProfilHoved','VideoReviewModal']) {
  const Final=await load(name+'.jsx'),Base=await baseline(name+'.jsx')
  for(const isMobile of [false,true]) for(const flag of [undefined,false]) for(const filled of [false,true]) {
   const props=name==='VideoReviewModal'?video('draft',isMobile,filled?{strength:{title:'God start',evidence:'Testgrundlag'}}:undefined):{...common,isMobile,profilePriorityContext:filled?{summary:'En sag',label:'Svar',color:'#fff'}:undefined}
   assert.deepEqual(normalized(Final({...props,coachRyd:flag})),normalized(Base({...props,coachRyd:flag})))
  }
 }
})
