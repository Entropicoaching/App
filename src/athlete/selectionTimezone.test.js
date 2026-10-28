import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

// Each subprocess imports the actual delivered model and pinned date modules.
// A literal environment supplies only the synthetic timezone; no host env is read.
const scenario = `
import assert from 'node:assert/strict';
import {install} from './selectionHarness.mjs';
const loader=install();
const {videoOptionsForDay}=await import('./videoSetSelection.mjs');
const session={id:'done',exercises:[{id:'sq',name:'Squat',sets:2,reps:5,recommended_weight:80}]};
const week={sessions:[session]};
for (const [stamp,day] of [
 ['2026-10-26T23:30:00Z','2026-10-27'],
 ['2026-07-26T22:30:00Z','2026-07-27'],
 ['2026-10-27T23:30:00Z','2026-10-28'],
 ['2026-03-28T23:30:00Z','2026-03-29'],
 ['2026-10-25T00:30:00Z','2026-10-25'],
 ['2026-10-25T01:30:00Z','2026-10-25']]) {
 const logs=[{exercise_id:'sq',set_number:2,logged_at:stamp,weight:80,reps_completed:5}];
 assert.equal(videoOptionsForDay({status:'done'},week,logs,day).length,2,stamp);
 const other=day==='2026-10-27'?'2026-10-26':'2026-10-27';
 assert.equal(videoOptionsForDay({status:'done'},week,logs,other).length,0,stamp+' wrong day');
}
for (const logged_at of ['invalid',null,'2026-02-30T23:30:00Z']) {
 assert.deepEqual(videoOptionsForDay(null,week,[{exercise_id:'sq',logged_at}],'2026-10-27'),[]);
}
assert.deepEqual(videoOptionsForDay(null,week,[{exercise_id:'sq',logged_at:'2026-10-26T23:30:00Z',skipped:true}],'2026-10-27'),[]);
assert.deepEqual(videoOptionsForDay(null,week,[{exercise_id:'foreign',logged_at:'2026-10-26T23:30:00Z'}],'2026-10-27'),[]);
assert.equal(videoOptionsForDay({session},week,[{exercise_id:'sq',logged_at:'2026-10-26T23:30:00Z'}],'2026-10-27').length,2);
loader.deregister();
`
for (const tz of ['UTC','America/Los_Angeles','Europe/Copenhagen','Asia/Tokyo']) {
 test('K1: completed sets follow Danish day in '+tz,()=>{
   execFileSync(process.execPath,['--input-type=module','--eval',scenario],
     {cwd:new URL('.',import.meta.url),env:{TZ:tz},stdio:'pipe'});
 })
}
