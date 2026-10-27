import test from 'node:test'
import assert from 'node:assert/strict'
import { app, h, nodes, text, normalized } from './coachRydHarness.mjs'
const load = await app(), old = await app(true)
const helper = await import('coachryd-test://1/coachRyd.mjs')
const { videoCoachFeedbackQuality } = await import('coachryd-test://1/videoCoachFeedbackQuality.js')
const noop = () => {}
const athlete = { id:'synthetic-a', name:'Syntetisk Atlet', status:'active' }
const common = { a:athlete, athletes:[athlete], hiddenAthleteIds:new Set(), unreadCounts:{}, weeklyActivity:{}, athleteReadiness:[], videoAnalyses:[],
  isMobile:false, activeTab:'hub', profileReturnView:'inbox', profilesLastSeen:{},
  setActiveTab:noop,setEditing:noop,setNavMenuOpen:noop,setShowDeleteModal:noop,setView:noop,showFlash:noop,
  coachPriorityItems:[],latestByTrack:{},unreadByTrack:{},openProfile:noop,setCoachMsgTrack:noop,
  refreshCoachInbox:noop, openCoachPriorityItem:noop,
}
const draft = { works:'Stabil startposition.', focus:'Stangen driver frem under opstigningen.', next_set:'Pres gulvet væk med hele foden.' }
function review(overrides={}) {
  return { ...common, selectedAthlete:athlete, videoAnalysisReview:{id:'synthetic-video',athlete_id:athlete.id,status:'coach_approved',lift:'squat',analyzed_at:'2026-10-26',athlete_feedback:{},session_context:{athlete_note:'Mit spørgsmål'}, ...overrides.analysis},
    videoBaselines:[],videoAnalysisFeedbackDraft:draft, videoAnalysisFeedbackDirty:false,
    closeVideoAnalysisReview:noop,discardVideoAnalysisFeedback:noop, saveVideoAnalysisFeedback:noop,reviewVideoAnalysis:noop,
    setVideoAnalysisBaselineFindingId:noop,setVideoAnalysisCloseWarning:noop,setVideoAnalysisFeedbackDirty:noop,setVideoAnalysisFeedbackDraft:noop,...overrides }
}
const button=(tree,label)=>nodes(tree).find(x=>x.type==='button' && text(x).trim()===label)
const home = { ...common,athleteCurrentWeek:{},athleteLastLogs:{},athleteWeekCompletion:{},athleteWeekSummary:{},calendarWeeks:[],coachBriefingSeen:{},coachPriorityCount:0,
  videoMeasurementByAthlete:{},showHiddenAthletes:false,athleteSortMode:'navn',setSelectedAthlete:noop }
