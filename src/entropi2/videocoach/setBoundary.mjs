import { finite } from './model.mjs'

export const REST_SECONDS = 2.5
export const START_BUFFER_SECONDS = 0.75
const REST_POSITION = { bench: 0, squat: 0, deadlift: 1 }
const REST_TOLERANCE = 0.04, MOTION_THRESHOLD = 0.05, REP_EXCURSION = 0.2
const QUIET_SPEED = 0.05, MAX_SAMPLE_GAP = 0.25

// Synthetic, normalized bar positions: 0 = top, 1 = bottom; seconds, not frames.
// atRest is explicit rest evidence (rack for bench/squat, floor for deadlift).
// Lockout alone is NOT evidence of racking. No camera/media or rest inference.
// Returns the first complete set; sparse/missing observations never prove rest.
export function findSetBoundary({ lift, samples, duration } = {}) {
  if (!Object.hasOwn(REST_POSITION, lift) || !finite(duration) || duration <= 0 || duration > 7200
    || !Array.isArray(samples) || samples.length > 100000)
    throw Error('Sætafgrænsningen mangler gyldige bevægelsesdata.')
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    if (!finite(s?.time) || s.time < 0 || s.time > duration || i > 0 && s.time <= samples[i - 1].time
      || !finite(s.position) || s.position < 0 || s.position > 1 || typeof s.atRest !== 'boolean')
      throw Error('Bevægelsesdata skal have stigende tid, position og hvilemarkering.')
  }
  if (!samples.length) return { status: 'empty', repCount: 0 }
  const distance = sample => Math.abs(sample.position - REST_POSITION[lift])
  if (distance(samples[0]) > REST_TOLERANCE)
    return { status: 'incomplete', reason: 'missing-start', repCount: 0 }
  let firstMotion = null, departure = samples[0].time, inRep = false, excursion = 0, repCount = 0, restSince = null
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i], previous = samples[i - 1], away = distance(s)
    // Backdate confirmation to the last explicit rest observation. A slow
    // departure may take longer than the buffer to cross the motion threshold.
    if (firstMotion === null && s.atRest && away <= REST_TOLERANCE) departure = s.time
    if (away > MOTION_THRESHOLD) {
      if (firstMotion === null) firstMotion = departure
      inRep = true
      excursion = Math.max(excursion, away)
    }
    if (inRep && away <= REST_TOLERANCE) {
      if (excursion >= REP_EXCURSION) repCount++
      inRep = false; excursion = 0
    }
    const gap = s.time - previous.time
    const resting = repCount > 0 && !inRep && s.atRest && previous.atRest
      && away <= REST_TOLERANCE && distance(previous) <= REST_TOLERANCE
      && gap <= MAX_SAMPLE_GAP && Math.abs(s.position - previous.position) / gap <= QUIET_SPEED
    restSince = resting ? restSince ?? previous.time : null
    // Do not treat floating-point error at exactly 2.5 s as an extra sample.
    if (restSince !== null && s.time - restSince > REST_SECONDS + 1e-9) {
      return { status: 'ready', repCount, firstMotion, restSince,
        window: { start: Math.max(0, firstMotion - START_BUFFER_SECONDS), end: s.time } }
    }
  }
  return firstMotion === null ? { status: 'empty', repCount: 0 }
    : { status: 'incomplete', reason: repCount ? 'no-rest' : 'no-rep', repCount,
      firstMotion, start: Math.max(0, firstMotion - START_BUFFER_SECONDS) }
}
