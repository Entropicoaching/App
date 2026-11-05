// Local signal processing only. Coordinates/diameters are pixels in one fixed
// image plane; times are seconds. This module never reads images or media.
import { finite } from './model.mjs'

const median = values => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const measured = point => finite(point.x) && finite(point.y)
const MAX_GAP = 0.25

function validate(samples, options) {
  if (!Array.isArray(samples) || samples.length > 10000) throw Error('Stangbanen skal have højst 10.000 målepunkter.')
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw Error('Ugyldig kalibrering.')
  const { plateDiameterCm = null, plateDiameterPx = null, maxSpeedPxPerSecond = 800 } = options
  if (plateDiameterCm !== null && plateDiameterCm !== 45
    || plateDiameterPx !== null && (!finite(plateDiameterPx) || plateDiameterPx < 1 || plateDiameterPx > 100000)
    || plateDiameterPx !== null && plateDiameterCm !== 45
    || !finite(maxSpeedPxPerSecond) || maxSpeedPxPerSecond <= 0 || maxSpeedPxPerSecond > 100000)
    throw Error('Brug en kendt skive på 45 cm og en gyldig diameter i pixels.')
  let previous = -1
  for (const point of samples) {
    if (!point || !finite(point.time) || point.time < 0 || point.time > 7200 || point.time <= previous
      || !((point.x == null && point.y == null) || measured(point) && point.x >= 0 && point.y >= 0 && point.x <= 1000000 && point.y <= 1000000)
      || point.confidence !== undefined && (!finite(point.confidence) || point.confidence < 0 || point.confidence > 1)
      || point.diameterPx !== undefined && (!finite(point.diameterPx) || point.diameterPx < 1 || point.diameterPx > 100000))
      throw Error('Målepunkter kræver stigende tid og gyldige koordinater eller et tomt punkt.')
    previous = point.time
  }
  return { plateDiameterCm, plateDiameterPx, maxSpeedPxPerSecond }
}

function calibrationFor(samples, options) {
  if (options.plateDiameterCm !== 45) return { status: 'unknown', cmPerPixel: null }
  if (options.plateDiameterPx !== null)
    return { status: 'known', diameterPx: options.plateDiameterPx, cmPerPixel: 45 / options.plateDiameterPx }
  const diameters = samples.filter(point => point.status === 'tracked' && point.diameterPx !== undefined).map(point => point.diameterPx)
  if (diameters.length < 3) return { status: 'insufficient', cmPerPixel: null }
  const diameterPx = median(diameters)
  // A changing apparent diameter can mean perspective, camera motion or a wrong
  // detection. Do not silently turn an unstable pixel scale into centimetres.
  if (diameters.some(value => Math.abs(value - diameterPx) / diameterPx > 0.15))
    return { status: 'unstable', cmPerPixel: null }
  return { status: 'known', diameterPx, cmPerPixel: 45 / diameterPx }
}

