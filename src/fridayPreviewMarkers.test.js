import test from 'node:test'
import assert from 'node:assert/strict'
import { mountPreviewMarkers, previewMarkerDocument } from './fridayPreviewMarkers.mjs'
import { parsePlaybackDocument, DEFAULT_VIDEO_FEEDBACK_PLAYBACK } from './athlete/videoFeedbackPlayback.mjs'
import { ATHLETE, PREVIEW_ANALYSIS, buildPreviewSeed } from './fridayPreviewSeed.mjs'
import { createPreviewDatabase } from './fridayPreviewAdapter.mjs'
import { previewConfig, main } from '../scripts/friday-preview.mjs'
import { memoryStorage, storageFlags, screens, previewUrl } from './fridayPreview.mjs'
import { document, walk } from './athlete/epikDom.mjs'
const scope = {athleteId:ATHLETE,analysisId:PREVIEW_ANALYSIS}
const nodes = tree => tree && typeof tree === 'object' ? [tree,...(tree.children||[]).flatMap(nodes)] : []
function mount(props=scope) {
  const root=document.createElement('section')
  const dispose=mountPreviewMarkers(root,props,{enabled:true})
  return {root,dispose,buttons:walk(root,'button'),slider:walk(root,'input')[0]}
}
test('VC-EPIK2 metadata, comments and normalized strokes validate without media', () => {
  const d=previewMarkerDocument(), parsed=parsePlaybackDocument(d,scope)
  assert.equal(parsed.clip.duration,8); assert.equal(parsed.markers.length,2)
  d.markers[0].strokes[0].points[0][0]=0
  assert.equal(previewMarkerDocument().markers[0].strokes[0].points[0][0],0.3)
  assert.equal(DEFAULT_VIDEO_FEEDBACK_PLAYBACK,false)
})
test('DOM: marker buttons, previous/next, half-open intervals and cleanup',async () => {
  const {root,dispose,buttons,slider}=mount()
  assert.equal(walk(root,'details').length,1); assert.equal(walk(root,'video').length,0)
  assert.match(root.textContent,/Ingen video/)
  assert.equal(buttons[0].disabled,true); assert.equal(walk(root,'polyline').length,1)
  await buttons[1].fire('click')
  assert.equal(slider.value,'4'); assert.match(root.textContent,/4.0 s \/ 8 s/)
  assert.equal(buttons[3].attrs['aria-pressed'],'true')
  assert.deepEqual(walk(root,'polyline')[0].attrs.points.split(' ').map(p=>p.split(',').map(Number)),[[160,0.7*360],[480,0.7*360]])
  slider.value='6';await slider.fire('input');assert.equal(walk(root,'polyline').length,0)
  assert.ok(buttons.slice(2).every(b=>b.attrs['aria-pressed']==='false'))
  await buttons[2].fire('click');assert.equal(slider.value,'1')
  await buttons[0].fire('click');assert.equal(slider.value,'1')
  slider.value='9';await slider.fire('input');assert.match(root.textContent,/1.0 s/)
  dispose();assert.equal(root.children.length,0)
  await buttons[3].fire('click');assert.equal(root.children.length,0)
  assert.ok(buttons.every(b=>[...b.listeners.values()].every(s=>s.size===0)))
})
test('modproeve: default OFF, strict boolean, wrong athlete and wrong analysis stay empty', () => {
  for(const enabled of [undefined,false,'true',1]) {
    const root=document.createElement('section');mountPreviewMarkers(root,scope,{enabled});assert.equal(root.children.length,0)
  }
  for(const wrong of [{...scope,athleteId:'other'},{...scope,analysisId:'other'},null]) assert.equal(mount(wrong).root.children.length,0)
})
test('adapter: same synthetic identity is readable from draft queue and shared RPC; writes denied',async () => {
  const db=createPreviewDatabase(buildPreviewSeed(new Date(2026,9,30,12)))
  const coach=(await db.from('video_analyses').select().eq('status','draft')).data
  const athlete=(await db.rpc('get_my_shared_video_analyses_v3',{p_limit:6,p_offset:0})).data
  assert.equal(coach.length,1);assert.equal(athlete.length,1)
  assert.equal(coach[0].id,athlete[0].id);assert.equal(athlete[0].athlete_id,ATHLETE)
  assert.equal(athlete[0].status,'shared');assert.equal(coach[0].video_path,null)
  athlete[0].session_context.preview_markers=false
  assert.equal((await db.rpc('get_my_shared_video_analyses_v3')).data[0].session_context.preview_markers,true)
  assert.equal((await db.from('video_analyses').update({status:'shared'})).error.code,'PREVIEW_ONLY')
  assert.equal((await db.from('video_analyses').select().single()).data.status,'draft')
  const wrong=buildPreviewSeed();wrong.video_analyses[0].athlete_id='other'
  assert.deepEqual((await createPreviewDatabase(wrong).rpc('get_my_shared_video_analyses_v3')).data,[])
})
test('new screen is local and inert CLI does not load a builder',async () => {
  const screen=screens.find(s=>s.id==='videocoach-tidsmarkeringer')
  assert.equal(screen.role,'athlete');assert.match(screen.steps,/Teknik/)
  assert.equal(new URL(previewUrl(screen.id)).searchParams.get('appE2E2'),'1')
  assert.match(await main([],()=>{throw Error('No build')}),/^OFF:/)
})
