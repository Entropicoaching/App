// VA-MARK1. Own pure synthetic measurement contract. No original module imports.
const finite = Number.isFinite;
const need = (ok, why) => { if (!ok) throw new TypeError(why); };
const text = x => typeof x === 'string' && x.trim().length > 0;
const positive = x => finite(x) && x > 0;
const calc = x => { need(finite(x), 'numeric_overflow'); return x; };
const scaled = (x, s) => { const v = calc(x * s); need(x === 0 || v !== 0, 'numeric_underflow'); return v; };
export const SCHEMA = 'va-mark1-synthetic/v2';
export function canonical(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  return Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' :
    '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
}
export function validateFixture(f) {
  need(f && f.schema === SCHEMA && f.status === 'synthetic_only', 'synthetic_schema');
  need(text(f.clip_id) && text(f.setup_id) && text(f.revision), 'identity');
  need(f.image && positive(f.image.width) && positive(f.image.height), 'image');
  need(f.axis === 'px_x_right_y_down' && f.time_unit === 's' && f.clock === 'actual_timestamps', 'axis_time_units');
  need(Array.isArray(f.frames) && f.frames.length >= 2 && f.frames.length <= 1000, 'frames');
  let previous = -1;
  const ids = new Set();
  for (const q of f.frames) {
    need(q && Number.isInteger(q.frame_id) && q.frame_id >= 0 && !ids.has(q.frame_id), 'frame_id');
    ids.add(q.frame_id);
    need(finite(q.t_s) && q.t_s >= 0 && q.t_s > previous, 'actual_time'); previous = q.t_s;
    for (const p of [q.disc, q.automatic]) {
      need(p === null || inImage(p, f.image), 'point_bounds');
    }
    need(positive(q.disc_px) && q.disc_px >= 1 && q.disc_px <= Math.min(f.image.width, f.image.height), 'synthetic_disc');
    need(q.disc && q.disc.x >= q.disc_px / 2 && q.disc.x + q.disc_px / 2 <= f.image.width &&
      q.disc.y >= q.disc_px / 2 && q.disc.y + q.disc_px / 2 <= f.image.height, 'disc_bounds');
  }
  return f;
}
function inImage(p, image) {
  return p && finite(p.x) && finite(p.y) && p.x >= 0 && p.x <= image.width && p.y >= 0 && p.y <= image.height;
}
export function createSession(f) {
  validateFixture(f);
  return { schema: SCHEMA, basis: canonical(f), calibration: null,
    marks: f.frames.map(q => ({ frame_id: q.frame_id, t_s: q.t_s, point: null })), locked: false };
}
export function validateSession(f, s) {
  validateFixture(f);
  need(s && s.schema === SCHEMA && s.basis === canonical(f), 'basis_mismatch');
  need(typeof s.locked === 'boolean', 'session_header');
  if (s.calibration !== null) validateCalibration(f, s.calibration);
  need(Array.isArray(s.marks) && s.marks.length === f.frames.length, 'sample_coverage');
  s.marks.forEach((q, i) => {
    need(q && q.frame_id === f.frames[i].frame_id && q.t_s === f.frames[i].t_s, 'frame_time_alignment');
    need(q.point === null || inImage(q.point, f.image), 'manual_point_bounds');
  });
  return s;
}
export function mark(f, s, index, point) {
  validateSession(f, s);
  need(Number.isInteger(index) && index >= 0 && index < f.frames.length, 'frame_selection');
  need(point === null || inImage(point, f.image), 'manual_point_bounds');
  return { ...s, locked: false, marks: s.marks.map((q, i) => i === index ? { ...q, point: point && { x: point.x, y: point.y } } : q) };
}
// Only a marked diameter in source image coordinates can establish the fixed 45 cm scale.
export function validateCalibration(f, c) {
  need(c && c.unit === 'cm_per_px' && c.disc_cm === 45, 'calibration_mismatch');
  const q = f.frames.find(q => q.frame_id === c.frame_id);
  need(q && Array.isArray(c.endpoints) && c.endpoints.length === 2, 'calibration_frame');
  const [a, b] = c.endpoints;
  need(inImage(a, f.image) && inImage(b, f.image), 'diameter_bounds');
  const dx = a.x - b.x, dy = a.y - b.y, px = Math.hypot(dx, dy);
  // Geometric interval: at least one source pixel, at most the shorter image side.
  // Technical click acceptance: center <= 3 source pixels, diameter error <= 5 percent.
  // These choices do not establish physical measurement accuracy.
  need(finite(px) && px >= 1 && px <= Math.min(f.image.width, f.image.height), 'diameter_interval');
  const centerError = Math.hypot((a.x + b.x) / 2 - q.disc.x, (a.y + b.y) / 2 - q.disc.y);
  const diameterError = Math.abs(px - q.disc_px);
  need(centerError <= 3 && diameterError <= q.disc_px * 0.05 &&
    c.disc_px === px, 'calibration_mismatch');
  return c;
}
export function calibrate(f, s, frame_id, endpoints) {
  validateSession(f, s);
  need(Array.isArray(endpoints) && endpoints.length === 2, 'diameter_mark_required');
  const [a, b] = endpoints;
  need(inImage(a, f.image) && inImage(b, f.image), 'diameter_bounds');
  const calibration = { disc_cm: 45, disc_px: Math.hypot(a.x - b.x, a.y - b.y), frame_id,
    endpoints: endpoints.map(p => ({ x: p.x, y: p.y })), unit: 'cm_per_px' };
  validateCalibration(f, calibration);
  return { ...s, locked: false, calibration };
}
export function clearCalibration(f, s) {
  validateSession(f, s);
  return { ...s, locked: false, calibration: null };
}
export function lock(f, s) {
  validateSession(f, s);
  need(s.marks.every(q => q.point !== null), 'missing_manual');
  need(s.calibration !== null, 'missing_calibration');
  return { ...s, locked: true };
}
function stats(xs) {
  return { max_abs: Math.max(...xs.map(Math.abs)), rmse: calc(Math.hypot(...xs) / Math.sqrt(xs.length)) };
}
export function compare(f, s) {
  const empty = reason => ({ status: 'INCOMPLETE', reason, position: null, velocity: null, residuals: [], intervals: [], physical_vc_pass: false, uncertainty: null });
  try { validateSession(f, s); } catch (e) { return empty(e.message); }
  if (!s.locked) return empty('manual_not_locked');
  if (!s.marks.every(q => q.point)) return empty('missing_manual');
  if (!f.frames.every(q => q.automatic)) return empty('missing_automatic');
  if (s.calibration === null) return empty('missing_calibration');
  try {
    const scale = calc(s.calibration.disc_cm / s.calibration.disc_px);
    need(scale > 0, 'scale_underflow');
    const residuals = f.frames.map((q, i) => {
      const m = s.marks[i].point;
      const dx_cm = scaled(q.automatic.x - m.x, scale), dy_cm = scaled(q.automatic.y - m.y, scale);
      return { frame_id: q.frame_id, t_s: q.t_s, dx_cm, dy_cm, distance_cm: calc(Math.hypot(dx_cm, dy_cm)) };
    });
    const intervals = f.frames.slice(1).map((q, i) => {
      const dt_s = calc(q.t_s - f.frames[i].t_s);
      const speed = dy => {
        const value = calc(scaled(dy, scale) / 100 / dt_s);
        need(dy === 0 || value !== 0, 'numeric_underflow'); return value;
      };
      const manual_m_s = speed(s.marks[i].point.y - s.marks[i + 1].point.y);
      const automatic_m_s = speed(f.frames[i].automatic.y - q.automatic.y);
      return { from: f.frames[i].frame_id, to: q.frame_id, dt_s, manual_m_s, automatic_m_s, error_m_s: calc(automatic_m_s - manual_m_s) };
    });
    const position = { ...stats(residuals.map(q => q.distance_cm)), unit: 'cm', limit: 1 };
    const vertical = { ...stats(residuals.map(q => q.dy_cm)), unit: 'cm', limit: 1 };
    const velocity = { ...stats(intervals.map(q => q.error_m_s)), unit: 'm/s', limit: 0.05 };
    // Conservative 2D position gate also guarantees the pinned vertical position gate.
    const status = position.max_abs <= 1 && velocity.max_abs <= 0.05 ? 'PASS' : 'FAIL';
    return { status, reason: 'synthetic_nominal_only', position, vertical, velocity, residuals, intervals,
      cm_per_px: scale, velocity_axis: 'vertical_up_positive', uncertainty: null, physical_vc_pass: false };
  } catch (e) { return empty(e.message); }
}
// Recompute from fixture/session pairs; caller-supplied status strings are never evidence.
export function aggregate(trials) {
  const empty = reason => ({ status: 'INCOMPLETE', reason, physical_vc_pass: false });
  if (!Array.isArray(trials) || trials.length !== 3) return empty('exactly_three_clips_required');
  try {
    const ids = new Set();
    const results = trials.map(t => {
      validateSession(t.fixture, t.session);
      need(!ids.has(t.fixture.clip_id), 'duplicate_clip'); ids.add(t.fixture.clip_id);
      return compare(t.fixture, t.session);
    });
    const status = results.some(r => r.status === 'INCOMPLETE') ? 'INCOMPLETE' :
      results.some(r => r.status === 'FAIL') ? 'FAIL' : 'PASS';
    return { status, clips: results.map((r, i) => ({ clip_id: trials[i].fixture.clip_id, status: r.status })),
      physical_vc_pass: false };
  } catch (e) { return empty(e.message); }
}
// SVG preserveAspectRatio=xMidYMid meet, including letterboxing. Source pixels stay isotropic.
export function pointerPoint(rect, image, clientX, clientY) {
  need(rect && positive(rect.width) && positive(rect.height) && finite(rect.left) && finite(rect.top), 'viewport');
  need(image && positive(image.width) && positive(image.height) && finite(clientX) && finite(clientY), 'pointer');
  const scale = Math.min(rect.width / image.width, rect.height / image.height);
  const x = (clientX - rect.left - (rect.width - image.width * scale) / 2) / scale;
  const y = (clientY - rect.top - (rect.height - image.height * scale) / 2) / scale;
  return inImage({ x, y }, image) ? { x, y } : null;
}
export function save(storage, f, s) {
  try { validateSession(f, s); storage.setItem('VA-MARK1:' + f.clip_id, JSON.stringify({ session: s, integrity: canonical(s) })); return { ok: true }; }
  catch (e) { return { ok: false, reason: e.message }; }
}
export function restore(storage, f) {
  try {
    const raw = storage.getItem('VA-MARK1:' + f.clip_id);
    if (raw === null) return { ok: false, reason: 'no_saved_session' };
    need(typeof raw === 'string' && raw.length <= 500000, 'storage_size');
    const envelope = JSON.parse(raw);
    need(envelope && envelope.integrity === canonical(envelope.session), 'storage_integrity');
    const session = envelope.session; validateSession(f, session);
    return { ok: true, session };
  } catch (e) { return { ok: false, reason: e.message }; }
}
