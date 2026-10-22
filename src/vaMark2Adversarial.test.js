import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from './vaMark2.mjs';
import {fixturesForTest} from './vaMark2TestHelpers.mjs';
function complete(f){let s=M.createSession(f);f.frames.forEach((q,i)=>M.JOINTS.forEach(k=>{s=M.mark(f,s,i,k,q.truth[k]);}));return M.lock(f,M.calibrate(f,s,0,[{x:75,y:260},{x:165,y:260}]));}
const clone=x=>structuredClone(x);
test('adversarial invalid source identity, frames, coordinates and vectors are never PASS',()=>{
  for(const edit of [f=>f.status='real',f=>f.side='right',f=>f.axis='normalized',f=>f.clip_id=' x ',
    f=>f.frames[1].frame_id=0,f=>f.frames[1].t_s=0,f=>f.frames[0].model.hip.x=NaN,
    f=>delete f.frames[0].model.hip,f=>f.frames[0].model.hip.y=-1]) {
    const f=fixturesForTest(0),s=complete(f);edit(f);assert.equal(M.compare(f,s).status,'INCOMPLETE');
  }
  const f=fixturesForTest(0),s=complete(f);s.marks[0].pose.knee=clone(s.marks[0].pose.hip);
  assert.equal(M.compare(f,s).reason,'degenerate_vector');
  assert.throws(()=>M.lock(f,s));
});
test('single over-limit sample fails max gate even when RMSE is under 5 degrees',()=>{
  const f=fixturesForTest(0),noisy=fixturesForTest(8);f.frames[2].model=noisy.frames[2].model;
  const r=M.compare(f,complete(f));assert.equal(r.status,'FAIL');assert.ok(r.metrics.rmse_deg<5);
});
test('incomplete sampling, forged calibration and post-save model drift rejected',()=>{
  const f=fixturesForTest(0),s=complete(f);
  for(const edit of [s=>s.marks.pop(),s=>s.calibration.disc_px=89,s=>s.calibration.frame_id=999,
    s=>s.calibration.endpoints[0].x=-1,s=>s.calibration=null]){
    const t=clone(s);edit(t);assert.equal(M.compare(f,t).status,'INCOMPLETE');
  }
  const t=clone(s);t.marks[0].pose.elbow.x=Infinity;assert.equal(M.compare(f,t).status,'INCOMPLETE');
  assert.throws(()=>M.mark(f,s,NaN,'hip',null));
  assert.throws(()=>M.mark(f,s,0,'unknown',null));
});
test('uniformly rescaled whole fixture preserves angles and marked diameter scale changes only lengths',()=>{
  const f=fixturesForTest(4),s=complete(f),expected=M.compare(f,s),g=clone(f);
  g.image={width:1280,height:720};g.clip_id+='scaled';
  g.frames.forEach(q=>{q.disc_px*=2;for(const o of [q.disc,...Object.values(q.truth),...Object.values(q.model)]){o.x*=2;o.y*=2;}});
  let t=M.createSession(g);g.frames.forEach((q,i)=>M.JOINTS.forEach(k=>{t=M.mark(g,t,i,k,q.truth[k]);}));
  t=M.lock(g,M.calibrate(g,t,0,[{x:150,y:520},{x:330,y:520}]));
  const actual=M.compare(g,t);assert.equal(actual.status,expected.status);
  assert.equal(actual.metrics.max_abs_deg,expected.metrics.max_abs_deg);assert.equal(actual.cm_per_px,expected.cm_per_px/2);
});
