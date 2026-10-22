/* VA-K5: own small pure measurement functions; pinned full modules stay inert. */
// ESM packaging of pinned VA-K5 rules; not executed during production.
'use strict';
const bad=()=>{throw new TypeError('Ugyldigt syntetisk format eller svargrundlag');};
const exact=(o,ks)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===ks.length&&ks.every(k=>Object.hasOwn(o,k));
const need=(v)=>{if(!v)bad();};
const num=x=>{need(Number.isFinite(x));return x;};
const scale=(x,s)=>{const y=num(x*s);need(x===0||y!==0);return y;};
const ruleset='VA-K4:sha256:4fc05a619006e3d687dea649e9824b88e622a7f9fe1a0abfd06ccaa172f98b33';
const channels=['bar_x_px','bar_y_px','hip_y_px','shoulder_y_px','knee_deg'];
const errors=['x_px','y_px','body_y_px','knee_deg','scale_cm_per_px','time_s'];
const defs=[
 ['BAR_FORWARD',3,'cm','Stangens største fremadrettede forskydning fra fasestart.','max(0, (x_i-x_0)*s)'],
 ['HIP_LEAD',3,'cm','Største relative opstigning af hofte mod skulder; ikke en tidsmæssig årsag.','max(0, ((h_0-h_i)-(q_0-q_i))*s)'],
 ['SPEED_RANGE',.15,'m/s','Spænd i opadrettet intervalhastighed; normal acceleration kan også udløse fund.','max(v)-min(v), v=(y_før-y_nu)*s/100/dt'],
 ['KNEE_REVERSAL',10,'deg','Største fald i indre knævinkel mellem nabosamples.','max(0, k_før-k_nu)']
];
function validate(d){
 need(exact(d,['schema','status','lift','setup_id','units','phase','cm_per_px','uncertainty','samples']));
 need(d.schema==='va-k4-synthetic/v1'&&d.status==='synthetic_only'&&['bench','squat','deadlift'].includes(d.lift));
 need(typeof d.setup_id==='string'&&d.setup_id.trim().length>0);
 need(exact(d.units,['time','position','angle','scale'])&&d.units.time==='s'&&d.units.position==='px_x_anterior_y_down'&&d.units.angle==='deg_inner_0_180'&&d.units.scale==='cm_per_px');
 need(d.cm_per_px===null||(Number.isFinite(d.cm_per_px)&&d.cm_per_px>0));
 need(exact(d.uncertainty,errors));
 for(const k of errors)need(d.uncertainty[k]===null||(Number.isFinite(d.uncertainty[k])&&d.uncertainty[k]>=0));
 if(d.cm_per_px!==null&&d.uncertainty.scale_cm_per_px!==null)need(d.uncertainty.scale_cm_per_px<d.cm_per_px);
 need(Array.isArray(d.samples)&&d.samples.length>=2&&d.samples.length<=10000);
 for(let i=0;i<d.samples.length;i++){
  const p=d.samples[i];need(exact(p,['t_s','valid',...channels]));
  need(p.valid===true&&Number.isFinite(p.t_s)&&p.t_s>=0&&(i===0||p.t_s>d.samples[i-1].t_s));
  for(const k of channels)need(p[k]===null||(Number.isFinite(p[k])&&(k!=='knee_deg'||(p[k]>=0&&p[k]<=180))));
 }
 need(exact(d.phase,['name','start','end'])&&d.phase.name==='concentric'&&Number.isInteger(d.phase.start)&&Number.isInteger(d.phase.end)&&d.phase.start>=0&&d.phase.end<d.samples.length&&d.phase.start<d.phase.end);
}
function analyze(d){
 validate(d);
 const p=d.samples.slice(d.phase.start,d.phase.end+1),s=d.cm_per_px,u=d.uncertainty;
 const max=xs=>Math.max(...xs.map(num));
 const all=(...ks)=>ks.every(k=>p.every(q=>q[k]!==null));
 const bound=(delta,n,e)=>e===null||u.scale_cm_per_px===null?null:num(n*e*s+Math.abs(delta)*u.scale_cm_per_px+n*e*u.scale_cm_per_px);
 const values={};
 function displacement(id,ok,deltas,n,e){
  if(s===null||!ok){values[id]=[null,null,s===null?'missing_scale':'missing_channel'];return;}
  const ds=deltas();values[id]=[Math.max(0,max(ds.map(x=>scale(x,s)))),e===null||u.scale_cm_per_px===null?null:max(ds.map(x=>bound(x,n,e))),null];
 }
 displacement('BAR_FORWARD',all('bar_x_px'),()=>p.map(q=>num(q.bar_x_px-p[0].bar_x_px)),2,u.x_px);
 displacement('HIP_LEAD',all('hip_y_px','shoulder_y_px'),()=>p.map(q=>num(num(p[0].hip_y_px-q.hip_y_px)-num(p[0].shoulder_y_px-q.shoulder_y_px))),4,u.body_y_px);
 if(s===null||!all('bar_y_px'))values.SPEED_RANGE=[null,null,s===null?'missing_scale':'missing_channel'];
 else{
  const speeds=[],bs=[];let known=u.y_px!==null&&u.scale_cm_per_px!==null&&u.time_s!==null;
  for(let i=1;i<p.length;i++){
   const dt=num(p[i].t_s-p[i-1].t_s),dy=num(p[i-1].bar_y_px-p[i].bar_y_px),v=num(scale(dy,s)/100/dt);
   need(dy===0||v!==0);speeds.push(v);
   if(known){const t=num(2*u.time_s);if(dt<=t)known=false;else bs.push(num((num(bound(dy,2,u.y_px)/100)+Math.abs(v)*t)/(dt-t)));}
  }
  values.SPEED_RANGE=[num(max(speeds)-Math.min(...speeds)),known?num(2*max(bs)):null,known?null:'unknown_or_unresolved_uncertainty'];
 }
 values.KNEE_REVERSAL=all('knee_deg')?[Math.max(0,max(p.slice(1).map((q,i)=>num(p[i].knee_deg-q.knee_deg)))),u.knee_deg===null?null:num(2*u.knee_deg),null]:[null,null,'missing_channel'];
 return defs.filter(r=>d.lift!=='bench'||['BAR_FORWARD','SPEED_RANGE'].includes(r[0])).map(([id,threshold,unit,reason,formula])=>{
  const [value,e,unavailable_reason]=values[id];return {id,threshold,unit,reason,formula,value,abs_error_bound:e,unavailable_reason,
   nominal_exceeds:value===null?null:value>threshold,
   robust_exceeds:value===null||e===null?null:num(value-e)>threshold?true:num(value+e)<=threshold?false:null,
   source:null,source_note:'VA-K4: input-01-VA-K4-regler.mjs og input-03-FUND-KATALOG.md. Ingen dokumenteret kilde til teknikgrænsen.',status:'afventer Marc'};
 });
}
/* Sorted canonical full content binds answers without trusting hashes or clip labels alone. */
function canonical(x){if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+Array.from(x,canonical).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';}
function batch(b){
 need(exact(b,['schema','status','clips'])&&b.schema==='va-k5-batch/v1'&&b.status==='synthetic_only'&&Array.isArray(b.clips)&&b.clips.length>=1&&b.clips.length<=5);
 const seen=new Set();return Array.from(b.clips,c=>{
  need(exact(c,['clip_id','measurement'])&&typeof c.clip_id==='string'&&c.clip_id===c.clip_id.trim()&&c.clip_id.length>0&&c.clip_id.length<=120&&!seen.has(c.clip_id));seen.add(c.clip_id);
  const assessments=analyze(c.measurement);return {clip_id:c.clip_id,lift:c.measurement.lift,assessments,findings:assessments.filter(a=>a.nominal_exceeds===true),complete:assessments.every(a=>a.value!==null)};
 });
}
function session(b,answers=[]){
 const clips=batch(b);need(Array.isArray(answers));const seen=new Set();
 const checked=Array.from(answers,a=>{
  need(exact(a,['clip_id','finding_id','decision','comment']));
  const c=clips.find(c=>c.clip_id===a.clip_id);need(c&&c.findings.some(f=>f.id===a.finding_id));
  need(['enig','uenig','kommentar'].includes(a.decision)&&typeof a.comment==='string'&&a.comment.length<=2000&&(a.decision!=='kommentar'||a.comment.trim().length>0));
  const key=canonical([a.clip_id,a.finding_id]);need(!seen.has(key));seen.add(key);return {...a};
 });
 return {schema:'va-k5-review/v1',status:'synthetic_only',ruleset,basis:canonical(b),batch:JSON.parse(JSON.stringify(b)),answers:checked,physical_vc_pass:false,technique_acceptance:false,five_real_clips_accepted:false};
}
function encode(b,answers){const text=JSON.stringify(session(b,answers),null,2);need(new TextEncoder().encode(text).length<=12000000);return text;}
function decode(text){
 need(typeof text==='string'&&text.length<=12000000&&new TextEncoder().encode(text).length<=12000000);const d=JSON.parse(text);
 need(exact(d,['schema','status','ruleset','basis','batch','answers','physical_vc_pass','technique_acceptance','five_real_clips_accepted']));
 need(d.schema==='va-k5-review/v1'&&d.status==='synthetic_only'&&d.ruleset===ruleset&&d.physical_vc_pass===false&&d.technique_acceptance===false&&d.five_real_clips_accepted===false);
 const clean=session(d.batch,d.answers);need(d.basis===clean.basis);return clean;
}
const api={analyze,batch,session,encode,decode,canonical};
export default api;



