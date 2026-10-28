import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { install } from './analyseSamletLoader.mjs'
import { mount, nodes, one, text } from './analyseSamletDom.mjs'
install()
const {default: Tab}=await import('./AnalyseTab.jsx')
const {default: Wrapper,analyseConclusion}=await import('./analyseConclusion.mjs')
const props={a:{id:'local'},selectedAthlete:{id:'local'},athleteLogs:[],athletePRHistory:[],athleteReadiness:[],athleteWeightLogs:[],exerciseLibrary:[],videoAnalyses:[],videoBaselines:[],weeks:[],videoLiftFilter:'all'}
test('closed prototype loader rejects unknown, escaping and extensionless imports',async()=>{
 for(const name of ['node:http','react-dom','./unknown.mjs','./dataEnough','../../dataEnough.mjs','./unknown/../dataEnough.mjs']) await assert.rejects(import(name),/Closed loader/)
})
test('pinned baseline and accepted app payload stay exact',()=>{
 const hash=name=>createHash('sha256').update(readFileSync(new URL(name,import.meta.url))).digest('hex')
 assert.equal(hash('./analyseConclusionBaseline.jsx'),'b08de1810032a1c3e87bdcbd8e8af4248623163762ed946684bdcbf0ddd22d18')
 const accepted=readFileSync(new URL('./analyseConclusion.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n').replace(/^import \{ rel1030Feature \}[^\n]*\n/,'').replace("return (values.length === 1 && values[0] === '1') || rel1030Feature('analyseConclusion', search)", "return values.length === 1 && values[0] === '1'")
 assert.equal(createHash('sha256').update(accepted).digest('hex'),'0f820d5daf4845a7d4c985506d3460120c87252e28cf730a63f230f2d45c3836')
 const source=readFileSync(new URL('./AnalyseTab.jsx',import.meta.url),'utf8')
 const restored=source.replace(/^import AnalyseConclusion[^\n]*\r?\n/m,'').replace(/                <AnalyseConclusion enabled=[\s\S]*?error=\{videoAnalysisError\}>\r?\n/,'').replace(/                <\/AnalyseConclusion>\r?\n/,'')
 assert.equal(restored,readFileSync(new URL('./analyseConclusionBaseline.jsx',import.meta.url),'utf8'))
})
test('release and preview combinations preserve closed evidence and real handlers',()=>{
 for(const extra of ['', '&rel1030=1','&analyseSamlet=1&analyseSammenlign=1']) for(const isMobile of [false,true]) {
  let calls=0
  globalThis.window={location:{search:'?analyseConclusion=1'+extra}}
  const tree=mount(Tab,{...props,isMobile,setAiExportText:()=>{},setShowAiExport:()=>calls++}).render()
  assert.equal(nodes(tree,n=>n.props['aria-label']==='Konklusion').length,1)
  const details=one(tree,n=>n.type==='details'&&n.props.children.some(c=>c?.type==='summary'&&text(c)==='Se grundlaget'))
  assert.equal(details.props.open,undefined)
  one(tree,n=>n.type==='button'&&text(n)==='AI Rapport').props.onClick()
  assert.equal(calls,1)
 }
})
test('saved review timestamp and athlete scope are independent of array order',()=>{
 const row=(id,date,athlete='local')=>({id,athlete_id:athlete,lift:'squat',status:'shared',analyzed_at:date,athlete_feedback:{focus:[{text:id+'.'}]}})
 const rows=[row('older','2026-10-22T01:00:00Z'),row('latest','2026-10-22T23:00:00Z'),row('foreign','2026-10-23','other')]
 const prior=JSON.stringify(rows)
 assert.match(analyseConclusion({athleteId:'local',analyses:rows}),/latest\.$/)
 assert.match(analyseConclusion({athleteId:'local',analyses:[...rows].reverse()}),/latest\.$/)
 assert.equal(JSON.stringify(rows),prior)
 assert.doesNotMatch(analyseConclusion({athleteId:'local',analyses:rows,loading:true}),/latest/)
})
test('OFF does not read data and returns the original evidence reference',()=>{
 const child={type:'button',props:{children:['Evidence']}}
 assert.equal(Wrapper({children:child,get logs(){throw Error('OFF data access')}}),child)
})
