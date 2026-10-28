import test from 'node:test'
import assert from 'node:assert/strict'
import { install, modules, bridge, h, nodes, checkAthleteSyntax } from './selectionHarness.mjs'
const loader = install()
const { VIDEO_SET_SELECTION_ENABLED, videoSetOptions, videoOptionsForDay, resolveVideoSet, renderVideoSetPicker } = await import('./videoSetSelection.mjs')
const {hook, Ramme, coach} = await modules()
const session = {id:'session-a', exercises:[{id:'exercise-a',name:'Squat',sets:3,reps:'5',recommended_weight:80}]}
const options = videoSetOptions(session,[{id:'log-a',exercise_id:'exercise-a',set_number:2,weight:85,reps_completed:4}])
const choice = {key:options[1].key,loadKg:85,reps:4}
const selected = resolveVideoSet(options,choice)
const state = value => ({enabled:true,athleteId:'11111111-1111-4111-8111-111111111111',selected:value})

test('exact parent JSX parses without build or application effects', () => {
  assert.equal(typeof checkAthleteSyntax(),'function')
})

test('completed session remains selectable today without offering previous days', () => {
  const log={exercise_id:'exercise-a',set_number:3,logged_at:'2026-10-27T11:00:00Z'}
  const week={sessions:[session]}
  assert.equal(videoOptionsForDay({status:'done'},week,[log],'2026-10-27').length,3)
  assert.deepEqual(videoOptionsForDay({status:'done'},week,[log],'2026-10-28'),[])
  assert.equal(videoOptionsForDay({session},week,[log],'2026-10-27').length,3)
})

test('explicit default OFF and unchanged legacy upload', async () => {
  assert.equal(VIDEO_SET_SELECTION_ENABLED,false)
  for (const value of [undefined,{enabled:false,selected}]) {
    const f=await bridge(hook,value)
    try {await f.send(); assert.equal(f.uploads.length,1); assert.equal(f.rows.length,1)
      assert.equal(f.rows[0].session_context.video_set,undefined)
      assert.equal(f.rows[0].session_context.program_item_id,null)
    } finally {f.restore()}
  }
})
test('actual picker handlers require selection and valid kg/reps', () => {
  let value=null, continued=0, closed=0
  const render=()=>renderVideoSetPicker(h,{options,choice:value,onChange:x=>{value=x},onContinue:()=>continued++,onClose:()=>closed++})
  let ui=render(); assert.equal(nodes(ui,'button')[0].props.disabled,true)
  nodes(ui,'button')[0].props.onClick(); assert.equal(continued,0)
  nodes(ui,'select')[0].props.onChange({target:{value:options[1].key}})
  assert.deepEqual(value,choice)
  ui=render(); assert.equal(nodes(ui,'button')[0].props.disabled,false)
  nodes(ui,'input')[1].props.onChange({target:{value:'4-6'}})
  ui=render(); assert.equal(nodes(ui,'button')[0].props.disabled,true)
  nodes(ui,'input')[1].props.onChange({target:{value:'4'}})
  ui=render(); nodes(ui,'button')[0].props.onClick(); assert.equal(continued,1)
  nodes(ui,'button')[1].props.onClick(); assert.equal(closed,1)
})
test('actual Ramme gates iframe until valid selection, flag OFF keeps iframe', () => {
  const base={role:'athlete',athleteVideoCoachOpen:true,videoSetPicker:{options:[],choice:null,onClose(){}}}
  assert.equal(nodes(Ramme(base),'iframe').length,1)
  assert.equal(nodes(Ramme({...base,videoSetEnabled:true}),'iframe').length,0)
  assert.equal(nodes(Ramme({...base,videoSetEnabled:true,videoSetReady:true}),'iframe').length,1)
})
test('missing pas or selection sends neither video nor row through either handler', async () => {
  assert.deepEqual(videoSetOptions(null),[])
  for (const selected of [null,resolveVideoSet([],choice)]) {
    const f=await bridge(hook,state(selected))
    try {
      await f.send(); await f.send({...f.message,type:'test:vc:save-draft',row:{lift:'squat'}})
      assert.equal(f.uploads.length,0); assert.equal(f.rows.length,0)
      assert.ok(f.replies.every(reply=>reply.ok===false))
    } finally {f.restore()}
  }
})
test('upload binds selected set and coach queue shows exercise, kg and reps', async () => {
  const f=await bridge(hook,state(selected))
  try {
    await f.send({...f.message,loadKg:999,session_context:{video_set:{reps:19}}})
    assert.equal(f.uploads.length,1); const row=f.rows[0]
    assert.equal(row.load_kg,85); assert.equal(row.reps_count,undefined)
    assert.equal(row.schema_version,3); assert.equal(row.schema_v,3)
    assert.equal(row.session_context.training_session_id,'session-a')
    assert.equal(row.session_context.program_item_id,'exercise-a')
    assert.deepEqual(row.session_context.video_set,{set_id:'log-a',set_key:options[1].key,set_number:2,exercise_id:'exercise-a',exercise_name:'Squat',lift:'squat',load_kg:85,reps:4})
    assert.match(coach.coachVideoPriorityDetail(row),/Squat · sæt 2 · 85 kg · 4 gentagelser/)
  } finally {f.restore()}
})
test('tracked draft keeps measurement reps but binds selected training set', async () => {
  const f=await bridge(hook,state(selected))
  try {
    await f.send({...f.message,type:'test:vc:save-draft',row:{lift:'squat',reps_count:3,session_context:{}}})
    assert.equal(f.uploads.length,0); assert.equal(f.rows[0].reps_count,3)
    assert.equal(f.rows[0].session_context.video_set.reps,4)
  } finally {f.restore()}
})
test.after(()=>loader.deregister())
