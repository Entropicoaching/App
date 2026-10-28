import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './vcSvarLoader.mjs'
import { document, walk } from './vcSvarDom.mjs'
import * as dom from './vcSvarDom.mjs'
install()
const model = await import('./videoMarkerReplies.mjs')
const { mountFeedbackPlayback } = await import('./videoFeedbackPlayback.mjs')
const { lavBeskederOgVaegt } = await import('./beskederOgVaegt.jsx')
const { default: Inbox } = await import('./IndbakkeView.jsx')
const { default: Review } = await import('./VideoReviewModal.jsx')
const { default: CoachPlayback } = await import('./VideoMarkerReplyReview.jsx')
const { VideoFeedbackPlayback } = await import('./VideoFeedbackPlayback.jsx')
const scope={athleteId:'athlete-1',analysisId:'analysis-1'}
const markers=[{id:'same-time-A',start:1,end:4,text:'Knæ',strokes:[]},{id:'same-time-B',start:1,end:3,text:'Ryg',strokes:[]}]
const fixture=()=>({schema:'vc-epik2-playback/v1',status:'ready',...scope,clip:{name:'synthetic.webm',size:1,type:'video/webm',sha256:'a'.repeat(64),duration:5,width:640,height:360},markers})
const on=()=>{globalThis.localStorage={getItem:key=>key==='vc-svar1'?'1':null}}
function nodes(tree, pred) { return !tree || typeof tree !== 'object' ? [] : [...(pred(tree)?[tree]:[]),...(tree.props?.children||[]).flat(Infinity).flatMap(n=>nodes(n,pred))] }
function text(tree) { return tree==null || typeof tree==='boolean'?'':typeof tree!=='object'?String(tree):(tree.props?.children||[]).flat(Infinity).map(text).join('') }
const content=(marker=markers[1],reply='Hvad skal jeg ændre?')=>model.markerReplyContent(scope,marker,reply)
const message=(overrides={})=>({athlete_id:scope.athleteId,sender_role:'athlete',category:'teknik',content:content(),...overrides})
async function load(root) {const json=walk(root,'input')[0],data=JSON.stringify(fixture());json.files=[{size:data.length,text:async()=>data}];await json.fire('change')}
test('default OFF, exact flag and unavailable storage; no added DOM or transport',async()=>{
 delete globalThis.localStorage
 assert.equal(model.DEFAULT_MARKER_REPLIES,false)
 for(const v of [null,'true',true,1,'0']) assert.equal(model.markerRepliesEnabled({getItem:()=>v}),false)
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('denied')}})
 assert.equal(model.markerRepliesEnabled(),false);delete globalThis.localStorage
 let calls=0;const root=document.createElement('div')
 const cleanup=mountFeedbackPlayback(root,scope,{sendReply:()=>++calls,readReplies:()=>++calls})
 await load(root);assert.equal(walk(root,'textarea').length,0)
 assert.equal(await model.createMarkerReplySender({...scope,insert:()=>++calls})(markers[0],'tekst'),false)
 assert.equal(calls,0);cleanup()
})
test('real playback form selects real ID even at same timestamp; empty reply never sends; explicit click only',async()=>{
 on();const sent=[],root=document.createElement('div')
 const cleanup=mountFeedbackPlayback(root,scope,{sendReply:model.createMarkerReplySender({...scope,insert:async payload=>{sent.push(payload);return {error:null}}})})
 await load(root);const select=walk(root,'select').find(n=>n.attrs['aria-label']==='Vælg markering til dit svar'),input=walk(root,'textarea')[0]
 const send=walk(root,'button').find(b=>b.textContent==='Send svar til markering')
 await send.fire('click');assert.equal(sent.length,0);assert.match(root.textContent,/1 til 600/)
 input.value='   ';await send.fire('click');assert.equal(sent.length,0)
 input.value='Kladde A';select.value=markers[1].id;await select.fire('change')
 assert.equal(input.value,'');input.value='Hvad skal jeg ændre?'
 assert.equal(sent.length,0);await send.fire('click');assert.equal(sent.length,1)
 assert.deepEqual(model.parseMarkerReply(sent[0]),{...scope,markerId:markers[1].id,start:1,reply:'Hvad skal jeg ændre?'})
 assert.equal(input.value,'');select.value=markers[0].id;await select.fire('change');assert.equal(input.value,'Kladde A')
 cleanup();await send.fire('click');assert.equal(sent.length,1)
})
test('send failure preserves text; pending send locks duplicates and marker; retry works',async()=>{
 on();let finish,calls=0;const root=document.createElement('div')
 const sender=model.createMarkerReplySender({...scope,insert:()=>{calls++;return new Promise(r=>{finish=r})}})
 const cleanup=model.mountMarkerReplyForm(root,scope,markers,sender)
 const input=walk(root,'textarea')[0],select=walk(root,'select').find(n=>n.attrs['aria-label']==='Vælg markering til dit svar'),button=walk(root,'button')[0]
 input.value='Bevar min tekst';const pending=button.fire('click');await Promise.resolve()
 assert.equal(select.disabled,true);await button.fire('click');assert.equal(calls,1)
 finish({error:Error('fake')});await pending;assert.equal(input.value,'Bevar min tekst');assert.equal(button.disabled,false)
 const retry=button.fire('click');finish({error:null});await retry;assert.equal(input.value,'');cleanup()
})
test('coach active marker gets only exact athlete, analysis and marker responses; safe text rendering',async()=>{
 on();const root=document.createElement('div'),rows=[message(),message({athlete_id:'other'}),message({sender_role:'coach'}),message({content:'plain'}),message({content:model.markerReplyContent({...scope,analysisId:'other'},markers[1],'No')}),message({content:content(markers[0],'<img onerror=x>')})]
 const cleanup=mountFeedbackPlayback(root,scope,{digest:async()=> 'a'.repeat(64),urlApi:{createObjectURL:()=> 'blob:fake',revokeObjectURL(){}},readReplies:async()=>rows})
 await load(root);const file=walk(root,'input')[1];file.files=[{name:'synthetic.webm',size:1,type:'video/webm'}];await file.fire('change')
 const video=walk(root,'video')[0];Object.assign(video,{duration:5,videoWidth:640,videoHeight:360});await video.fire('loadedmetadata')
 assert.equal(root.textContent.includes('Atletens svar:'),false)
 await walk(root,'button').find(b=>b.textContent==='Opdatér svar').fire('click')
 video.currentTime=2;await video.fire('timeupdate')
 const replies=walk(root,'p').filter(p=>p.textContent.startsWith('Atletens svar:'))
 assert.deepEqual(replies.map(p=>p.dataset.markerId),[markers[0].id,markers[1].id])
 assert.equal(walk(root,'img').length,0);assert.ok(root.textContent.includes('<img onerror=x>'))
 video.currentTime=3.5;await video.fire('timeupdate');assert.equal(root.textContent.includes('Hvad skal'),false)
 cleanup()
})
test('real inbox shows readable reply preview and existing unread/open handlers',()=>{
 on();const calls=[],row=message({created_at:'2026-10-27T12:00:00Z'})
 const props={athletes:[{id:scope.athleteId,name:'Syntetisk atlet'}],hiddenAthleteIds:new Set(),coachPriorityItems:[],latestByTrack:{[scope.athleteId]:{teknik:row}},unreadByTrack:{[scope.athleteId]:{teknik:1}},openProfile:(...x)=>calls.push(x),setCoachMsgTrack:x=>calls.push(x)}
 const tree=Inbox(props);assert.match(text(tree),/Svar til videomarkering ved 1.00 s: Hvad skal/);assert.ok(!text(tree).includes('[VC-SVAR1:'))
 const button=nodes(tree,n=>n.type==='button'&&text(n).includes('Hvad skal'))[0];button.props.onClick();assert.equal(calls.length,2)
 delete globalThis.localStorage;assert.ok(text(Inbox(props)).includes(row.content))
})
test('actual athlete card wires scoped sender, actual review mounts scoped playback only ON',()=>{
 on();globalThis.localStorage={getItem:key=>['vc-svar1','vc-epik2-playback'].includes(key)?'1':null}
 const analysis={id:scope.analysisId,lift:'squat',analyzed_at:'2026-10-27',athlete_feedback:{},status:'shared'}
 const tree=lavBeskederOgVaegt({athlete:{id:scope.athleteId},sharedVideoAnalyses:[analysis],openSharedVideoId:analysis.id}).renderSharedFeedbackCards()
 const player=nodes(tree,n=>n.type===VideoFeedbackPlayback)[0];assert.equal(typeof player.props.sendReply,'function');assert.equal(player.props.analysisId,analysis.id)
 const props={videoAnalysisReview:analysis,selectedAthlete:{id:scope.athleteId},videoAnalysisFeedbackDraft:{},videoBaselines:[],videoAnalyses:[]}
 const review=Review(props);const widget=nodes(review,n=>n.type===CoachPlayback)[0];assert.equal(widget.props.athleteId,scope.athleteId);assert.equal(widget.props.analysisId,scope.analysisId)
 delete globalThis.localStorage;assert.equal(nodes(Review(props),n=>n.type===CoachPlayback).length,0)
})
test('adversarial malformed messages, length, wrong scope and flag revoked',async()=>{
 on();for(const value of ['', ' '.repeat(10),'x'.repeat(601)])assert.throws(()=>content(markers[0],value))
 assert.throws(()=>model.markerReplyContent({...scope,analysisId:'../x'},markers[0],'x'))
 for(const m of [message({category:'besked'}),message({content:'[VC-SVAR1:{}]'}),message({content:content()+']'}),message({content:content().replace('1.00 s','2.00 s')})])assert.equal(model.parseMarkerReply(m),null)
 assert.equal(model.repliesForMarker([message()],{...scope,athleteId:'other'},markers[1].id).length,0)
 const send=model.createMarkerReplySender({...scope,insert:()=>{throw Error('Must not call')}});delete globalThis.localStorage;assert.equal(await send(markers[0],'x'),false)
})

test('real athlete and coach message threads show replies without transport metadata', async()=>{
 on();const {default: AthleteThread}=await import('./AthleteBeskederTab.jsx')
 const {default: CoachThread}=await import('./CoachBeskederTab.jsx')
 const row=message({created_at:'2026-10-27T12:00:00Z'})
 const athleteProps={messages:[row],msgTrack:'teknik',sharedVideoAnalyses:[],formatMsgTime:()=>'',renderSharedFeedbackCards:()=>null}
 const coachProps={a:{name:'Syntetisk atlet'},messages:[row],coachMsgTrack:'teknik',formatMsgTime:()=>''}
 for(const tree of [AthleteThread(athleteProps),CoachThread(coachProps)]) {
   assert.match(text(tree),/Svar til videomarkering ved 1.00 s: Hvad skal/)
   assert.equal(text(tree).includes('[VC-SVAR1:'),false)
 }
 delete globalThis.localStorage
 for(const tree of [AthleteThread(athleteProps),CoachThread(coachProps)]) assert.ok(text(tree).includes(row.content))
})
