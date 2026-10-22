// Synthetic regression tests with native ESM imports and no external probe dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from './vaMark1.mjs';
import { fixtures } from './vaMark1Fixtures.mjs';
import { mount } from './vaMark1Page.mjs';
const ready = Promise.resolve({ ...core, fixtures, mount });
const clone=x=>JSON.parse(JSON.stringify(x));
function trial(a,c=0,noise=true){
 const fixture=a.fixtures()[c];
 if(!noise) fixture.frames.forEach(q=>q.automatic={...q.disc});
 let session=a.createSession(fixture);
 const q=fixture.frames[0], endpoints=[{x:q.disc.x-45,y:q.disc.y},{x:q.disc.x+45,y:q.disc.y}];
 session=a.calibrate(fixture,session,q.frame_id,endpoints);
 fixture.frames.forEach((q,i)=>session=a.mark(fixture,session,i,q.disc));
 session=a.lock(fixture,session);return {fixture,session};
}
function store(){const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v)};}
function ui(a,storage=store()){
 const ids=['scene','disc','cross','edgeA','edgeB','x','y','scaleInfo','frame','clip','frameInfo','result','aggregate','message','setPoint','clearPoint','calibrate','compare','save','restore'];
 const els=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',attrs:{},ev:{},setAttribute(k,v){this.attrs[k]=String(v)},addEventListener(k,v){this.ev[k]=v},getBoundingClientRect(){return {left:100,top:50,width:1280,height:800}}}]));
 a.mount({getElementById:id=>{assert.ok(els[id],id);return els[id]}},()=>{if(storage instanceof Error)throw storage;return storage});
 return {els, event:(id,t='click',e={})=>els[id].ev[t](e),click:(x,y)=>els.scene.ev.click({clientX:100+x*2,clientY:90+y*2})};
}
function fill(a,u,c){
 u.els.clip.value=String(c);u.event('clip','change');
 u.event('calibrate');u.click(195,260);u.click(285,260);
 a.fixtures()[c].frames.forEach((q,i)=>{u.els.frame.value=String(i);u.event('frame','change');u.click(q.disc.x,q.disc.y)});
 u.event('compare');
}
test('K1: 0/1/2/4, duplicate IDs, null and status-only records cannot PASS',async()=>{
 const a=await ready, ts=[0,1,2].map(c=>trial(a,c,false));
 for(const v of [[],ts.slice(0,1),ts.slice(0,2),[...ts,ts[0]],[ts[0],ts[0],ts[2]],[ts[0],null,ts[2]],[{status:'PASS'},{status:'PASS'},{status:'PASS'}]])assert.equal(a.aggregate(v).status,'INCOMPLETE');
 assert.equal(a.aggregate(ts).status,'PASS');assert.equal(a.aggregate(ts).physical_vc_pass,false);
});
test('K1: every missing measurement overrides even a FAIL; all valid then FAIL has priority',async()=>{
 const a=await ready,ts=[0,1,2].map(c=>trial(a,c));
 assert.equal(a.aggregate(ts).status,'FAIL');ts[0].session.locked=false;assert.equal(a.aggregate(ts).status,'INCOMPLETE');
 ts[0].session.locked=true;ts[0].session.marks[0].point=null;assert.equal(a.aggregate(ts).status,'INCOMPLETE');
});
test('K2: old free scale signature and all reported scale attacks are rejected',async()=>{
 const a=await ready,{fixture:f,session:s}=trial(a,1);assert.equal(a.compare(f,s).status,'FAIL');
 for(const [cm,px] of [[1,90],[0.001,90],[45,900],[-1,90],[0,90],['45',90],[45,Infinity],[null,90]]){
  assert.throws(()=>a.calibrate(f,s,cm,px));const v=clone(s);v.calibration.disc_cm=cm;v.calibration.disc_px=px;
  assert.equal(a.compare(f,v).status,'INCOMPLETE');
 }
});
test('diameter must be two actual antipodal points, bound to frame, image and fixture',async()=>{
 const a=await ready,{fixture:f,session:s}=trial(a);
 for(const [id,ends] of [[0,[]],[0,[{x:195,y:260},{x:195,y:260}]],[0,[{x:195,y:260},{x:275,y:260}]],[0,[{x:191,y:260},{x:281,y:260}]],[7,[{x:195,y:260},{x:285,y:260}]],[0,[{x:-1,y:260},{x:89,y:260}]],[0,[{x:195,y:260},{x:1095,y:260}]],[0,[{x:'195',y:260},{x:285,y:260}]]])assert.throws(()=>a.calibrate(f,s,id,ends));
 const v=a.calibrate(f,s,0,[{x:240,y:215},{x:240,y:305}]);assert.equal(v.calibration.disc_px,90);assert.equal(v.locked,false);
 const g=clone(f);g.image.height=80;assert.throws(()=>a.createSession(g));
 const h=clone(f);h.frames[0].disc_px=0.5;assert.throws(()=>a.createSession(h));
});
test('calibration has no aliases to caller points and old session is immutable',async()=>{
 const a=await ready,{fixture:f,session:s}=trial(a),ends=[{x:195,y:260},{x:285,y:260}];
 const v=a.calibrate(f,s,0,ends);ends[0].x=0;assert.equal(v.calibration.endpoints[0].x,195);assert.equal(s.locked,true);
 assert.equal(a.clearCalibration(f,s).calibration,null);assert.equal(s.locked,true);
});
test('independent formulas match K position/speed probes with hand jitter',async()=>{
 const a=await ready,jit=[[.3,-.4],[-.5,.2],[.1,.1],[.4,-.3]];
 for(let c=0;c<3;c++){
  const {fixture:f,session:base}=trial(a,c);let s=base;
  const hand=f.frames.map((q,i)=>({x:q.disc.x+jit[i][0],y:q.disc.y+jit[i][1]}));
  hand.forEach((p,i)=>s=a.mark(f,s,i,p));const r=a.compare(f,a.lock(f,s));
  const pos=Math.max(...f.frames.map((q,i)=>Math.hypot(q.automatic.x-hand[i].x,q.automatic.y-hand[i].y)*.5));
  const speeds=f.frames.slice(1).map((q,i)=>((f.frames[i].automatic.y-q.automatic.y)-(hand[i].y-hand[i+1].y))*.005/(q.t_s-f.frames[i].t_s));
  const speed=Math.max(...speeds.map(Math.abs));
  assert.ok(Math.abs(r.position.max_abs-pos)<1e-12);assert.ok(Math.abs(r.velocity.max_abs-speed)<1e-12);
  assert.equal(r.status,c===0?'PASS':'FAIL');assert.equal(r.physical_vc_pass,false);assert.equal(r.uncertainty,null);
 }
});
test('known fixture statuses, actual irregular dt and velocity sign',async()=>{
 const a=await ready;assert.deepEqual([0,1,2].map(c=>{const t=trial(a,c);return a.compare(t.fixture,t.session).status}),['PASS','FAIL','FAIL']);
 const {fixture:f,session:s}=trial(a);const r=a.compare(f,s);
 assert.deepEqual(r.intervals.map(i=>i.dt_s),[.2,.35000000000000003,.55]);r.intervals.forEach(i=>assert.ok(Math.abs(i.manual_m_s-.4)<1e-12));
 assert.ok(r.residuals[1].dy_cm<0);assert.ok(r.intervals[0].error_m_s>0);
});
test('inclusive position boundary and immediately greater; RMSE cannot hide outlier',async()=>{
 const a=await ready,t=trial(a,0,false),f=t.fixture;
 f.frames.forEach(q=>q.automatic.x+=2);let s={...t.session,basis:a.canonical(f)};
 let r=a.compare(f,s);assert.equal(r.position.max_abs,1);assert.equal(r.status,'PASS');
 f.frames[0].automatic.x+=1e-10;s.basis=a.canonical(f);r=a.compare(f,s);assert.equal(r.status,'FAIL');assert.ok(r.position.rmse>0);
});
test('inclusive velocity 0.05 uses fixed marked scale, no free calibration',async()=>{
 const a=await ready,t=trial(a,0,false),f=t.fixture;
 f.frames=[0,.125].map((t_s,i)=>({frame_id:i,t_s,disc:{x:240,y:260},disc_px:90,automatic:{x:240,y:260+i*1.25}}));
 let s=a.calibrate(f,a.createSession(f),0,[{x:195,y:260},{x:285,y:260}]);f.frames.forEach((q,i)=>s=a.mark(f,s,i,q.disc));s=a.lock(f,s);
 let r=a.compare(f,s);assert.equal(r.velocity.max_abs,.05);assert.equal(r.status,'PASS');
 f.frames[1].automatic.y+=1e-10;s.basis=a.canonical(f);r=a.compare(f,s);assert.ok(r.velocity.max_abs>.05);assert.equal(r.status,'FAIL');
});
test('missing calibration/point/automatic, unknown units, stale basis and time never PASS',async()=>{
 const a=await ready,{fixture:f,session:s}=trial(a);
 for(const change of [v=>v.calibration=null,v=>v.marks[0].point=null,v=>v.marks.pop(),v=>v.locked=false,v=>v.calibration.unit='m_per_px',v=>v.marks[0].t_s=.01,v=>v.basis+='x']){const v=clone(s);change(v);assert.equal(a.compare(f,v).status,'INCOMPLETE')}
 for(const change of [g=>g.frames[0].automatic=null,g=>g.axis='y_up',g=>g.clock='fps',g=>g.frames[1].t_s=0,g=>g.frames[1].frame_id=0,g=>g.image.width=1280]){const g=clone(f);change(g);assert.equal(a.compare(g,s).status,'INCOMPLETE')}
});
test('subnormal dt yields numeric overflow, invalid coordinates rejected',async()=>{
 const a=await ready,{fixture:f,session:s}=trial(a);f.frames[1].t_s=1e-320;
 const v=clone(s);v.basis=a.canonical(f);v.marks[1].t_s=1e-320;assert.equal(a.compare(f,v).reason,'numeric_overflow');
 for(const point of [{x:'10',y:20},{x:NaN,y:1},{x:640.01,y:0}])assert.throws(()=>a.mark(f,v,0,point));
 assert.deepEqual(a.mark(f,v,0,{x:640,y:360}).marks[0].point,{x:640,y:360});
});
test('K2 storage: roundtrip, altered cm/px/endpoints/marks, mismatched clip and dimension',async()=>{
 const a=await ready,{fixture:f,session:s}=trial(a,1),st=store(),key='VA-MARK1:'+f.clip_id;
 assert.equal(a.save(st,f,s).ok,true);assert.deepEqual(a.restore(st,f).session,s);
 const original=st.getItem(key);
 for(const change of [e=>e.session.calibration.disc_cm=.001,e=>e.session.calibration.disc_px=900,e=>e.session.calibration.endpoints[0].x++,e=>e.session.marks[0].point.y++]){const e=JSON.parse(original);change(e);st.setItem(key,JSON.stringify(e));assert.equal(a.restore(st,f).ok,false)}
 // Even refreshing the unkeyed integrity field cannot bypass geometric validation.
 const e=JSON.parse(original);e.session.calibration.disc_px=900;e.integrity=a.canonical(e.session);st.setItem(key,JSON.stringify(e));assert.equal(a.restore(st,f).reason,'calibration_mismatch');
 st.setItem(key,original);const g=clone(f);g.image.width=1280;assert.equal(a.restore(st,g).ok,false);assert.equal(a.save(st,a.fixtures()[0],s).ok,false);
 st.setItem(key,'{');assert.equal(a.restore(st,f).ok,false);st.setItem(key,'x'.repeat(500001));assert.equal(a.restore(st,f).reason,'storage_size');
});
test('storage denial, no data, legacy raw session rejected',async()=>{
 const a=await ready,{fixture:f,session:s}=trial(a),st=store(),denied={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 assert.equal(a.restore(st,f).reason,'no_saved_session');assert.equal(a.save(denied,f,s).reason,'quota');assert.equal(a.restore(denied,f).reason,'denied');
 st.setItem('VA-MARK1:'+f.clip_id,JSON.stringify(s));assert.equal(a.restore(st,f).ok,false);
});
test('pointer percentage/resize/letterboxing and inclusive image edges',async()=>{
 const a=await ready,image={width:640,height:360};
 for(const width of [320,640,1280]){const height=width*360/640;assert.deepEqual(a.pointerPoint({left:10,top:20,width,height},image,10+width*.375,20+height*.5),{x:240,y:180})}
 assert.deepEqual(a.pointerPoint({left:100,top:50,width:1280,height:800},image,580,610),{x:240,y:260});
 assert.equal(a.pointerPoint({left:100,top:50,width:1280,height:800},image,580,60),null);
 assert.deepEqual(a.pointerPoint({left:0,top:0,width:640,height:360},image,640,360),{x:640,y:360});
});
test('synthetic DOM: two image clicks calibrate, all clips give PASS/FAIL/FAIL, aggregate FAIL',async()=>{
 const a=await ready,u=ui(a);assert.equal(JSON.parse(u.els.result.textContent).status,'INCOMPLETE');
 for(let c=0;c<3;c++){fill(a,u,c);assert.equal(JSON.parse(u.els.result.textContent).status,c===0?'PASS':'FAIL');if(c<2)assert.match(u.els.aggregate.textContent,/INCOMPLETE/)}
 assert.equal(JSON.parse(u.els.aggregate.textContent.split(': ').slice(1).join(': ')).status,'FAIL');
 assert.match(u.els.scaleInfo.textContent,/45 cm \/ 90 px/);
});
test('synthetic DOM: recalibration immediately clears old PASS, bad diameter and pending cannot reuse it',async()=>{
 const a=await ready,u=ui(a);fill(a,u,0);u.event('calibrate');assert.equal(JSON.parse(u.els.result.textContent).status,'INCOMPLETE');
 u.click(195,260);u.event('compare');assert.match(u.els.message.textContent,/diameter_pending/);
 u.click(275,260);assert.match(u.els.message.textContent,/calibration_mismatch/);u.event('compare');assert.match(u.els.message.textContent,/missing_calibration/);
 assert.doesNotMatch(u.els.result.textContent,/"status": "PASS"/);
});
test('synthetic DOM: point edit refreshes coverage; stale/tampered restore clears PASS; denial visible',async()=>{
 const a=await ready,st=store(),u=ui(a,st);fill(a,u,0);u.event('save');
 u.els.x.value='99';u.event('x','input');assert.match(u.els.frameInfo.textContent,/3\/4/);assert.equal(JSON.parse(u.els.result.textContent).status,'INCOMPLETE');
 u.event('restore');assert.equal(JSON.parse(u.els.result.textContent).status,'PASS');st.setItem('VA-MARK1:synthetic-1','{}');u.event('restore');assert.equal(JSON.parse(u.els.result.textContent).status,'INCOMPLETE');
 const v=ui(a,Error('SecurityError'));v.event('save');assert.match(v.els.message.textContent,/IKKE GEMT: SecurityError/);v.event('restore');assert.match(v.els.message.textContent,/IKKE GENDANNET: SecurityError/);
});
test('fresh fixture calls are independent and calibration starts empty',async()=>{
 const a=await ready,first=a.fixtures(),second=a.fixtures();
 first[0].frames[0].disc.x=0;assert.equal(second[0].frames[0].disc.x,240);
 const session=a.createSession(second[0]);assert.equal(session.calibration,null);
 assert.equal(a.compare(second[0],session).status,'INCOMPLETE');
});

test('canonical basis is independent of property insertion order',async()=>{
 const a=await ready,f=a.fixtures()[0],reordered=Object.fromEntries(Object.entries(f).reverse());
 assert.equal(a.canonical(f),a.canonical(reordered));
 assert.deepEqual(a.createSession(f),a.createSession(reordered));
});

test('locking rejects missing marks and missing calibration without mutating draft',async()=>{
 const a=await ready,f=a.fixtures()[0];let s=a.createSession(f);
 assert.throws(()=>a.lock(f,s),/missing_manual/);
 f.frames.forEach((q,i)=>s=a.mark(f,s,i,q.disc));
 assert.throws(()=>a.lock(f,s),/missing_calibration/);assert.equal(s.locked,false);
});

test('synthetic DOM: first diameter point is visible and coordinate typing survives invalidation',async()=>{
 const a=await ready,u=ui(a);u.event('calibrate');u.click(195,260);
 assert.equal(u.els.edgeA.attrs.cx,'195');assert.equal(u.els.edgeA.attrs.cy,'260');assert.equal(u.els.edgeB.attrs.cx,'-100');
 u.click(285,260);u.els.x.value='240';u.event('x','input');assert.equal(u.els.x.value,'240');
 u.els.y.value='260';u.event('y','input');assert.equal(u.els.x.value,'240');assert.equal(u.els.y.value,'260');
 u.event('setPoint');assert.equal(u.els.cross.attrs.cx,'240');assert.equal(u.els.cross.attrs.cy,'260');
});
test('synthetic DOM rejects invalid clip and frame choices without changing result',async()=>{
 const a=await ready,u=ui(a);fill(a,u,0);const before=u.els.result.textContent;
 for(const [id,value] of [['clip','3'],['clip','-1'],['frame','4'],['frame','0.5']]){
  u.els[id].value=value;u.event(id,'change');assert.match(u.els.message.textContent,/AFVIST/);
  assert.equal(u.els.result.textContent,before);
 }
});

test('synthetic DOM clear point invalidates locked comparison and save restores the draft',async()=>{
 const a=await ready,u=ui(a);fill(a,u,0);u.event('clearPoint');
 assert.equal(JSON.parse(u.els.result.textContent).status,'INCOMPLETE');
 assert.match(u.els.frameInfo.textContent,/3\/4/);u.event('save');u.event('restore');
 assert.equal(JSON.parse(u.els.result.textContent).status,'INCOMPLETE');
 assert.match(u.els.frameInfo.textContent,/3\/4/);
});
