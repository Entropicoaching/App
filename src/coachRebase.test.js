import test from 'node:test'
import assert from 'node:assert/strict'
import { app, normalized, nodes, text } from './coachRydHarness.mjs'
const current = await app(), prior = await app(true)
const props = {a:{id:'synthetic'},selectedAthlete:{id:'synthetic'},athleteLogs:[],athletePRHistory:[],athleteReadiness:[],athleteWeightLogs:[],exerciseLibrary:[],videoAnalyses:[],videoBaselines:[],weeks:[],videoLiftFilter:'all'}
test('OFF trees equal pinned baseline on desktop and mobile through the coach harness', async()=>{
 const Final=await current('AnalyseTab.jsx'), Base=await prior('AnalyseTab.jsx')
 for(const isMobile of [false,true]) for(const search of ['', '?analyseConclusion=0','?analyseConclusion=1&analyseConclusion=0']) {
  globalThis.window={location:{search}}
  assert.deepEqual(normalized(Final({...props,isMobile})), normalized(Base({...props,isMobile})))
 }
})
test('coach harness imports the actual wrapper, preserving AI and retry handlers',async()=>{
 const Final=await current('AnalyseTab.jsx'); let ai=0,retry=0
 globalThis.window={location:{search:'?analyseConclusion=1'}}
 const tree=Final({...props,videoAnalysisError:'synthetic',setAiExportText:()=>{},setShowAiExport:()=>ai++,fetchVideoCoachHistory:()=>retry++})
 assert.equal(tree.type,'section')
 assert.equal(nodes(tree).filter(n=>n.props['aria-label']==='Konklusion').length,1)
 nodes(tree).find(n=>n.type==='button'&&text(n)==='AI Rapport').props.onClick()
 const retryButton=nodes(tree).find(n=>n.type==='button'&&text(n).includes('Prøv igen'))
 assert.ok(retryButton);retryButton.props.onClick()
 assert.equal(ai,1);assert.equal(retry,1)
})
