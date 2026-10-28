import test from 'node:test'
import assert from 'node:assert/strict'
import { install, modules, bridge, h, nodes } from './selectionHarness.mjs'
const loader=install()
const { videoSetOptions, resolveVideoSet, renderVideoSetPicker, bindVideoSet } = await import('./videoSetSelection.mjs')
const {hook,coach}=await modules()
const athleteId='11111111-1111-4111-8111-111111111111'
const options=videoSetOptions({id:'s',exercises:[{id:'e',name:'Bænkpres',sets:2,reps:'4-6'}]})
const choice={key:options[0].key,loadKg:'0',reps:'6'}
const selected=resolveVideoSet(options,choice)

test('counter: removed sets, skipped sets, unknown lifts and invalid numbers fail closed',()=>{
  assert.equal(resolveVideoSet([],choice),null)
  for (const reps of ['',null,0,21,1.1,'4-6','Infinity',{},true])
    assert.equal(resolveVideoSet(options,{...choice,reps}),null)
  for (const loadKg of ['',null,-1,1001,'NaN',{},true])
    assert.equal(resolveVideoSet(options,{...choice,loadKg}),null)
  assert.equal(selected.load_kg,0)
  assert.deepEqual(videoSetOptions({id:'s',exercises:[{id:'e',name:'Rows',sets:2}]}),[])
  assert.equal(videoSetOptions({id:'s',exercises:[{id:'e',name:'Squat',sets:2}]},
    [{exercise_id:'e',set_number:1,skipped:true}]).length,1)
  const ui=renderVideoSetPicker(h,{options:[],choice,onChange(){},onClose(){}})
  assert.equal(nodes(ui,'button')[0].props.disabled,true)
})
test('counter: changed lift and athlete cannot upload or save',async()=>{
  for (const state of [{enabled:true,athleteId,selected}, {enabled:true,athleteId:'another',selected}]) {
    const f=await bridge(hook,state)
    try {
      await f.send(); await f.send({...f.message,type:'test:vc:save-draft',row:{lift:'squat'}})
      assert.equal(f.rows.length,0); assert.equal(f.uploads.length,0)
    } finally {f.restore()}
  }
})
test('counter: handler reads latest ref after picker closes or program changes',async()=>{
  const f=await bridge(hook,{enabled:true,athleteId,selected})
  try {
    f.ref.current={enabled:true,athleteId,selected:null}
    await f.send({...f.message,lift:'bench'})
    assert.equal(f.uploads.length,0); assert.equal(f.rows.length,0)
  } finally {f.restore()}
})
test('counter: foreign origin and unregistered source cannot upload',async()=>{
  const f=await bridge(hook,{enabled:true,athleteId,selected})
  try {
    await f.send({...f.message,lift:'bench'},'https://foreign.invalid')
    await f.send({...f.message,lift:'bench'},'https://synthetic.invalid',{postMessage(){}})
    assert.equal(f.uploads.length,0); assert.equal(f.rows.length,0)
  } finally {f.restore()}
})
test('counter: in-flight upload keeps the chosen set snapshot',async()=>{
  const f=await bridge(hook,{enabled:true,athleteId,selected})
  try {
    let release
    f.upload=()=>new Promise(resolve=>{release=resolve})
    const pending=f.send({...f.message,lift:'bench'})
    f.ref.current={enabled:true,athleteId,selected:null}
    release({}); await pending
    assert.equal(f.rows[0].session_context.video_set.set_key,choice.key)
    assert.equal(f.rows[0].session_context.video_set.reps,6)
    assert.equal(f.rows[0].load_kg,0)
  } finally {f.restore()}
})
test('counter: legacy queue text and tracking evidence remain unchanged without binding',()=>{
  assert.equal(coach.coachVideoPriorityDetail({lift:'bench',variation:'competition',source_mode:'athlete_submission'}),
    'Ny måling fra et sæt · Bænkpres · Competition')
  const row={session_context:{athlete_note:'synthetic note',plate_calibration:'plate:auto:ring'},reps_count:2,rep_details:[{},{}]}
  bindVideoSet(row,selected)
  assert.equal(row.session_context.athlete_note,'synthetic note')
  assert.equal(row.session_context.plate_calibration,'plate:auto:ring')
  assert.equal(row.reps_count,2); assert.equal(row.rep_details.length,2)
})
test.after(()=>loader.deregister())