export function analyzeSyntheticBarPath(samples, options = {}) {
  const settings = validate(samples, options)
  let last = null, before = null, segment = -1
  const points = []
  for (const sample of samples) {
    const dt = last ? sample.time - last.time : Infinity
    const reason = !measured(sample) ? 'missing' : (sample.confidence ?? 1) < 0.5 ? 'low-confidence' : null
    const velocity = before && last ? {
      x: (last.x - before.x) / (last.time - before.time),
      y: (last.y - before.y) / (last.time - before.time),
    } : { x: 0, y: 0 }
    // Limit prediction speed even if a noisy pair gives an implausible velocity.
    const speed = Math.hypot(velocity.x, velocity.y)
    const limit = speed > settings.maxSpeedPxPerSecond ? settings.maxSpeedPxPerSecond / speed : 1
    const predicted = last && { x: last.x + velocity.x * limit * dt, y: last.y + velocity.y * limit * dt }
    const radius = Math.max(8, (settings.plateDiameterPx ?? 60) * 0.15) + settings.maxSpeedPxPerSecond * dt
    const rejected = !reason && last && dt <= MAX_GAP && distance(sample, predicted) > radius
    if (reason || rejected) {
      const canEstimate = last && dt <= MAX_GAP && predicted.x >= 0 && predicted.y >= 0
      points.push({ time: sample.time, x: canEstimate ? predicted.x : null, y: canEstimate ? predicted.y : null,
        status: canEstimate ? 'estimated' : 'lost', reason: reason || 'jump', segment,
        uncertaintyPx: canEstimate ? radius : null })
      continue
    }
    if (!last || dt > MAX_GAP) { segment++; before = null }
    else before = last
    const point = { time: sample.time, x: sample.x, y: sample.y, status: 'tracked', segment,
      confidence: sample.confidence ?? 1, ...(sample.diameterPx === undefined ? {} : { diameterPx: sample.diameterPx }) }
    points.push(point); last = point
  }

  // Three-point centred median rejects small isolated spikes, then a symmetric
  // 1:2:1 average reduces jitter without the phase delay of a trailing average.
  // Never smooth across missing samples, a long frame interval or a new segment.
  const adjacent = (a, b) => a?.status === 'tracked' && b?.status === 'tracked'
    && a.segment === b.segment && Math.abs(a.time - b.time) <= 0.1
  const medians = points.map((point, index) => {
    if (!adjacent(points[index - 1], point) || !adjacent(point, points[index + 1])) return { ...point }
    const window = points.slice(index - 1, index + 2)
    return { ...point, x: median(window.map(p => p.x)), y: median(window.map(p => p.y)) }
  })
  const smooth = medians.map((point, index) => {
    if (point.status !== 'tracked') return { ...point }
    const neighbors = medians.slice(Math.max(0, index - 1), index + 2)
    const both = index > 0 && index < medians.length - 1 && adjacent(medians[index - 1], point) && adjacent(point, medians[index + 1])
    const result = both ? { ...point, x: (neighbors[0].x + 2 * point.x + neighbors[2].x) / 4,
      y: (neighbors[0].y + 2 * point.y + neighbors[2].y) / 4 } : { ...point }
    // A heuristic noise indicator, never a statistical accuracy guarantee.
    result.uncertaintyPx = Math.max(1, distance(points[index], result)) + (1 - point.confidence) * 10
    return result
  })

  // Rejoin only a short, gated loss. Interpolated points stay visibly estimated.
  let left = null
  for (let index = 0; index < smooth.length; index++) {
    const right = smooth[index]
    if (right.status !== 'tracked') continue
    if (left !== null && smooth[left].segment === right.segment) {
      const start = smooth[left]
      for (let gap = left + 1; gap < index; gap++) {
        const point = smooth[gap], fraction = (point.time - start.time) / (right.time - start.time)
        if (point.status !== 'estimated') continue
        point.x = start.x + (right.x - start.x) * fraction
        point.y = start.y + (right.y - start.y) * fraction
      }
    }
    left = index
  }
  const calibration = calibrationFor(smooth, settings)
  const observed = smooth.filter(point => point.status === 'tracked')
  const counts = { tracked: observed.length, estimated: smooth.filter(point => point.status === 'estimated').length,
    lost: smooth.filter(point => point.status === 'lost').length, rejected: smooth.filter(point => point.reason === 'jump').length }
  const rangePx = observed.length >= 2 ? Math.max(...observed.map(p => p.y)) - Math.min(...observed.map(p => p.y)) : null
  return { status: !samples.length ? 'empty' : !observed.length ? 'unavailable' : 'ready', points: smooth, counts,
    calibration, segments: segment + 1, maxGapSeconds: MAX_GAP,
    verticalRange: rangePx === null ? null : { value: rangePx * (calibration.cmPerPixel ?? 1), unit: calibration.cmPerPixel === null ? 'px' : 'cm' } }
}
