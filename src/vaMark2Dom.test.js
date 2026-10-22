import test from 'node:test';
import assert from 'node:assert/strict';
import {mount} from './vaMark2Page.mjs';
import {fixtures} from './vaMark2Fixtures.mjs';
import {JOINTS} from './vaMark2.mjs';
function fake() {
  const nodes=new Map();
  const dom={getElementById(id){if(!nodes.has(id))nodes.set(id,{
    value:id==='joint'?'hip':'0',textContent:'',attrs:{},events:{},
    setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},
    getBoundingClientRect(){return {left:10,top:20,width:320,height:300};}
  });return nodes.get(id);}};
  const values=new Map();
  let denied=false;
  const storage={getItem(k){if(denied)throw Error('denied');return values.get(k)??null;},
    setItem(k,v){if(denied)throw Error('quota');values.set(k,v);}};
  mount(dom,()=>storage);
  const el=id=>dom.getElementById(id);
  const fire=(id,event='click',data={})=>el(id).events[event](data);
  const click=p=>fire('scene','click',{clientX:10+p.x/2,clientY:80+p.y/2});
  const choose=(id,v)=>{el(id).value=String(v);fire(id,'change');};
  const fill=c=>{
    choose('clip',c);const f=fixtures()[c];
    f.frames.forEach((q,i)=>{choose('frame',i);for(const k of JOINTS){choose('joint',k);click(q.truth[k]);}});
    choose('frame',0);fire('calibrate');click({x:75,y:260});click({x:165,y:260});fire('compare');
  };
  return {el,fire,click,choose,fill,values,deny:()=>{denied=true;}};
}
test('synthetic DOM click mapping, coverage, frame and joint controls, locking and invalidation',()=>{
  const d=fake();assert.match(d.el('coverage').textContent,/0\/24.*0.0/);
  assert.equal(JSON.parse(d.el('result').textContent).status,'INCOMPLETE');
  d.fill(0);assert.match(d.el('coverage').textContent,/24\/24.*100.0.*fastlaast/);
  assert.equal(JSON.parse(d.el('result').textContent).status,'PASS');
  assert.match(d.el('scaleInfo').textContent,/45 cm \/ 90 px/);
  d.fire('clear');assert.equal(JSON.parse(d.el('result').textContent).status,'INCOMPLETE');
  assert.match(d.el('coverage').textContent,/23\/24.*95.8/);
});
test('synthetic DOM three clips, pending diameter and clip/frame transitions',()=>{
  const d=fake();for(let c=0;c<3;c++)d.fill(c);
  assert.equal(JSON.parse(d.el('aggregate').textContent).status,'FAIL');
  d.fire('calibrate');d.click({x:75,y:260});d.fire('compare');
  assert.match(d.el('message').textContent,/diameter_pending/);
  assert.equal(JSON.parse(d.el('aggregate').textContent).status,'INCOMPLETE');
  d.choose('frame',1);d.fire('compare');assert.match(d.el('message').textContent,/missing_calibration/);
  d.choose('clip',0);assert.match(d.el('frameInfo').textContent,/frame 0/);
  d.click({x:0,y:0});assert.equal(JSON.parse(d.el('result').textContent).status,'INCOMPLETE');
});
test('synthetic DOM save/restore, failed load clears stale PASS and quota is visible',()=>{
  const d=fake();d.fill(0);d.fire('save');assert.match(d.el('message').textContent,/Gemt/);
  d.fire('clear');d.fire('restore');assert.equal(JSON.parse(d.el('result').textContent).status,'PASS');
  d.values.set('VA-MARK2:va2-squat','not json');d.fire('restore');
  assert.match(d.el('message').textContent,/IKKE GENDANNET/);
  assert.equal(JSON.parse(d.el('result').textContent).status,'INCOMPLETE');
  d.deny();d.fire('save');assert.match(d.el('message').textContent,/quota/);
  d.fire('restore');assert.match(d.el('message').textContent,/denied/);
});
test('synthetic DOM outside letterbox, bad controls and invalid diameter cannot create PASS',()=>{
  const d=fake();d.fire('scene','click',{clientX:100,clientY:21});
  assert.match(d.el('message').textContent,/outside_image/);
  d.choose('joint','bogus');assert.match(d.el('message').textContent,/joint/);
  d.choose('clip',5);assert.match(d.el('message').textContent,/selection/);
  d.fire('calibrate');d.click({x:0,y:0});d.click({x:90,y:0});
  assert.match(d.el('message').textContent,/calibration_mismatch/);
  assert.equal(JSON.parse(d.el('result').textContent).status,'INCOMPLETE');
});
