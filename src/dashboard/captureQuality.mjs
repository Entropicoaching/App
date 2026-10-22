// VA-PK2: small pure policy. Table values are rounded DOWN in pinned VA-K7.
const limits = Object.freeze({
  40: Object.freeze({0: .145, 5: .138, 10: .119}),
  80: Object.freeze({0: .290, 5: .277, 10: .238}),
  120: Object.freeze({0: .435, 5: .415, 10: .357}),
  200: Object.freeze({0: .726, 5: .693, 10: .595})
})
export const MODEL_NOTE = 'VA-K7 er en syntetisk plan model, ikke en valideret grænse for virkelige optagelser. Fund er ikke sikre; fysisk måleaccept og teknikaccept er false.'
const finite = x => typeof x === 'number' && Number.isFinite(x)
const result = (status, reason, radiusLimitPx = null) => Object.freeze({
  status, reason, radiusLimitPx, certain: false, physical_vc_pass: false,
  technique_acceptance: false, note: MODEL_NOTE
})
// An explicit model declaration is a caller assertion, never proof of real geometry.
// No interpolation, extrapolation, conversion from SD or default zero uncertainty.
export function assessCapture(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return result('unknown', 'missing_capture_parameters')
  const fields = ['model', 'reference', 'disc_px', 'yaw_deg', 'hand_radius_px', 'auto_radius_px']
  if (Object.keys(q).length !== fields.length || !fields.every(k => Object.hasOwn(q, k))) return result('unknown', 'invalid_capture_parameters')
  if (![q.disc_px, q.yaw_deg, q.hand_radius_px, q.auto_radius_px].every(finite) ||
      q.disc_px <= 0 || q.hand_radius_px < 0 || q.auto_radius_px < 0) return result('unknown', 'invalid_capture_parameters')
  if (q.model !== 'VA-K7-15-poses-4-rotations-isotropic-planar/v1' || q.reference !== 'perpendicular') return result('unknown', 'unsupported_model_or_reference')
  if (Math.abs(q.yaw_deg) > 10) return result('outside_model', 'camera_angle_outside_model')
  if (q.disc_px < 40) return result('outside_model', 'disc_below_model_grid')
  const row = limits[q.disc_px]
  const radius = row && row[Math.abs(q.yaw_deg)]
  if (radius === undefined) return result('unknown', 'unsupported_grid_point')
  // The stricter of ALL five joints. Unequal radii use the larger budget.
  if (Math.max(q.hand_radius_px, q.auto_radius_px) > radius) return result('outside_model', 'radial_budget_not_certified', radius)
  return result('within_synthetic_model', 'conditional_table_budget_only', radius)
}
export function captureWarning(q) {
  const a = assessCapture(q)
  const text = a.status === 'outside_model'
    ? 'Advarsel: Målingen ligger uden for VA-K7-modellens dækkede budget. Fund må ikke læses som sikre.'
    : a.status === 'within_synthetic_model'
      ? 'Kun inden for det erklærede syntetiske modelbudget. Det godkender ikke en virkelig optagelse eller et fund.'
      : 'Advarsel: Kameravinkel, skivepixels og punktfejlbudget er ukendte eller udækkede. Målingen kan ikke godkendes; fund må ikke læses som sikre.'
  return text + ' ' + MODEL_NOTE
}
export function gateAssessments(assessments, q = null) {
  const capture_quality = assessCapture(q)
  // K7 bounds joint angles only. It cannot certify the K4 displacement/speed or
  // technique thresholds, even when its synthetic angle budget is satisfied.
  return assessments.map(a => ({...a, robust_exceeds: null, certain: false,
    capture_quality, certainty_note: captureWarning(q)}))
}
