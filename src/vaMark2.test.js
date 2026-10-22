import test from 'node:test';
import assert from 'node:assert/strict';
import {angleDeg,angles,fixturesForTest} from './vaMark2TestHelpers.mjs';
import * as M from './vaMark2.mjs';
import {fixtures} from './vaMark2Fixtures.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const complete=f=>{
  let s=M.createSession(f);
  f.frames.forEach((q,i)=>M.JOINTS.forEach(k=>{s=M.mark(f,s,i,k,q.truth[k]);}));
  const q=f.frames[0];s=M.calibrate(f,s,q.frame_id,[{x:q.disc.x-45,y:q.disc.y},{x:q.disc.x+45,y:q.disc.y}]);
  return M.lock(f,s);
};
test('known 0, 90, 180 degrees and atan branch crossing',()=>{
  near(angleDeg({x:1,y:0},{x:0,y:0},{x:2,y:0}),0);
  near(angleDeg({x:1,y:0},{x:0,y:0},{x:0,y:1}),90);
  near(angleDeg({x:1,y:0},{x:0,y:0},{x:-1,y:0}),180);
  const r=d=>({x:Math.cos(d*Math.PI/180),y:Math.sin(d*Math.PI/180)});
  near(angleDeg(r(179),{x:0,y:0},r(-179)),2);
});
test('four definitions are interior projected joint angles',()=>{
  const p={shoulder:{x:0,y:0},hip:{x:0,y:10},knee:{x:10,y:10},ankle:{x:10,y:20},toe:{x:20,y:20},elbow:{x:10,y:0}};
  assert.deepEqual(angles(p),{hip:90,knee:90,ankle:90,shoulder:90});
});
test('dimensionless under uniform scale, translation, mirror and rotation',()=>{
  const p=fixtures()[0].frames[0].truth, expected=angles(p);
  for(const scale of [0.01,0.5,3,10000])for(const mirror of [-1,1]) {
    const t=Object.fromEntries(Object.entries(p).map(([k,v])=>[k,{x:scale*(-v.y)+100,y:scale*v.x*mirror-200}]));
    for(const k of Object.keys(expected)) near(angles(t)[k],expected[k]);
  }
});
test('degenerate, missing, nonfinite and subpixel floor rejected',()=>{
  for(const c of [null,{x:NaN,y:0},{x:Infinity,y:0},{x:0,y:0},{x:1e-10,y:0}])
    assert.throws(()=>angleDeg({x:1,y:0},{x:0,y:0},c));
  near(angleDeg({x:1e-9,y:0},{x:0,y:0},{x:0,y:1e-9}),90);
});
test('synthetic known noise, error sign, RMSE and fail without dilution',()=>{
  const f=fixtures()[0];const s=complete(f),r=M.compare(f,s);
  assert.equal(r.status,'PASS');assert.equal(r.residuals.length,16);assert.equal(r.physical_vc_pass,false);
  for(const row of r.residuals) near(row.error_deg,row.model_deg-row.manual_deg);
  near(r.metrics.rmse_deg,Math.sqrt(r.residuals.reduce((a,r)=>a+r.error_deg**2,0)/16));
  const bad=fixtures()[2];assert.equal(M.compare(bad,complete(bad)).status,'FAIL');
});
test('inclusive 5 degree gate and immediately above, analytical shoulder rotation',()=>{
  for(const d of [4.999,5,5.001]) {
    const f=fixturesForTest(d),r=M.compare(f,complete(f));
    near(r.metrics.max_abs_deg,d);
    assert.equal(r.status,d<=5?'PASS':'FAIL');
  }
});
test('every missing or degenerate model joint blocks PASS; manual too',()=>{
  for(const k of M.JOINTS){
    const f=fixtures()[0];f.frames[0].model[k]=null;
    assert.equal(M.compare(f,complete(f)).status,'INCOMPLETE');
    const g=fixtures()[0];const s=complete(g);s.marks[0].pose[k]=null;
    assert.equal(M.compare(g,s).status,'INCOMPLETE');
  }
  const f=fixtures()[0];f.frames[0].model.knee=clone(f.frames[0].model.hip);
  assert.equal(M.compare(f,complete(f)).reason,'degenerate_vector');
});
test('three unique recomputed trials, invalid takes precedence over FAIL',()=>{
  const fs=fixtures();const ts=fs.map(f=>({fixture:f,session:complete(f)}));
  assert.equal(M.aggregate(ts).status,'FAIL');
  for(const n of [0,1,2,4])assert.equal(M.aggregate(Array(n).fill(ts[0])).status,'INCOMPLETE');
  assert.equal(M.aggregate([ts[0],ts[0],ts[2]]).reason,'duplicate_clip');
  ts[0].session.locked=false;assert.equal(M.aggregate(ts).status,'INCOMPLETE');
  assert.equal(M.aggregate([{status:'PASS'},{status:'PASS'},{status:'PASS'}]).status,'INCOMPLETE');
  const good=fs.map((f,i)=>{f=clone(f);f.clip_id='unique'+i;f.frames.forEach(q=>q.model=clone(q.truth));return{fixture:f,session:complete(f)};});
  assert.equal(M.aggregate(good).status,'PASS');assert.equal(M.aggregate(good).physical_vc_pass,false);
});
test('calibration geometry preserves 3px and 5percent boundaries and rejects free scale',()=>{
  const f=fixtures()[0],s=M.createSession(f),cx=120,cy=260;
  for(const [dx,diam,ok] of [[3,90,true],[3.000001,90,false],[0,94.5,true],[0,94.500001,false],[0,85.5,true],[0,85.499999,false],[0,0,false]]) {
    const run=()=>M.calibrate(f,s,0,[{x:cx+dx-diam/2,y:cy},{x:cx+dx+diam/2,y:cy}]);
    if(ok)assert.equal(run().calibration.disc_px,diam);else assert.throws(run);
  }
  const a=complete(f);a.calibration={disc_cm:45,disc_px:90,unit:'cm_per_px',frame_id:0};
  assert.equal(M.compare(f,a).status,'INCOMPLETE');
  const b=complete(f);b.calibration.disc_cm=44;assert.equal(M.compare(f,b).status,'INCOMPLETE');
  assert.equal(M.compare(f,M.clearCalibration(f,complete(f))).status,'INCOMPLETE');
});
test('edits unlock; all basis components and frame alignment bind saved measurements',()=>{
  const f=fixtures()[0],s=complete(f);
  assert.equal(M.mark(f,s,0,'hip',{x:245,y:170}).locked,false);
  for(const edit of [g=>g.setup_id+='x',g=>g.revision+='x',g=>g.clip_id+='x',g=>g.frames[1].t_s+=0.01,g=>g.frames[0].model.hip.x++]){
    const g=clone(f);edit(g);assert.equal(M.compare(g,s).status,'INCOMPLETE');
  }
  const a=clone(s);a.marks[0].t_s=1;assert.equal(M.compare(f,a).reason,'frame_time_alignment');
});
test('storage fake roundtrip, tamper, changed basis, quota and malformed data',()=>{
  const f=fixtures()[0],s=complete(f),map=new Map();
  const store={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)??null};
  assert.equal(M.save(store,f,s).ok,true);assert.deepEqual(M.restore(store,f).session,s);
  const key='VA-MARK2:'+f.clip_id;const raw=map.get(key);map.set(key,raw.replace('"locked":true','"locked":false'));
  assert.equal(M.restore(store,f).reason,'storage_integrity');map.set(key,raw);
  const g=clone(f);g.revision+='changed';assert.equal(M.restore(store,g).reason,'basis_mismatch');
  for(const raw of ['bad','null','x'.repeat(500001)]){map.set(key,raw);assert.equal(M.restore(store,f).ok,false);}
  assert.equal(M.save({setItem(){throw Error('quota');}},f,s).reason,'quota');
  assert.equal(M.restore({getItem(){throw Error('denied');}},f).reason,'denied');
});
test('letterboxing and proportional resize preserve source pixels',()=>{
  const image={width:640,height:360};
  assert.deepEqual(M.pointerPoint({left:10,top:20,width:320,height:300},image,170,170),{x:320,y:180});
  assert.equal(M.pointerPoint({left:10,top:20,width:320,height:300},image,170,21),null);
  assert.deepEqual(M.pointerPoint({left:0,top:0,width:1280,height:720},image,640,360),{x:320,y:180});
});
