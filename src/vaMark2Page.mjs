import { createSession, mark, calibrate, clearCalibration, lock, compare, aggregate, pointerPoint, save, restore, JOINTS } from './vaMark2.mjs';
import { fixtures } from './vaMark2Fixtures.mjs';
// Pure DOM controller with injected storage. No browser globals at module evaluation.
export function mount(dom,getStorage) {
  const all=fixtures(), sessions=all.map(createSession), el=id=>dom.getElementById(id);
  let clip=0,frame=0,joint='hip',diameter=null;
  const f=()=>all[clip],s=()=>sessions[clip];
  const message=t=>{el('message').textContent=t;};
  function render() {
    const q=f().frames[frame];
    for (const k of JOINTS) {
      for (const [prefix,p] of [['truth',q.truth[k]],['mark',s().marks[frame].pose[k]]]) {
        el(prefix+'-'+k).setAttribute('cx',p?.x??-100);el(prefix+'-'+k).setAttribute('cy',p?.y??-100);
      }
    }
    const ends=diameter?.length ? diameter : s().calibration?.frame_id===q.frame_id ? s().calibration.endpoints:[];
    for (let i=0;i<2;i++) {el('edge'+i).setAttribute('cx',ends?.[i]?.x??-100);el('edge'+i).setAttribute('cy',ends?.[i]?.y??-100);}
    for (const [prefix,pose] of [['truth',q.truth],['mark',s().marks[frame].pose]]) {
      const chains=[['shoulder','hip','knee','ankle','toe'],['shoulder','elbow']];
      const d=chains.map(keys=>keys.every(k=>pose[k]) ? keys.map((k,i)=>(i?'L':'M')+pose[k].x+' '+pose[k].y).join(' '):'').join(' ');
      el(prefix+'Path').setAttribute('d',d);
    }
    const n=s().marks.reduce((n,m)=>n+JOINTS.filter(k=>m.pose[k]).length,0),total=f().frames.length*JOINTS.length;
    el('coverage').textContent=n+'/'+total+' ledpunkter ('+(100*n/total).toFixed(1)+' %) | '+(s().locked?'fastlaast':'kladde');
    el('frameInfo').textContent=f().clip_id+' | frame '+q.frame_id+' | '+q.t_s+' s | venstre side';
    el('scaleInfo').textContent=s().calibration?'45 cm / '+s().calibration.disc_px+' px fra markeret diameter':'Ingen markeret diameter';
    el('result').textContent=JSON.stringify(compare(f(),s()),null,2);
    el('aggregate').textContent=JSON.stringify(aggregate(all.map((fixture,i)=>({fixture,session:sessions[i]}))),null,2);
  }
  const change=fn=>{try{fn();render();message('Kladde aendret. Fastlaas igen.');}catch(e){render();message('AFVIST: '+e.message);}};
  el('scene').addEventListener('click',e=>change(()=>{
    const p=pointerPoint(el('scene').getBoundingClientRect(),f().image,e.clientX,e.clientY);
    if (!p) throw Error('outside_image');
    if (diameter) {
      diameter.push(p);
      if(diameter.length===2) {const ends=diameter;diameter=null;sessions[clip]=calibrate(f(),s(),f().frames[frame].frame_id,ends);}
    } else sessions[clip]=mark(f(),s(),frame,joint,p);
  }));
  el('clear').addEventListener('click',()=>change(()=>{diameter=null;sessions[clip]=mark(f(),s(),frame,joint,null);}));
  el('calibrate').addEventListener('click',()=>change(()=>{sessions[clip]=clearCalibration(f(),s());diameter=[];}));
  el('compare').addEventListener('click',()=>change(()=>{
    if(diameter)throw Error('diameter_pending');sessions[clip]=lock(f(),s());
  }));
  for(const [id,max,set] of [['clip',all.length,n=>{clip=n;frame=0;el('frame').value='0';}],
    ['frame',4,n=>{frame=n;}]]) el(id).addEventListener('change',()=>change(()=>{
      const n=Number(el(id).value);if(!Number.isInteger(n)||n<0||n>=max)throw Error('selection');
      diameter=null;set(n);
    }));
  el('joint').addEventListener('change',()=>change(()=>{
    const k=el('joint').value;if(!JOINTS.includes(k))throw Error('joint');diameter=null;joint=k;
  }));
  el('save').addEventListener('click',()=>{
    try{const r=save(getStorage(),f(),s());message(r.ok?'Gemt lokalt.':'IKKE GEMT: '+r.reason);}
    catch(e){message('IKKE GEMT: '+e.message);}
  });
  el('restore').addEventListener('click',()=>{
    diameter=null;sessions[clip]=createSession(f());
    try{const r=restore(getStorage(),f());if(r.ok)sessions[clip]=r.session;render();message(r.ok?'Gendannet med eksakt basis.':'IKKE GENDANNET: '+r.reason);}
    catch(e){render();message('IKKE GENDANNET: '+e.message);}
  });
  render();message('SYNTETISK: Marker seks punkter i hvert billede og skivens diameter med to klik.');
}
