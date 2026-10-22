import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILM_GUIDE_KEY, FILM_GUIDE_HTML, mountFilmGuide, mountUploadFilmGuide } from '../public/videoFilmGuide.mjs';

class Element {
  constructor() { this.hidden=false; this.attributes={}; this.listeners=new Map(); this.parent=null; this.children=[]; }
  setAttribute(k,v) { this.attributes[k]=v; }
  addEventListener(k,f) { if (!this.listeners.has(k)) this.listeners.set(k,new Set()); this.listeners.get(k).add(f); }
  removeEventListener(k,f) { this.listeners.get(k)?.delete(f); }
  click() {
    const event={ stopped:false, stopPropagation() { this.stopped=true; } };
    for (let node=this;node && !event.stopped;node=node.parent) {
      for (const fn of node.listeners.get('click') || []) fn(event);
    }
  }
  set innerHTML(value) {
    this.html=value; this.button=new Element(); this.panel=new Element(); this.arrow=new Element();
    this.button.parent=this; this.panel.parent=this; this.arrow.parent=this.button;
  }
  querySelector(id) { return { '#film-guide-toggle':this.button,'#film-guide-panel':this.panel,'#film-guide-arrow':this.arrow }[id]; }
  insertBefore(node,before) { this.children.splice(before ? this.children.indexOf(before) : this.children.length,0,node); node.parent=this; }
  get firstChild() { return this.children[0] || null; }
}
function storage(value) {
  const values=new Map(value === undefined ? [] : [[FILM_GUIDE_KEY,value]]),writes=[];
  return {writes,getItem:k=>values.get(k) ?? null,setItem(k,v) { values.set(k,v); writes.push([k,v]); }};
}
function setup(store) {
  const b=new Element(), p=new Element(), a=new Element();
  const dispose=mountFilmGuide(b,p,a,()=>store);
  return {b,p,a,dispose};
}
test('first visit open, exact key marked, next visit closed',()=>{
  const s=storage(),first=setup(s); assert.equal(first.p.hidden,false);
  assert.equal(first.b.attributes['aria-expanded'],'true'); assert.equal(first.a.textContent,'▾');
  assert.deepEqual(s.writes,[[FILM_GUIDE_KEY,'1']]);
  const second=setup(s); assert.equal(second.p.hidden,true); assert.equal(second.a.textContent,'▸');
});
test('both directions and repeated clicks update hidden and aria together',()=>{
  const x=setup(storage());
  for(let i=0;i<6;i++){x.b.click();assert.equal(x.p.hidden,i%2===0); assert.equal(x.b.attributes['aria-expanded'],String(!x.p.hidden));}
});
test('only exact string 1 means seen',()=>{
  for(const v of ['',0,1,true,'true','0','2',null])assert.equal(setup(storage(v)).p.hidden,false);
});
test('throwing provider and read failures leave guide usable',()=>{
  for(const provider of [()=>{throw Error('getter');},()=>({getItem(){throw Error('read');},setItem(){throw Error('write');}})]){
    const b=new Element(),p=new Element(),a=new Element();mountFilmGuide(b,p,a,provider);
    assert.equal(p.hidden,false);b.click();assert.equal(p.hidden,true);
  }
});
test('write failure does not block initial render or toggling',()=>{
  const x=setup({getItem:()=>null,setItem(){throw Error('quota');}});
  assert.equal(x.p.hidden,false); x.b.click();assert.equal(x.p.hidden,true);
});
test('missing storage falls back open',()=>{for(const s of [null,undefined])assert.equal(setup(s).p.hidden,false);});
test('cleanup removes exactly the click handler',()=>{
  const x=setup(storage());x.dispose();x.b.click();assert.equal(x.p.hidden,false);assert.equal(x.b.listeners.get('click').size,0);
});
function docFixture(athlete) {
  const drop=new Element(),cta=new Element();drop.insertBefore(cta,null);
  let host;
  if(athlete){host=new Element();host.id='athFilmGuide';drop.insertBefore(host,cta);}
  return {drop,cta,host, getElementById(id){return id==='athFilmGuide'?host:id==='dropHint'?drop:null;},createElement(){host=new Element();this.host=host;return host;}};
}
test('standard, instant and coach all mount before upload and isolate guide clicks',()=>{
  for(const flow of ['athlete','instant','coach']){
    const d=docFixture(flow!=='coach'),s=storage();let fileOpens=0;
    d.drop.addEventListener('click',()=>fileOpens++);
    const dispose=mountUploadFilmGuide(d,()=>s),h=d.host;
    assert.ok(d.drop.children.indexOf(h)<d.drop.children.indexOf(d.cta));
    assert.equal(h.html,FILM_GUIDE_HTML); assert.equal(h.panel.hidden,false);
    h.button.click();assert.equal(h.panel.hidden,true);assert.equal(fileOpens,0);
    h.panel.click();assert.equal(fileOpens,0);
    d.cta.click();assert.equal(fileOpens,1);
    dispose();assert.equal(h.listeners.get('click').size,0);
  }
});
test('one store shared across standalone, athlete and coach visits',()=>{
  const s=storage();setup(s);
  for(const athlete of [true,false]){const d=docFixture(athlete);mountUploadFilmGuide(d,()=>s);assert.equal(d.host.panel.hidden,true);}
  assert.equal(new Set(s.writes.map(([key])=>key)).size,1);
});
test('missing upload DOM is harmless and does not touch storage',()=>{
  assert.doesNotThrow(()=>mountUploadFilmGuide({getElementById:()=>null},()=>{throw Error('must not access');})());
});
test('native button, unique panel binding, six approved points and qualified measurement',()=>{
  assert.match(FILM_GUIDE_HTML,/<button type="button"/);
  assert.match(FILM_GUIDE_HTML,/aria-controls="film-guide-panel"/);
  assert.equal((FILM_GUIDE_HTML.match(/<li>/g)||[]).length,6);
  for(const text of ['3 til 4 meter','zoom ikke','Godt lys','Stabil telefon','Hele løftet','et skøn'])assert.ok(FILM_GUIDE_HTML.includes(text));
});
