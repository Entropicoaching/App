import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachSaveNextJsx.mjs'
import { app, nodes, text } from './coachSaveNextHarness.mjs'
import { createInboxSaveNext, COACH_SAVE_NEXT_ENABLED } from './coachSaveNext.mjs'

test('exact final Dashboard JSX parses and wires both controls behind default OFF',()=>{
 const source=readFileSync(new URL(existsSync(new URL('./Dashboard.jsx',import.meta.url)) ? './Dashboard.jsx' : '../Dashboard.jsx',import.meta.url),'utf8').replace(/\r\n/g,'\n')
 const compiled=jsx(source)
 assert.ok(compiled.includes('saveMessageAndNext'))
 assert.ok(compiled.includes('saveVideoAndNext'))
 assert.ok(source.includes('COACH_SAVE_NEXT_ENABLED === true && inboxReplyMatches'))
 assert.ok(source.includes('sendCoachMessage({ confirmed: true })'))
 assert.ok(source.includes('saveVideoAnalysisFeedback(videoAnalysisReview, { confirmed: true })'))
 assert.equal(COACH_SAVE_NEXT_ENABLED,false)
 // Compile the actual translated module body. Imports are checked by the hermetic app tests.
 const body=compiled.replace(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/gm,'').replace(/^export default /m,'')
 assert.doesNotThrow(()=>new Function(body))
})
test('DOM busy and failure state remain visible on both imported components',async()=>{
 const load=await app({})
 const {default:Messages}=await load('src/dashboard/BeskederTab.jsx')
 const {default:Video}=await load('src/dashboard/VideoReviewModal.jsx')
 const common={saveNextAvailable:true,saveNextBusy:true,saveNextError:'Syntetisk fejl'}
 const trees=[Messages({...common,a:{id:'a'},coachMsgTrack:'besked',messages:[],messageInput:'hej'}),Video({...common,selectedAthlete:{id:'a'},videoAnalysisReview:{id:'v',status:'draft'},videoAnalysisFeedbackDraft:{focus:'cue'},videoBaselines:[],videoAnalyses:[]})]
 for(const tree of trees) {
  assert.ok(nodes(tree).some(n=>n.type==='button'&&text(n)==='Gemmer…'&&n.props.disabled))
  assert.ok(nodes(tree).some(n=>n.props?.role==='alert'&&text(n)==='Syntetisk fejl'))
 }
})
test('counterexample: wrong track cannot persist or navigate even with a valid answer',async()=>{
 const item={key:'message-a-teknik',kind:'message'}
 const scopeRef={current:{item,key:item.key,athleteId:'a',track:'besked',activeTab:'beskeder',view:'profile',returnView:'inbox'}}
 const fail=()=>assert.fail('out of scope side effect')
 const handler=createInboxSaveNext({enabled:true,scopeRef,run:{busy:false,completed:new Set()},persist:fail,open:fail,complete:fail,setBusy:fail,setError:fail})
 assert.equal(await handler('message','hej'),false)
})
