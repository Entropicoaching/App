// Synthetic R2 regression tests using only the delivered VA module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from './vaMark1.mjs';
const { createSession, clearCalibration, calibrate, mark, pointerPoint } = core;
const ready = Promise.resolve(core);
function sceneAdapter(fixture, scene, scaleInfo) {
  let session = createSession(fixture), diameter = null;
  const f = () => fixture, s = () => session, frame = 0;
  const sessions = [];
  Object.defineProperty(sessions, 0, { get: () => session, set: v => { session = v; } });
  const clip = 0, el = () => scene, pending = () => { diameter = null; };
  let error = null;
  const handler = e => {
    try {
      const p = pointerPoint(el('scene').getBoundingClientRect(), f().image, e.clientX, e.clientY);
      if (!p) throw Error('outside_image');
      if (diameter) {
        diameter.push(p);
        if (diameter.length === 2) {
          const endpoints = diameter; pending();
          sessions[clip] = calibrate(f(), s(), f().frames[frame].frame_id, endpoints);
        }
      } else sessions[clip] = mark(f(), s(), frame, p);
      error = null;
      scaleInfo.textContent = session.calibration ? '45 cm / ' + session.calibration.disc_px + ' px fra markeret diameter' : 'Ingen markeret diameter';
    } catch (e) { error = e.message; }
  };
  scene.addEventListener('click', handler);
  return {
    start() { session = clearCalibration(fixture, session); diameter = []; scaleInfo.textContent = 'Ingen markeret diameter'; },
    state: () => ({ session, error })
  };
}
const clone = x => JSON.parse(JSON.stringify(x));
function fixture(id='a') {
  return {schema:'va-mark1-synthetic/v2',status:'synthetic_only',clip_id:id,setup_id:'own-fixed',revision:'r2-test',
    image:{width:640,height:360},axis:'px_x_right_y_down',time_unit:'s',clock:'actual_timestamps',
    frames:[0,.2,.55,1.1].map((t_s,i) => ({frame_id:i*7,t_s,disc:{x:240+10*i,y:260-80*t_s},disc_px:90,
      automatic:{x:240+10*i+.2,y:260-80*t_s+.2}}))};
}
function ends(center=0, delta=0) {return [{x:240+center-(90+delta)/2,y:260},{x:240+center+(90+delta)/2,y:260}];}
function done(a,f,e=ends()) {
  let s=a.calibrate(f,a.createSession(f),0,e);
  f.frames.forEach((q,i) => {s=a.mark(f,s,i,q.disc);});
  return a.lock(f,s);
}
test('center tolerance: just inside, on and outside 3 source pixels in both directions', async()=>{
  const a=await ready,f=fixture();
  for(const x of [-3,-2.999999,0,2.999999,3]) assert.ok(a.calibrate(f,a.createSession(f),0,ends(x)).calibration);
  for(const x of [-3.000001,3.000001]) assert.throws(()=>a.calibrate(f,a.createSession(f),0,ends(x)),/calibration_mismatch/);
  const radial=ends().map(p=>({x:p.x+2.2,y:p.y+2.2}));
  assert.throws(()=>a.calibrate(f,a.createSession(f),0,radial));
  for(const y of [-3,3]) assert.ok(a.calibrate(f,a.createSession(f),0,ends().map(p=>({...p,y:p.y+y}))));
});
test('diameter tolerance: both 5 percent edges inside, on, outside; combined limits and swapped endpoints',async()=>{
  const a=await ready,f=fixture();
  for(const c of [-3,0,3]) {
    for(const d of [-4.5,-4.499999,0,4.499999,4.5]) {
      const e=ends(c,d); assert.ok(a.calibrate(f,a.createSession(f),0,e));
      assert.ok(a.calibrate(f,a.createSession(f),0,e.reverse()));
    }
    for(const d of [-4.500001,4.500001]) assert.throws(()=>a.calibrate(f,a.createSession(f),0,ends(c,d)));
  }
});
test('realistic screen rounding and endpoint noise across fractional widths and letterboxing',async()=>{
  const a=await ready,f=fixture();
  for(const width of [491,713,877,919]) for(const extra of [0,71]) {
    const rect={left:13.3,top:7.9,width,height:width*360/640+extra},s=width/640;
    const e=ends().map((p,i)=>a.pointerPoint(rect,f.image,Math.round(rect.left+p.x*s)+(i?1:-1),Math.round(rect.top+extra/2+p.y*s)));
    const result=a.compare(f,done(a,f,e));
    assert.equal(result.status,'PASS'); assert.equal(result.physical_vc_pass,false);
    assert.equal(result.cm_per_px,45/Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y));
  }
});
test('small scene DOM fake: 877px rounded clicks now set scale; retry and outside rejection',async()=>{
  const a=await ready,f=fixture();
  const events={},rect={left:13.3,top:7.9,width:877,height:493.3125},info={textContent:''};
  const scene={addEventListener:(k,v)=>events[k]=v,getBoundingClientRect:()=>rect};
  const ui=sceneAdapter(f,scene,info),s=877/640;
  const click=p=>events.click({clientX:Math.round(rect.left+p.x*s),clientY:Math.round(rect.top+p.y*s)});
  ui.start(); ends().forEach(click);
  assert.equal(ui.state().error,null); assert.match(info.textContent,/45 cm/);
  assert.ok(ui.state().session.calibration);
  ui.start(); assert.equal(ui.state().session.calibration,null);
  ends(4).forEach(click); assert.equal(ui.state().error,'calibration_mismatch');
  assert.equal(ui.state().session.calibration,null);
  ui.start(); ends().forEach(click); assert.equal(ui.state().error,null);
  assert.equal(a.pointerPoint({...rect,height:600},f.image,rect.left,rect.top),null);
});
test('no free scale or storage bypass, including recomputed integrity and recomputed endpoint length',async()=>{
  const a=await ready,f=fixture(),s=done(a,f),mem=new Map();
  const st={setItem:(k,v)=>mem.set(k,v),getItem:k=>mem.get(k)??null},key='VA-MARK1:a';
  for(const e of [1,45,.001,[],null,ends().concat(ends()),[{x:240,y:260},{x:240.5,y:260}], [{x:-1,y:260},{x:89,y:260}]])
    assert.throws(()=>a.calibrate(f,a.createSession(f),0,e));
  for(const edit of [c=>c.disc_cm=1,c=>c.disc_cm=.001,c=>c.disc_px=900,c=>c.disc_px=90.000001,
    c=>c.frame_id=99,c=>c.unit='free',c=>{c.endpoints=ends(3.000001);c.disc_px=90;},
    c=>{c.endpoints=ends(0,4.500001);c.disc_px=Math.hypot(c.endpoints[0].x-c.endpoints[1].x,0);}]) {
    assert.equal(a.save(st,f,s).ok,true);
    const e=JSON.parse(mem.get(key)); edit(e.session.calibration);e.integrity=a.canonical(e.session);mem.set(key,JSON.stringify(e));
    assert.equal(a.restore(st,f).ok,false);assert.equal(a.compare(f,e.session).status,'INCOMPLETE');
  }
  const noisy=done(a,f,ends(2,4));assert.equal(a.save(st,f,noisy).ok,true);assert.deepEqual(a.restore(st,f).session,noisy);
  const extra=clone(s);extra.calibration.cm_per_px=.001;assert.equal(a.compare(f,extra).cm_per_px,.5);
});
test('exactly three valid unique clips; statuses recomputed; incomplete dominates fail; physical always false',async()=>{
  const a=await ready,ts=['a','b','c'].map(id=>{const f=fixture(id);return {fixture:f,session:done(a,f)}});
  assert.equal(a.aggregate(ts).status,'PASS');
  const bad=[[],ts.slice(0,1),ts.slice(0,2),[...ts,ts[0]],[ts[0],ts[0],ts[2]],null,[{status:'PASS'},{status:'PASS'},{status:'PASS'}]];
  for(const t of bad) {const r=a.aggregate(t);assert.equal(r.status,'INCOMPLETE');assert.equal(r.physical_vc_pass,false);}
  const f=fixture('c');f.frames[1].automatic.y+=5;ts[2]={fixture:f,session:done(a,f),status:'PASS'};
  assert.equal(a.aggregate(ts).status,'FAIL');ts[1].session.locked=false;
  assert.equal(a.aggregate(ts).status,'INCOMPLETE');assert.equal(a.aggregate(ts).physical_vc_pass,false);
});
test('frame IDs remain distinct from sample indexes across marking and calibration',async()=>{
 const a=await ready,f=fixture(),s=done(a,f);
 assert.deepEqual(s.marks.map(q=>q.frame_id),[0,7,14,21]);
 const q=f.frames[1],e=[{x:q.disc.x-45,y:q.disc.y},{x:q.disc.x+45,y:q.disc.y}];
 assert.equal(a.calibrate(f,s,7,e).calibration.frame_id,7);
 assert.throws(()=>a.calibrate(f,s,1,e),/calibration_frame/);
 assert.equal(s.locked,true);
});

test('scene adapter ignores outside clicks and can retry with a valid diameter',async()=>{
 const f=fixture(),events={},info={textContent:''};
 const scene={addEventListener:(k,v)=>events[k]=v,getBoundingClientRect:()=>({left:0,top:0,width:640,height:400})};
 const ui=sceneAdapter(f,scene,info);ui.start();
 events.click({clientX:240,clientY:0});assert.equal(ui.state().error,'outside_image');
 assert.equal(ui.state().session.calibration,null);
 for(const p of ends())events.click({clientX:p.x,clientY:p.y+20});
 assert.equal(ui.state().error,null);assert.equal(ui.state().session.calibration.disc_px,90);
});
