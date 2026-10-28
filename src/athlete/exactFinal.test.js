import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {install} from './selectionHarness.mjs'
const loader=install()
const {videoOptionsForDay,videoSetQueueDetail}=await import('./videoSetSelection.mjs')
test('own counter: Danish tomorrow must not leak into completed today',()=>{
 const session={id:'s',exercises:[{id:'e',name:'Squat',sets:1,reps:5}]}
 const logs=[{exercise_id:'e',logged_at:'2026-07-27T22:30:00Z'}]
 assert.deepEqual(videoOptionsForDay(null,{sessions:[session]},logs,'2026-07-27'),[])
 assert.equal(videoOptionsForDay(null,{sessions:[session]},logs,'2026-07-28').length,1)
})
test('own counter: invalid calendar dates cannot create options',()=>{
 const session={id:'s',exercises:[{id:'e',name:'Squat',sets:1}]}
 assert.deepEqual(videoOptionsForDay(null,{sessions:[session]},[{exercise_id:'e',logged_at:'2026-02-30T12:00:00Z'}],'2026-03-02'),[])
})
test('own counter: malformed queue metadata has no selected-set label',()=>{
 for (const load_kg of [null,'',true,-1,'Infinity']) {
  assert.equal(videoSetQueueDetail({session_context:{video_set:{exercise_name:'Squat',set_number:1,load_kg,reps:5}}}),null)
 }
})
test('own counter: closed loader rejects an unlisted module before resolution',()=>{
 const require=createRequire(new URL('./useVideoCoachBro.js',import.meta.url))
 assert.throws(()=>require('./unexpected.mjs'), /Unlisted synthetic dependency/)
})
test.after(()=>loader.deregister())
