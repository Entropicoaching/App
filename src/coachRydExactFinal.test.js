import test from 'node:test'
import assert from 'node:assert/strict'
import {app,nodes,text,normalized} from './coachRydHarness.mjs'
const load=await app(),base=await app(true)
test('independent final counterexample: saved video preview survives coachRyd OFF and no duplicate approval on ON',async()=>{
 const Final=await load('VideoReviewModal.jsx'),Base=await base('VideoReviewModal.jsx')
 const previous=globalThis.localStorage
 try {
  for(const enabled of ['0','1']) {
   const reads=[];globalThis.localStorage={getItem:key=>{reads.push(key);return enabled}}
   for(const coachRyd of [undefined,false,true]) {
    const p={coachRyd,selectedAthlete:{id:'synthetic'},videoBaselines:[],videoAnalyses:[],videoAnalysisFeedbackDraft:{},videoAnalysisReview:{id:'synthetic-review',status:'draft',lift:'squat',athlete_feedback:{}}}
    const final=Final(p)
    if(!coachRyd)assert.deepEqual(normalized(final),normalized(Base(p)))
    assert.equal(nodes(final).filter(n=>n.type==='button'&&text(n)==='Godkend til baseline').length,1)
    assert.equal(nodes(final).filter(n=>n.props['aria-label']==='Konklusion').length,coachRyd||enabled==='1'?1:0)
   }
   assert.ok(reads.every(key=>key==='entropi:vc-review1'))
  }
 } finally {if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
})
