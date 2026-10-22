// Own pure VA-MARK2 synthetic contract. Original full modules remain inert.
const need = (ok, why) => { if (!ok) throw new TypeError(why); };
const finite = Number.isFinite;
const positive = x => finite(x) && x > 0;
const text = x => typeof x === 'string' && x.trim().length > 0;
export const SCHEMA = 'va-mark2-synthetic/v1';
export const JOINTS = Object.freeze(['shoulder', 'hip', 'knee', 'ankle', 'toe', 'elbow']);
export const DEFINITIONS = Object.freeze({
  hip: Object.freeze(['shoulder', 'hip', 'knee']), knee: Object.freeze(['hip', 'knee', 'ankle']),
  ankle: Object.freeze(['knee', 'ankle', 'toe']), shoulder: Object.freeze(['elbow', 'shoulder', 'hip'])
});
export const LIMIT_DEG = 5;
export function canonical(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  return Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' :
    '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
}
const point = p => p && finite(p.x) && finite(p.y);
const inImage = (p, image) => point(p) && p.x >= 0 && p.y >= 0 && p.x <= image.width && p.y <= image.height;
// Interior projected 2D angle at b. Normalized vectors avoid product overflow.
// Below 1e-9 source pixels is degenerate, matching the pinned angleAt floor.
export function angleDeg(a, b, c) {
  need(point(a) && point(b) && point(c), 'missing_joint');
  const ux = a.x-b.x, uy = a.y-b.y, vx = c.x-b.x, vy = c.y-b.y;
  const u = Math.hypot(ux, uy), v = Math.hypot(vx, vy);
  need(finite(u) && finite(v) && u >= 1e-9 && v >= 1e-9, 'degenerate_vector');
  return Math.atan2(Math.abs((ux/u)*(vy/v)-(uy/u)*(vx/v)),
    Math.max(-1, Math.min(1, (ux/u)*(vx/v)+(uy/u)*(vy/v)))) * 180/Math.PI;
}
export function angles(pose) {
  return Object.fromEntries(Object.entries(DEFINITIONS).map(([name, keys]) =>
    [name, angleDeg(...keys.map(k => pose?.[k]))]));
}
export function validateFixture(f) {
  need(f && f.schema === SCHEMA && f.status === 'synthetic_only', 'synthetic_schema');
  need(text(f.clip_id) && f.clip_id === f.clip_id.trim() && text(f.setup_id) && text(f.revision), 'identity');
  need(['squat','bench','deadlift'].includes(f.lift) && f.side === 'left', 'lift_side');
  need(f.image && positive(f.image.width) && positive(f.image.height), 'image');
  need(f.axis === 'px_x_right_y_down' && f.time_unit === 's' && f.clock === 'actual_timestamps', 'axis_time_units');
  need(Array.isArray(f.frames) && f.frames.length >= 2 && f.frames.length <= 1000, 'frames');
  let previous = -1;
  const ids = new Set();
  for (const q of f.frames) {
    need(q && Number.isInteger(q.frame_id) && q.frame_id >= 0 && !ids.has(q.frame_id), 'frame_id');
    ids.add(q.frame_id);
    need(finite(q.t_s) && q.t_s > previous && q.t_s >= 0, 'actual_time'); previous = q.t_s;
    need(inImage(q.disc, f.image) && positive(q.disc_px) && q.disc_px >= 1 &&
      q.disc_px <= Math.min(f.image.width, f.image.height), 'synthetic_disc');
    need(q.disc.x >= q.disc_px/2 && q.disc.x+q.disc_px/2 <= f.image.width &&
      q.disc.y >= q.disc_px/2 && q.disc.y+q.disc_px/2 <= f.image.height, 'disc_bounds');
    for (const k of JOINTS) {
      need(q.truth && inImage(q.truth[k], f.image), 'truth_bounds');
      need(q.model && (q.model[k] === null || inImage(q.model[k], f.image)), 'model_bounds');
    }
    angles(q.truth);
  }
  return f;
}
export function createSession(f) {
  validateFixture(f);
  return { schema: SCHEMA, basis: canonical(f), locked: false, calibration: null,
    marks: f.frames.map(q => ({ frame_id: q.frame_id, t_s: q.t_s,
      pose: Object.fromEntries(JOINTS.map(k => [k, null])) })) };
}
// Deliberate pure copy of VA-MARK1 calibration geometry and inclusive tolerances.
export function validateCalibration(f, c) {
  need(c && c.unit === 'cm_per_px' && c.disc_cm === 45, 'calibration_mismatch');
  const q = f.frames.find(q => q.frame_id === c.frame_id);
  need(q && Array.isArray(c.endpoints) && c.endpoints.length === 2, 'calibration_frame');
  const [a,b] = c.endpoints;
  need(inImage(a,f.image) && inImage(b,f.image), 'diameter_bounds');
  const px = Math.hypot(a.x-b.x,a.y-b.y);
  need(finite(px) && px >= 1 && px <= Math.min(f.image.width,f.image.height), 'diameter_interval');
  const centerError = Math.hypot((a.x+b.x)/2-q.disc.x,(a.y+b.y)/2-q.disc.y);
  need(centerError <= 3 && Math.abs(px-q.disc_px) <= q.disc_px*0.05 && c.disc_px === px, 'calibration_mismatch');
  return c;
}
export function validateSession(f,s) {
  validateFixture(f);
  need(s && s.schema === SCHEMA && s.basis === canonical(f), 'basis_mismatch');
  need(typeof s.locked === 'boolean', 'session_header');
  if (s.calibration !== null) validateCalibration(f,s.calibration);
  need(Array.isArray(s.marks) && s.marks.length === f.frames.length, 'sample_coverage');
  s.marks.forEach((m,i) => {
    need(m && m.frame_id === f.frames[i].frame_id && m.t_s === f.frames[i].t_s, 'frame_time_alignment');
    for (const k of JOINTS) need(m.pose && (m.pose[k] === null || inImage(m.pose[k],f.image)), 'manual_bounds');
  });
  return s;
}
export function mark(f,s,index,joint,p) {
  validateSession(f,s);
  need(Number.isInteger(index) && index >= 0 && index < f.frames.length && JOINTS.includes(joint), 'selection');
  need(p === null || inImage(p,f.image), 'manual_bounds');
  return { ...s, locked: false, marks: s.marks.map((m,i) => i === index ?
    { ...m, pose: { ...m.pose, [joint]: p && {x:p.x,y:p.y} } } : m) };
}
export function calibrate(f,s,frame_id,endpoints) {
  validateSession(f,s);
  need(Array.isArray(endpoints) && endpoints.length === 2 && endpoints.every(p => inImage(p,f.image)), 'diameter_mark_required');
  const [a,b] = endpoints;
  const calibration = { disc_cm:45, unit:'cm_per_px', frame_id,
    disc_px:Math.hypot(a.x-b.x,a.y-b.y), endpoints:endpoints.map(p=>({x:p.x,y:p.y})) };
  validateCalibration(f,calibration);
  return {...s,locked:false,calibration};
}
export function clearCalibration(f,s) {
  validateSession(f,s); return {...s,locked:false,calibration:null};
}
export function lock(f,s) {
  validateSession(f,s);
  need(s.calibration !== null,'missing_calibration');
  s.marks.forEach(m=>angles(m.pose));
  return {...s,locked:true};
}
const incomplete = reason => ({status:'INCOMPLETE',label:'UFULDSTAENDIG',reason,physical_vc_pass:false,residuals:[],metrics:null});
export function compare(f,s) {
  try {
    validateSession(f,s);
    need(s.locked,'manual_not_locked'); need(s.calibration !== null,'missing_calibration');
    const residuals = f.frames.flatMap((q,i)=> {
      const manual = angles(s.marks[i].pose), model = angles(q.model);
      return Object.keys(DEFINITIONS).map(joint=>({frame_id:q.frame_id,t_s:q.t_s,joint,
        manual_deg:manual[joint],model_deg:model[joint],error_deg:model[joint]-manual[joint],
        abs_error_deg:Math.abs(model[joint]-manual[joint])}));
    });
    const errors = residuals.map(r=>r.abs_error_deg);
    const metrics = {max_abs_deg:Math.max(...errors),rmse_deg:Math.hypot(...errors)/Math.sqrt(errors.length),limit_deg:LIMIT_DEG};
    const status = metrics.max_abs_deg <= LIMIT_DEG ? 'PASS':'FAIL';
    return {status,label:status,reason:'synthetic_nominal_only',physical_vc_pass:false,residuals,metrics,
      cm_per_px:45/s.calibration.disc_px,angle_unit:'deg',uncertainty:null};
  } catch(e) { return incomplete(e.message); }
}
export function aggregate(trials) {
  if (!Array.isArray(trials) || trials.length !== 3) return incomplete('exactly_three_clips_required');
  try {
    const ids = new Set();
    const results = trials.map(t=> {
      validateSession(t.fixture,t.session);
      need(!ids.has(t.fixture.clip_id),'duplicate_clip'); ids.add(t.fixture.clip_id);
      return compare(t.fixture,t.session);
    });
    if (results.some(r=>r.status === 'INCOMPLETE')) return {...incomplete('invalid_clip'),clips:results};
    const status = results.some(r=>r.status === 'FAIL') ? 'FAIL':'PASS';
    return {status,label:status,physical_vc_pass:false,clips:results.map((r,i)=>({clip_id:trials[i].fixture.clip_id,...r}))};
  } catch(e) { return incomplete(e.message); }
}
export function pointerPoint(rect,image,clientX,clientY) {
  need(rect && positive(rect.width) && positive(rect.height) && finite(rect.left) && finite(rect.top),'viewport');
  need(image && positive(image.width) && positive(image.height) && finite(clientX) && finite(clientY),'pointer');
  const scale = Math.min(rect.width/image.width,rect.height/image.height);
  const p = {x:(clientX-rect.left-(rect.width-image.width*scale)/2)/scale,
    y:(clientY-rect.top-(rect.height-image.height*scale)/2)/scale};
  return inImage(p,image) ? p:null;
}
export function save(storage,f,s) {
  try { validateSession(f,s); storage.setItem('VA-MARK2:'+f.clip_id,JSON.stringify({session:s,integrity:canonical(s)})); return {ok:true}; }
  catch(e) {return {ok:false,reason:e.message};}
}
export function restore(storage,f) {
  try {
    const raw = storage.getItem('VA-MARK2:'+f.clip_id);
    need(typeof raw === 'string' && raw.length <= 500000,'storage_size');
    const e = JSON.parse(raw);
    need(e && e.integrity === canonical(e.session),'storage_integrity');
    validateSession(f,e.session);
    return {ok:true,session:e.session};
  } catch(e) {return {ok:false,reason:e.message};}
}
