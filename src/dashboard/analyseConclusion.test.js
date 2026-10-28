import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './analyseConclusionLoader.mjs'
import { mount, nodes, text, one } from './analyseTestDom.mjs'
install()
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const { default: Baseline } = await import('./analyseConclusionBaseline.jsx')
const { default: Conclusion, analyseConclusion, analyseConclusionEnabled, DEFAULT_ANALYSE_CONCLUSION } = await import('./analyseConclusion.mjs')
const empty = { a:{id:'demo',name:'Demo'}, selectedAthlete:{id:'demo',name:'Demo'}, athleteLogs:[], athletePRHistory:[],athleteReadiness:[],athleteWeightLogs:[],exerciseLibrary:[],videoAnalyses:[],videoBaselines:[],weeks:[],videoLiftFilter:'all' }
const approved = (id, date, focus, extra={}) => ({id,athlete_id:'demo',lift:'squat',status:'coach_approved',analyzed_at:date,athlete_feedback:{focus:[{text:focus}]},...extra})
const render = (Component, query='', props=empty) => {globalThis.window={location:{search:query}};return mount(Component,props).render()}
const clean = value => typeof value === 'function' ? '[handler]' : Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)])) : value
const conclusion = tree => one(tree,n=>n.props['aria-label']==='Konklusion')
const fold = tree => one(tree,n=>n.type==='details' && n.props.children.some(c=>c?.type==='summary' && text(c)==='Se grundlaget'))

