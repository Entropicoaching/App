export const PLATES_KG = Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25, 0.5])
const units = PLATES_KG.map(weight => weight * 4)

function weightNumber(value) {
  if (typeof value === 'string') {
    if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null
    value = Number(value.trim().replace(',', '.'))
  }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER / 8 ? value : null
}

// Quarter kilograms per side: 2 and 5 generate all integers except 1 and 3.
const possible = n => Number.isSafeInteger(n) && n >= 0 && n !== 1 && n !== 3

function distribute(n) {
  const counts = units.map(() => 0)
  counts[0] = Math.floor(n / 100)
  let remainder = n % 100
  if (remainder === 1 || remainder === 3) { counts[0]--; remainder += 100 }
  // Solve the small remainder exactly; greedy fails, e.g. for 1.5 kg per side.
  const best = [0], chosen = []
  for (let sum = 1; sum <= remainder; sum++) {
    best[sum] = Infinity
    for (let i = 0; i < units.length; i++) {
      if (sum >= units[i] && best[sum - units[i]] + 1 < best[sum]) {
        best[sum] = best[sum - units[i]] + 1; chosen[sum] = i
      }
    }
  }
  while (remainder > 0) {
    const i = chosen[remainder]
    counts[i]++; remainder -= units[i]
  }
  return PLATES_KG.flatMap((weightKg, i) => counts[i] ? [{ weightKg, count: counts[i] }] : [])
}

/** Unlimited matching pairs of the listed plates. Ties choose the lower total.
 * Invalid input has no suggested load; an under-bar request suggests the bare bar.
 * Returns counts per side, never individual plate arrays or persisted state.
 */
export function calculatePlates(requestedWeight, barWeightKg = 20) {
  const requestedWeightKg = weightNumber(requestedWeight)
  if (requestedWeightKg == null || (barWeightKg !== 20 && barWeightKg !== 15)) {
    return { status: 'invalid', requestedWeightKg, barWeightKg, nearestWeightKg: null, platesPerSide: [] }
  }
  const target = Math.max(0, (requestedWeightKg - barWeightKg) * 2)
  const center = Math.round(target)
  let nearest = 0, distance = Infinity
  for (let n = Math.max(0, center - 3); n <= center + 3; n++) {
    if (possible(n) && Math.abs(n - target) < distance) {
      nearest = n; distance = Math.abs(n - target)
    }
  }
  const nearestWeightKg = barWeightKg + nearest / 2
  const exact = nearestWeightKg === requestedWeightKg
  return {
    status: requestedWeightKg < barWeightKg ? 'below-bar' : exact ? 'exact' : 'nearest',
    requestedWeightKg, barWeightKg, nearestWeightKg, platesPerSide: distribute(nearest),
  }
}
