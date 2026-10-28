import test from 'node:test'
import assert from 'node:assert/strict'
import { COACH_SAVE_NEXT_ENABLED, createInboxSaveNext, inboxReplyMatches, nextInboxReply } from './coachSaveNext.mjs'
import { app, nodes, text } from './coachSaveNextHarness.mjs'
const message = (id, track='besked') => ({key:`message-${id}-${track}`,kind:'message',athlete:{id},track})
const video = id => ({key:`video-${id}`,kind:'video',athlete:{id:'a'},video:{id}})
function flow({kind='message', persist=async()=>true, enabled=true, items=[video('z'), message('b')]}={}) {
 const current=kind==='message'?message('a'):video('v')
 const scopeRef={current:{view:'profile',returnView:'inbox',key:current.key,item:current,athleteId:'a',track:'besked',activeTab:kind==='message'?'beskeder':'analyse',analysisId:kind==='video'?'v':undefined,items}}
 const events=[], run={busy:false,completed:new Set()}
 const handler=createInboxSaveNext({enabled,scopeRef,run,persist,open:x=>events.push(x.key),complete:()=>events.push('complete'),setBusy:x=>events.push(x),setError:x=>{if(x)events.push('error')}})
 return {handler,events,scopeRef,run}
}
test('default OFF and strict opt in have no effects',async()=>{
 assert.equal(COACH_SAVE_NEXT_ENABLED,false)
 for(const enabled of [false,undefined,'true',1]) {
  const f=flow({enabled:enabled===undefined?false:enabled,persist:()=>{throw Error('must not write')}})
  assert.equal(await f.handler('message','hej'),false);assert.deepEqual(f.events,[])
 }
})
test('existing inbox order, only replyable tasks, completed skipped',()=>{
 const items=[{key:'signal',kind:'signal'},video('z'),message('b'),video('c')]
 assert.equal(nextInboxReply(items,'video-z').key,'message-b-besked')
 assert.equal(nextInboxReply(items,'x',new Set(['video-z'])).key,'message-b-besked')
 assert.equal(nextInboxReply([], 'x'),null)
})
test('empty answer and false or absent save result never advance',async()=>{
 let writes=0;const f=flow({persist:async()=>{writes++;return true}})
 assert.equal(await f.handler('message',' \n '),false);assert.equal(writes,0)
 for(const result of [undefined,false,null,{},'true']) {
  const g=flow({persist:async()=>result});assert.equal(await g.handler('message','hej'),false)
  assert.ok(!g.events.includes('video-z'));assert.ok(g.events.includes('error'))
 }
})
test('await confirmed persistence, double tap and rerender share the lock',async()=>{
 let resolve, writes=0
 const f=flow({persist:()=>{writes++;return new Promise(r=>resolve=r)}})
 const pending=f.handler('message','hej')
 assert.equal(await f.handler('message','hej'),false)
 const rerender=createInboxSaveNext({enabled:true,scopeRef:f.scopeRef,run:f.run,persist:()=>{throw Error('duplicate')},setBusy:()=>{},setError:()=>{}})
 assert.equal(await rerender('message','hej'),false)
 assert.ok(!f.events.includes('video-z'));resolve(true);assert.equal(await pending,true)
 assert.equal(writes,1);assert.ok(f.events.includes('video-z'))
})
test('last video completes once, rejected writes and navigation preserve scope',async()=>{
 const f=flow({kind:'video',items:[]});assert.equal(await f.handler('video','cue'),true)
 assert.ok(f.events.includes('complete'));assert.equal(await f.handler('video','cue'),false)
 const failed=flow({persist:async()=>{throw Error('offline')}})
 assert.equal(await failed.handler('message','hej'),false);assert.ok(failed.events.includes('error'))
 let resolve;const moved=flow({persist:()=>new Promise(r=>resolve=r)})
 const pending=moved.handler('message','hej');moved.scopeRef.current={...moved.scopeRef.current,athleteId:'b'}
 resolve(true);await pending;assert.ok(!moved.events.includes('video-z'))
})
test('only the inbox matching athlete, track, tab and video can save',()=>{
 const f=flow();assert.equal(inboxReplyMatches(f.scopeRef.current),true)
 for(const patch of [{view:'inbox'},{returnView:'list'},{track:'teknik'},{athleteId:'other'},{activeTab:'hub'},{key:null}]) assert.equal(inboxReplyMatches({...f.scopeRef.current,...patch}),false)
 const v=flow({kind:'video'});assert.equal(inboxReplyMatches(v.scopeRef.current),true)
 assert.equal(inboxReplyMatches({...v.scopeRef.current,analysisId:'wrong'}),false)
})
function backend(result, pending) {
 const calls=[]
 const api={from(table){calls.push(['from',table]);return api},insert(payload){api.payload=payload;calls.push(['insert',payload]);return api},update(payload){api.payload=payload;calls.push(['update',payload]);return api},eq(...v){calls.push(['eq',...v]);return api},is(...v){calls.push(['is',...v]);return api},filter(...v){calls.push(['filter',...v]);return api},select(v){calls.push(['select',v]);return api},single(){return pending?pending:Promise.resolve(typeof result==='function'?result(api.payload):result)},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}}
 return {api,calls}
}
const noop=()=>{}
async function messageHandler(db) {
 const load=await app(db.api), {lavIndbakkeHandlinger}=await load('src/dashboard/indbakkeHandlinger.js')
 const state={input:'hej',error:null,sending:false,refreshed:0}
 const handler=lavIndbakkeHandlinger({athletes:[{id:'a'}],coachMsgTrack:'besked',messageInput:' hej ',selectedAthlete:{id:'a'},sendingMessage:false,messageThreadAthleteRef:{current:'a'},setSendingMessage:v=>state.sending=v,setMessageSendError:v=>state.error=v,setMessageInput:v=>state.input=v,fetchMessages:async()=>state.refreshed++,fetchLatestMessages:async()=>state.refreshed++}).sendCoachMessage
 return {handler,state}
}
test('actual message handler requires matching persisted row, preserves draft on bad acknowledgements',async()=>{
 for(const data of [null,{id:'m',athlete_id:'other'},{id:'m',athlete_id:'a',sender_role:'coach',content:'wrong',category:'besked'}]) {
  const db=backend({data,error:null}),{handler,state}=await messageHandler(db)
  assert.notEqual(await handler({confirmed:true}),true);assert.equal(state.input,'hej');assert.ok(state.error);assert.equal(state.refreshed,0)
 }
 const db=backend(p=>({data:{id:'m',...p},error:null})),{handler,state}=await messageHandler(db)
 assert.equal(await handler({confirmed:true}),true);assert.equal(state.input,'');assert.equal(state.refreshed,2)
 assert.equal(db.api.payload.category,'besked');assert.equal(db.api.payload.content,'hej')
})
test('legacy message send keeps insert contract with flag OFF',async()=>{
 const db=backend({error:null}),{handler,state}=await messageHandler(db)
 await handler();assert.equal(state.input,'');assert.ok(!db.calls.some(c=>c[0]==='select'))
})
async function videoHandler(db,draft={focus:'Hold trykket',works:'',next_set:''}) {
 const load=await app(db.api),{lavVideoReviewHandlinger}=await load('src/dashboard/videoReviewHandlinger.js')
 const state={dirty:true,error:null,updates:0}
 const options={selectedAthlete:{id:'a'},videoAnalysisFeedbackDraft:draft,videoBaselines:[],setVideoAnalysisUpdatingId:noop,setVideoAnalysisReviewError:x=>state.error=x,setVideoAnalyses:()=>state.updates++,setVideoAnalysisReview:noop,setVideoAnalysisFeedbackDraft:noop,setVideoAnalysisBaselineFindingId:noop,setVideoAnalysisFeedbackDirty:x=>state.dirty=x,setVideoAnalysisCloseWarning:noop,showFlash:noop}
 return {handler:lavVideoReviewHandlinger(options).saveVideoAnalysisFeedback,state}
}
const analysis={id:'v',athlete_id:'a',status:'draft',client_analysis_id:'client',athlete_feedback:null}
test('actual video feedback handler confirms content and scoped conditional update',async()=>{
 for(const data of [null,{id:'v',athlete_id:'a',status:'draft',client_analysis_id:'client',athlete_feedback:{}}]) {
  const db=backend({data,error:null}),{handler,state}=await videoHandler(db)
  assert.notEqual(await handler(analysis,{confirmed:true}),true);assert.equal(state.dirty,true);assert.equal(state.updates,0)
 }
 const db=backend(p=>({data:{...analysis,...p},error:null})),{handler,state}=await videoHandler(db)
 assert.equal(await handler(analysis,{confirmed:true}),true);assert.equal(state.dirty,false)
 assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='athlete_id'&&c[2]==='a'))
 assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='status'&&c[2]==='draft'))
 assert.ok(db.calls.some(c=>c[0]==='is'&&c[1]==='athlete_feedback'))
 assert.ok(!Object.hasOwn(db.api.payload,'status'))
 const empty=backend({});const e=await videoHandler(empty,{focus:' ',works:'',next_set:''})
 await e.handler(analysis,{confirmed:true});assert.equal(empty.calls.length,0)
})
test('actual message DOM gates button, disables empty/busy, dispatches handler',async()=>{
 const load=await app({}),{default:View}=await load('src/dashboard/BeskederTab.jsx')
 let clicked=0
 const props={a:{id:'a'},coachMsgTrack:'besked',messages:[],messageInput:'hej',saveMessageAndNext:()=>clicked++}
 const button=t=>nodes(t).find(n=>n.type==='button'&&text(n)==='Gem og næste')
 assert.equal(button(View(props)),undefined)
 const b=button(View({...props,saveNextAvailable:true}));assert.ok(b);b.props.onClick();assert.equal(clicked,1)
 assert.equal(button(View({...props,messageInput:' ',saveNextAvailable:true})).props.disabled,true)
 assert.ok(nodes(View({...props,saveNextAvailable:true,saveNextDone:true})).some(n=>n.props.role==='status'))
})
test('actual video DOM gates button and passes action with synthetic data only',async()=>{
 const load=await app({}),{default:View}=await load('src/dashboard/VideoReviewModal.jsx')
 let clicked=0
 const props={selectedAthlete:{id:'a',name:'Test'},videoAnalysisReview:analysis,videoAnalysisFeedbackDraft:{works:'',focus:'cue',next_set:''},videoBaselines:[],videoAnalyses:[],saveVideoAndNext:()=>clicked++}
 const button=t=>nodes(t).find(n=>n.type==='button'&&text(n)==='Gem og næste')
 assert.equal(button(View(props)),undefined)
 const b=button(View({...props,saveNextAvailable:true}));assert.ok(b);b.props.onClick();assert.equal(clicked,1)
 assert.equal(button(View({...props,saveNextAvailable:true,videoAnalysisFeedbackDraft:{}})).props.disabled,true)
})

test('controller and actual persistence handler compose without fake success',async()=>{
 for (const ok of [false,true]) {
  const db=backend(p=>({data:ok?{id:'m',...p}:null,error:null}))
  const {handler,state}=await messageHandler(db)
  const f=flow({persist:()=>handler({confirmed:true})})
  assert.equal(await f.handler('message','hej'),ok)
  assert.equal(f.events.includes('video-z'),ok)
  assert.equal(state.input,ok?'':'hej')
 }
})
test('leaving and returning to the same item does not steal navigation',async()=>{
 let resolve;const f=flow({persist:()=>new Promise(r=>resolve=r)})
 f.scopeRef.current.visitId=1
 const pending=f.handler('message','hej')
 f.scopeRef.current={...f.scopeRef.current,visitId:3}
 resolve(true);await pending;assert.ok(!f.events.includes('video-z'))
})
