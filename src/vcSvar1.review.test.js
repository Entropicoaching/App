import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './vcSvarLoader.mjs'
import { document, walk, setHost, setBackend } from './vcSvarDom.mjs'
import * as dom from './vcSvarDom.mjs'
install()
const {default: Coach} = await import('./VideoMarkerReplyReview.jsx')
const {lavBeskederOgVaegt} = await import('./beskederOgVaegt.jsx')
const {VideoFeedbackPlayback} = await import('./VideoFeedbackPlayback.jsx')
const {mountFeedbackPlayback} = await import('./videoFeedbackPlayback.mjs')
const {markerReplyContent, parseMarkerReply, mountMarkerReplyForm, createMarkerReplySender} = await import('./videoMarkerReplies.mjs')
const scope={athleteId:'test-athlete',analysisId:'test-analysis'}
const marker={id:'real-marker-id',start:2,end:4,text:'Testmarkering',strokes:[]}
const enabled=()=>{globalThis.localStorage={getItem:key=>['vc-svar1','vc-epik2-playback'].includes(key)?'1':null}}
function nodes(tree,pred) {return !tree || typeof tree!=='object'?[]:[...(pred(tree)?[tree]:[]),...(tree.props?.children||[]).flat(Infinity).flatMap(n=>nodes(n,pred))]}
test('fresh counter: actual athlete factory sends through existing messages insert, immutable analysis scope',async()=>{
 enabled();const writes=[]
 setBackend({from:table=>({insert:async payload=>{writes.push({table,payload});return {error:null}}})})
 const analysis={id:scope.analysisId,lift:'squat',analyzed_at:'2026-10-27',athlete_feedback:{}}
 const tree=lavBeskederOgVaegt({athlete:{id:scope.athleteId},sharedVideoAnalyses:[analysis],openSharedVideoId:analysis.id}).renderSharedFeedbackCards()
 const sender=nodes(tree,n=>n.type===VideoFeedbackPlayback)[0].props.sendReply
 assert.equal(writes.length,0);assert.equal(await sender(marker,'Spørgsmål'),true)
 assert.equal(writes[0].table,'messages');assert.deepEqual(parseMarkerReply(writes[0].payload),{...scope,markerId:marker.id,start:2,reply:'Spørgsmål'})
 setBackend(null)
})
test('fresh counter: actual coach effect queries scoped messages, no implicit read/send, failure retry and disposal',async()=>{
 enabled();const root=document.createElement('div'),calls=[];setHost(root)
 let fail=true
 setBackend({from:table=>{calls.push(['from',table]);const query={select:v=>{calls.push(['select',v]);return query},eq:(k,v)=>{calls.push([k,v]);return query},order:async()=>fail?{error:Error('fake read failure')}:{data:[]}};return query}})
 Coach(scope);const cleanup=dom.effect();assert.equal(calls.length,0)
 const refresh=walk(root,'button').find(n=>n.textContent==='Opdatér svar')
 await refresh.fire('click');assert.match(root.textContent,/Svar kunne ikke hentes/)
 assert.deepEqual(calls.slice(2),[['athlete_id',scope.athleteId],['sender_role','athlete'],['category','teknik']])
 fail=false;await refresh.fire('click');assert.match(root.textContent,/Svar hentet/)
 cleanup();await refresh.fire('click');assert.equal(root.children.length,0);setBackend(null)
})
test('fresh counter: pending form unmount keeps exact sent reference and never changes new form',async()=>{
 enabled();let finish;const sent=[],root=document.createElement('div')
 const sender=createMarkerReplySender({...scope,insert:payload=>{sent.push(payload);return new Promise(resolve=>{finish=resolve})}})
 const cleanup=mountMarkerReplyForm(root,scope,[marker],sender),input=walk(root,'textarea')[0]
 input.value='Første svar';const pending=walk(root,'button')[0].fire('click')
 cleanup();const cleanup2=mountMarkerReplyForm(root,{...scope,analysisId:'different'},[marker],async()=>true)
 const fresh=walk(root,'textarea')[0];fresh.value='Ny kladde';finish({error:null});await pending
 assert.equal(fresh.value,'Ny kladde');assert.equal(parseMarkerReply(sent[0]).analysisId,scope.analysisId);cleanup2()
})
test('fresh counter: replacement marker file clears drafts, invalid file never leaves reply controls',async()=>{
 enabled();const root=document.createElement('div'),cleanup=mountFeedbackPlayback(root,scope,{sendReply:async()=>true})
 const json=walk(root,'input')[0]
 const value={schema:'vc-epik2-playback/v1',status:'ready',...scope,clip:{name:'fake.webm',size:1,type:'video/webm',sha256:'a'.repeat(64),duration:5,width:10,height:10},markers:[marker]}
 const load=async x=>{const body=JSON.stringify(x);json.files=[{size:body.length,text:async()=>body}];await json.fire('change')}
 await load(value);walk(root,'textarea')[0].value='Kladde';await load({...value,analysisId:'wrong'})
 assert.equal(walk(root,'textarea').length,0);await load(value);assert.equal(walk(root,'textarea')[0].value,'');cleanup()
})
