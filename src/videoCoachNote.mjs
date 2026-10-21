// VA-K6: own pure functions. No imports, I/O, clock, storage or program writes.
export const RULESET = 'VA-K4:sha256:4fc05a619006e3d687dea649e9824b88e622a7f9fe1a0abfd06ccaa172f98b33';
const reject = () => { throw new TypeError('Invalid synthetic note or approval basis'); };
const need = x => { if (!x) reject(); };
const exact = (x, ks) => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  Object.keys(x).length === ks.length && ks.every(k => Object.hasOwn(x, k));
const finite = x => { need(Number.isFinite(x)); return x; };
const scaled = (x, s) => { const y = finite(x * s); need(x === 0 || y !== 0); return y; };
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(x);
const line = (x, max) => typeof x === 'string' && x === x.trim() && x.length > 0 && x.length <= max && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(x);
const defs = {
  BAR_FORWARD: ['Stangens fremadrettede forskydning', 3],
  HIP_LEAD: ['Relativ opstigning af hofte mod skulder', 3],
  SPEED_RANGE: ['Variation i intervalhastighed', 0.15],
  KNEE_REVERSAL: ['Fald i indre knaevinkel', 10],
};
// Sorted JSON data only; reject lossy JS values rather than silently drop them.
export function canonical(x) {
  if (x === null || typeof x === 'boolean' || typeof x === 'string') return JSON.stringify(x);
  if (typeof x === 'number') { finite(x); return JSON.stringify(x); }
  if (Array.isArray(x)) { need(Object.keys(x).length === x.length); return '[' + Array.from(x, canonical).join(',') + ']'; }
  need(x && typeof x === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(x)));
  return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
}
const copy = x => JSON.parse(canonical(x));
function target(t) { need(exact(t, ['athlete_id', 'session_id']) && id(t.athlete_id) && id(t.session_id)); }
// Own small nominal-only rule copy from input-01; not the original analyzer.
// All measurement fields are checked, but no uncertainty/physical acceptance is inferred.
function currentFindings(d) {
  const channels = ['bar_x_px','bar_y_px','hip_y_px','shoulder_y_px','knee_deg'];
  const errors = ['x_px','y_px','body_y_px','knee_deg','scale_cm_per_px','time_s'];
  need(exact(d, ['schema','status','lift','setup_id','units','phase','cm_per_px','uncertainty','samples']));
  need(d.schema === 'va-k4-synthetic/v1' && d.status === 'synthetic_only' && ['bench','squat','deadlift'].includes(d.lift));
  need(typeof d.setup_id === 'string' && d.setup_id.trim().length > 0);
  need(exact(d.units, ['time','position','angle','scale']) && d.units.time === 's' && d.units.position === 'px_x_anterior_y_down' && d.units.angle === 'deg_inner_0_180' && d.units.scale === 'cm_per_px');
  const s = d.cm_per_px;
  need(s === null || (Number.isFinite(s) && s > 0));
  need(exact(d.uncertainty, errors));
  for (const k of errors) need(d.uncertainty[k] === null || (Number.isFinite(d.uncertainty[k]) && d.uncertainty[k] >= 0));
  if (s !== null && d.uncertainty.scale_cm_per_px !== null) need(d.uncertainty.scale_cm_per_px < s);
  need(Array.isArray(d.samples) && d.samples.length >= 2 && d.samples.length <= 10000);
  for (let i = 0; i < d.samples.length; i++) {
    const q = d.samples[i]; need(exact(q, ['t_s','valid',...channels]) && q.valid === true && Number.isFinite(q.t_s) && q.t_s >= 0 && (i === 0 || q.t_s > d.samples[i-1].t_s));
    for (const k of channels) need(q[k] === null || (Number.isFinite(q[k]) && (k !== 'knee_deg' || (q[k] >= 0 && q[k] <= 180))));
  }
  need(exact(d.phase, ['name','start','end']) && d.phase.name === 'concentric' && Number.isInteger(d.phase.start) && Number.isInteger(d.phase.end) && d.phase.start >= 0 && d.phase.end < d.samples.length && d.phase.start < d.phase.end);
  const p = d.samples.slice(d.phase.start, d.phase.end + 1);
  const all = (...ks) => ks.every(k => p.every(q => q[k] !== null));
  const max = xs => Math.max(...xs.map(finite));
  const values = {};
  if (s !== null && all('bar_x_px')) values.BAR_FORWARD = Math.max(0, max(p.map(q => scaled(finite(q.bar_x_px - p[0].bar_x_px), s))));
  if (d.lift !== 'bench' && s !== null && all('hip_y_px','shoulder_y_px')) values.HIP_LEAD = Math.max(0, max(p.map(q => scaled(finite(finite(p[0].hip_y_px-q.hip_y_px)-finite(p[0].shoulder_y_px-q.shoulder_y_px)), s))));
  if (s !== null && all('bar_y_px')) {
    const vs = p.slice(1).map((q, i) => { const dy = finite(p[i].bar_y_px-q.bar_y_px), dt = finite(q.t_s-p[i].t_s), v = finite(scaled(dy, s)/100/dt); need(dy === 0 || v !== 0); return v; });
    values.SPEED_RANGE = finite(max(vs)-Math.min(...vs));
  }
  if (d.lift !== 'bench' && all('knee_deg')) values.KNEE_REVERSAL = Math.max(0, max(p.slice(1).map((q, i) => finite(p[i].knee_deg-q.knee_deg))));
  return Object.keys(defs).filter(k => Object.hasOwn(values, k) && values[k] > defs[k][1]);
}
function review(r) {
  need(exact(r, ['schema','status','ruleset','basis','batch','answers','physical_vc_pass','technique_acceptance','five_real_clips_accepted']));
  need(r.schema === 'va-k5-review/v1' && r.status === 'synthetic_only' && r.ruleset === RULESET && r.physical_vc_pass === false && r.technique_acceptance === false && r.five_real_clips_accepted === false);
  const b = r.batch;
  need(exact(b, ['schema','status','clips']) && b.schema === 'va-k5-batch/v1' && b.status === 'synthetic_only' && Array.isArray(b.clips) && b.clips.length >= 1 && b.clips.length <= 5);
  need(r.basis === canonical(b));
  const clips = new Map();
  for (const c of b.clips) {
    need(exact(c, ['clip_id','measurement']) && line(c.clip_id, 120) && !clips.has(c.clip_id));
    clips.set(c.clip_id, currentFindings(c.measurement));
  }
  need(Array.isArray(r.answers));
  const seen = new Set();
  for (const a of r.answers) {
    need(exact(a, ['clip_id','finding_id','decision','comment']) && clips.get(a.clip_id)?.includes(a.finding_id));
    need(['enig','uenig','kommentar'].includes(a.decision) && typeof a.comment === 'string' && a.comment.length <= 2000 && (a.decision !== 'kommentar' || a.comment.trim().length > 0));
    const key = canonical([a.clip_id, a.finding_id]); need(!seen.has(key)); seen.add(key);
  }
  return clips;
}
function request(q) {
  need(exact(q, ['schema','status','target','review','clip_id','finding_ids','cue']));
  need(q.schema === 'va-k6-request/v1' && q.status === 'synthetic_only'); target(q.target);
  const clips = review(q.review);
  need(clips.has(q.clip_id) && Array.isArray(q.finding_ids) && q.finding_ids.length >= 1 && q.finding_ids.length <= 4 && new Set(q.finding_ids).size === q.finding_ids.length);
  for (const f of q.finding_ids) need(clips.get(q.clip_id).includes(f) && q.review.answers.some(a => a.clip_id === q.clip_id && a.finding_id === f && a.decision === 'enig'));
  // One explicitly entered cue, never inferred from findings or comments.
  need(line(q.cue, 160));
}
export function approvalBasis(q) { const clean = copy(q); request(clean); return canonical(clean); }
export function createCoachNote(q, receipt) {
  const clean = copy(q); request(clean);
  // Missing/rejected/unknown/indirect approval never yields a note.
  if (receipt == null) return null;
  const a = copy(receipt);
  need(exact(a, ['schema','status','actor','method','decision','basis']));
  need(a.schema === 'va-k6-direct-approval/v1' && a.status === 'synthetic_only');
  if (a.actor !== 'Marc' || a.method !== 'direct' || a.decision !== 'enig') return null;
  need(a.basis === canonical(clean));
  const text = 'Syntetisk tekniknote: ' + clean.finding_ids.map(f => defs[f][0]).join('; ') + '. Cue: ' + clean.cue;
  return { schema: 'va-k6-note/v1', status: 'synthetic_only', target: copy(clean.target), request: clean, approval: a, text };
}
// Fail closed in views: exact payload validation, target isolation, conflicts hidden.
export function noteForSession(notes, t) {
  try {
    target(t); need(Array.isArray(notes));
    const hits = notes.filter(n => n?.target?.athlete_id === t.athlete_id && n?.target?.session_id === t.session_id);
    if (hits.length !== 1) return null;
    const n = hits[0]; need(exact(n, ['schema','status','target','request','approval','text']));
    const rebuilt = createCoachNote(n.request, n.approval);
    need(rebuilt !== null && canonical(n) === canonical(rebuilt));
    return rebuilt.text;
  } catch { return null; }
}
// React's createElement is injected; the same small renderer is tested with a DOM fake.
export function renderCoachNote(h, notes, t) {
  const text = noteForSession(notes, t);
  return text === null ? null : h('aside', { 'aria-label': 'Tekniknote til passet', style: { overflowWrap: 'anywhere', marginBottom: '0.75rem' } },
    h('strong', null, 'Tekniknote'), h('p', { style: { whiteSpace: 'pre-wrap' } }, text));
}