const analysis = { ...common,athleteLogs:[],athletePRHistory:[],athleteWeightLogs:[],exerciseLibrary:[],weeks:[],videoBaselines:[],videoLiftFilter:'all',selectedAthlete:athlete,aiExportWeeks:4 }
test('flag is strictly opt-in and stateless',()=>{
  assert.equal(helper.DEFAULT_COACH_RYD,false)
  for(const value of ['', '?coachRyd=0','?coachRyd=true','?coach=ryd','?coachRyd=1&coachRyd=0']) {
    assert.equal(helper.coachRydEnabled(value),false)
  }
  assert.equal(helper.coachRydEnabled('?coachRyd=1'),true)
})
test('OFF trees equal pinned baseline on desktop and mobile',async()=>{
  for (const mobile of [false,true]) for(const name of ['ForsideView','IndbakkeView','ProfilHoved','HubTab','AnalyseTab','VideoReviewModal']) {
    const props=name==='VideoReviewModal'?review():name==='ForsideView'?home:name==='AnalyseTab'?analysis:common
    const candidate=await load(name+'.jsx'), baseline=await old(name+'.jsx')
    assert.deepEqual(normalized(candidate({...props,isMobile:mobile})),normalized(baseline({...props,isMobile:mobile})),name)
  }
})
test('home and analysis keep existing destinations within preview folds',async()=>{
  const Home=await load('ForsideView.jsx'), Analysis=await load('AnalyseTab.jsx'),calls=[]
  const tree=Home({...home,coachRyd:true,setView:x=>calls.push(x),setSelectedAthlete:x=>calls.push(x)})
  nodes(tree).find(x=>x.type==='button'&&text(x).includes('Arbejdsindbakke')).props.onClick()
  assert.deepEqual(calls,['inbox',null])
  const charts=Analysis({...analysis,coachRyd:true})
  const titles=nodes(charts).filter(x=>x.type==='summary').map(text)
  assert.ok(titles.includes('Mere: lokalt analyseværktøj'))
  assert.ok(titles.includes('Mere: træningsgrafer og historik'))
  assert.ok(nodes(charts).filter(x=>x.type==='details').every(x=>!x.props.open))
})
test('one inbox retains next item, error state, snooze, seen and correct item context',async()=>{
  const Inbox=await load('IndbakkeView.jsx'), calls=[]
  const item={key:'signal-a',kind:'signal',title:'Syntetisk signal',label:'Smerte',detail:'Se loggen',color:'#fff',signal:{o_athlete_id:athlete.id,o_detector:'pain'}}
  const tree=Inbox({...common,coachRyd:true,coachPriorityItems:[item,{...item,key:'signal-b'}],trainingSignalsError:'synthetic-error',
    openCoachPriorityItem:(...args)=>calls.push(args),handleTrainingSignal:(...args)=>calls.push(args)})
  assert.match(text(tree),/Arbejdsindbakke/)
  assert.match(text(tree),/kunne ikke opdateres/)
  button(tree,'Set').props.onClick(); button(tree,'Udsæt 7 dage').props.onClick()
  nodes(tree).find(x=>x.type==='button'&&text(x).includes('Syntetisk signal')).props.onClick()
  assert.deepEqual(calls,[[item.signal,'acknowledge'],[item.signal,'snooze'],[item,'inbox']])
  assert.equal(nodes(tree).find(x=>x.type==='details').props.open,false)
  assert.match(text(tree),/Vis alle samtaler/)
})
test('profile daily actions clear edit and menu without changing athlete scope',async()=>{
  const Profile=await load('ProfilHoved.jsx'), calls=[]
  const tree=Profile({...common,coachRyd:true,setActiveTab:x=>calls.push(x),setEditing:x=>calls.push(x),setNavMenuOpen:x=>calls.push(x)})
  for(const label of ['Plan','Log','Svar']) button(tree,label).props.onClick()
  assert.deepEqual(calls,['program',null,false,'log',null,false,'beskeder',null,false])
  assert.ok(nodes(tree).some(x=>x.type==='details'&&text(x).includes('Profiladministration')))
  assert.match(text(tree),/Syntetisk Atlet/)
})
test('hub keeps all destinations in closed More with original handlers',async()=>{
  const Hub=await load('HubTab.jsx'),calls=[]
  const tree=Hub({...common,coachRyd:true,setActiveTab:x=>calls.push(x),setEditing:x=>calls.push(x)})
  const more=nodes(tree).find(x=>x.type==='details'); assert.equal(more.props.open,undefined)
  for(const key of ['program','log','beskeder','kost','analyse']) {
    nodes(more).find(x=>x.type==='button'&&x.props.key===key).props.onClick()
  }
  assert.deepEqual(calls,['program',null,'log',null,'beskeder',null,'kost',null,'analyse',null])
})
test('video conclusion precedes feedback and actions precede measurements, no duplicate actions',async()=>{
  const Review=await load('VideoReviewModal.jsx'),calls=[]
  const tree=Review({...review(),coachRyd:true,reviewVideoAnalysis:(...args)=>calls.push(args)})
  const content=text(tree)
  assert.ok(content.indexOf('Konklusion')<content.indexOf('Det atleten ser'))
  assert.ok(content.indexOf('Del feedback med atlet')<content.indexOf('Baseline og måling'))
  assert.match(content,/Mit spørgsmål/);assert.match(content,/Stangen driver frem/)
  const share=button(tree,'Del feedback med atlet');assert.equal(share.props.disabled,false); share.props.onClick()
  assert.equal(calls.length,1);assert.equal(calls[0][0].id,'synthetic-video');assert.equal(calls[0][1],'shared')
  assert.equal(nodes(tree).filter(x=>x.type==='button'&&text(x)==='Del feedback med atlet').length,1)
})
test('video quality, dirty, updating and status guards remain enforced',async()=>{
  const Review=await load('VideoReviewModal.jsx')
  assert.equal(videoCoachFeedbackQuality(draft).canShare,true)
  for(const [props,label] of [[{videoAnalysisFeedbackDirty:true},'Gem feedback først'],[{videoAnalysisFeedbackDraft:{}},'Ret feedback først'],[{videoAnalysisUpdatingId:'synthetic-video'},'Deler…']]) {
    const tree=Review({...review(),...props,coachRyd:true}); assert.equal(button(tree,label).props.disabled,true)
  }
  for(const [status,label] of [['draft','Godkend til baseline'],['shared','Skjul og udelad måling'],['invalid','Tilbage til kladde']]) {
    const props=review();props.videoAnalysisReview.status=status
    const tree=Review({...props,coachRyd:true}); assert.ok(button(tree,label));assert.equal(button(tree,'Del feedback med atlet'),undefined)
  }
})
test('feedback editor and close/save/discard preserve handlers',async()=>{
  const Review=await load('VideoReviewModal.jsx'),calls=[]
  const tree=Review({...review(),coachRyd:true,videoAnalysisFeedbackDirty:true,setVideoAnalysisFeedbackDraft:fn=>calls.push(fn(draft)),setVideoAnalysisFeedbackDirty:x=>calls.push(x),setVideoAnalysisCloseWarning:x=>calls.push(x),saveVideoAnalysisFeedback:a=>calls.push(a.id),discardVideoAnalysisFeedback:a=>calls.push(a.id),closeVideoAnalysisReview:()=>calls.push('close')})
  nodes(tree).find(x=>x.type==='textarea').props.onChange({target:{value:'Ny observation'}})
  button(tree,'Gem feedback').props.onClick();button(tree,'Fortryd ændringer').props.onClick();button(tree,'Luk').props.onClick()
  assert.deepEqual(calls,[{...draft,works:'Ny observation'},true,false,'synthetic-video','synthetic-video','close'])
})