test('default OFF and malformed or duplicate flags keep the exact pinned baseline DOM',()=>{
 assert.equal(DEFAULT_ANALYSE_CONCLUSION,false)
 for(const query of ['', '?analyseConclusion=0','?analyseConclusion=true','?analyseConclusion=1&analyseConclusion=1','?analyseConclusion=1&analyseConclusion=0']){
  assert.equal(analyseConclusionEnabled(query),false)
  assert.deepEqual(clean(render(AnalyseTab,query)),clean(render(Baseline,query)))
 }
 assert.equal(analyseConclusionEnabled('?analyseConclusion=1'),true)
 const { a, ...withoutAlias } = empty
 // a10e1041 retention preview requires its existing a alias on both sides.
 assert.throws(()=>render(AnalyseTab,'',withoutAlias),TypeError)
 assert.throws(()=>render(Baseline,'',withoutAlias),TypeError)
})
test('before FAIL / after PASS: actual tab starts with one conclusion and closed evidence',()=>{
 const before=render(Baseline,'?analyseConclusion=1')
 assert.throws(()=>fold(before),/Expected one node/)
 const after=render(AnalyseTab,'?analyseConclusion=1')
 assert.equal(after.type,'section')
 assert.equal(after.props.children[0],conclusion(after))
 assert.equal(after.props.children[1],fold(after))
 assert.equal(fold(after).props.open,undefined)
 assert.equal(nodes(after,n=>n.props['aria-label']==='Konklusion').length,1)
 assert.equal(conclusion(after).type,'p')
 assert.match(text(conclusion(after)),/mangler.*fire sammenlignelige tunge dage/)
 assert.deepEqual(clean(fold(after).props.children[1]),clean(before))
})
test('all existing content and AI handlers survive under the fold, including both previews',()=>{
 let clear=0,open=0
 const props={...empty,setAiExportText:v=>{assert.equal(v,'');clear++},setShowAiExport:v=>{assert.equal(v,true);open++}}
 for(const extra of ['', '&analyseSamlet=1&analyseSammenlign=1']){
  const after=render(AnalyseTab,'?analyseConclusion=1'+extra,props)
  const before=render(Baseline,'?analyseConclusion=1'+extra,props)
  assert.deepEqual(clean(fold(after).props.children[1]),clean(before))
  one(fold(after),n=>n.type==='button'&&text(n)==='AI Rapport').props.onClick()
 }
 assert.equal(clear,2);assert.equal(open,2)
})
test('latest approved saved focus wins over drafts, invalids and foreign athletes, independent of array order',()=>{
 const rows=[approved('old','2026-10-01','Hold pausen.'), approved('draft','2026-10-26','DRAFT',{status:'draft'}),approved('latest','2026-10-20','Hold spændingen. Ny sætning.'),approved('foreign','2026-10-27','FOREIGN',{athlete_id:'other'}),approved('invalid','2026-10-27','INVALID',{status:'invalid'})]
 for(const list of [rows,[...rows].reverse()]){
  const result=analyseConclusion({athleteId:'demo',analyses:list})
  assert.equal(result,'Godkendt videoreview (Squat, 2026-10-20): Hold spændingen.')
 }
 const after=render(AnalyseTab,'?analyseConclusion=1',{...empty,videoAnalyses:rows,openVideoAnalysisReview:()=>{}})
 assert.equal(text(conclusion(after)),'Godkendt videoreview (Squat, 2026-10-20): Hold spændingen.')
})
test('shared review, missing focus, bad dates, scope changes and failed reads',()=>{
 const rows=[approved('s','2026-10-21','Bevar pausen',{status:'shared',lift:'bench'}),approved('bad','bogus','BAD'),approved('empty','2026-10-26','  ')]
 assert.match(analyseConclusion({athleteId:'demo',analyses:rows,liftFilter:'bench'}),/Bevar pausen\.$/)
 for(const options of [{liftFilter:'squat'},{athleteId:'other'}, {loading:true},{error:'Failed'}]){
  assert.doesNotMatch(analyseConclusion({athleteId:'demo',analyses:rows,...options}),/Bevar pausen/)
 }
})
const logs = (dates=['2026-10-01','2026-10-08','2026-10-15','2026-10-22'])=>dates.map((date,i)=>({id:String(i),weight:100+i*5,reps_completed:3,logged_at:date+'T12:00:00Z',exercise_id:'squat',exercises:{name:'Squat',session_id:'s'+i,sessions:{deload:false}}}))
test('existing D21 rules govern the existing measurement with appData2 OFF and ON',()=>{
 for(const search of ['', '?appData2=1']){
  globalThis.location={search}
  assert.equal(analyseConclusion({athleteId:'demo',logs:logs()}),'Squat: seneste estimerede 1RM er 127 kg (2026-10-22).')
  for(const short of [logs().slice(0,3), logs(['2026-10-01','2026-10-02','2026-10-03','2026-10-04']),logs().map(r=>({...r,skipped:true})),logs().map(r=>({...r,athlete_id:'other'}))]){
   assert.match(analyseConclusion({athleteId:'demo',logs:short}),/Der mangler/)
  }
 }
 delete globalThis.location
})
test('wrapper OFF returns the same child object and does not evaluate data or access IO',()=>{
 const child={type:'evidence',props:{children:[]}}
 assert.equal(Conclusion({children:child,get logs(){throw Error('must not evaluate')}}),child)
})

test('actual review and filter handlers survive; rerendering another athlete clears the headline',()=>{
 let reviewed=null,filter=null
 const v=approved('review','2026-10-20','Hold spændingen.')
 const p={...empty,videoAnalyses:[v],openVideoAnalysisReview:r=>{reviewed=r},setVideoLiftFilter:value=>{filter=value}}
 const tree=render(AnalyseTab,'?analyseConclusion=1',p)
 one(fold(tree),n=>n.type==='button'&&text(n)==='Gennemgå måling').props.onClick()
 assert.equal(reviewed,v)
 one(fold(tree),n=>n.type==='button'&&text(n)==='Bænk').props.onClick()
 assert.equal(filter,'bench')
 const switched=render(AnalyseTab,'?analyseConclusion=1',{...p,a:{id:'other',name:'Other'},selectedAthlete:{id:'other',name:'Other'}})
 assert.match(text(conclusion(switched)),/Der mangler/)
 const filtered=render(AnalyseTab,'?analyseConclusion=1',{...p,videoLiftFilter:'bench'})
 assert.match(text(conclusion(filtered)),/Der mangler/)
})
