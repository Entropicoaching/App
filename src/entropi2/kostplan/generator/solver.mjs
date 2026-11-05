// Bounded least squares in 5 g units. No random starts, clock or external state.
const dot = (a, b) => a.reduce((sum, value, k) => sum + value * b[k], 0)
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const score = residual => dot(residual, residual)
const EPS = 1e-12

export function solvePortions(rows, targets, tolerance) {
  const columns = rows.map(row => row.macros.map((value, k) => value * 0.05 / tolerance[k]))
  const wanted = targets.map((value, k) => value / tolerance[k])
  const low = rows.map(row => row.minGrams / 5)
  const high = rows.map(row => row.maxGrams / 5)
  // Preferred foods get first access to the residual. Identical foods therefore
  // favour the requested priority; preferences never override portion limits.
  const order = rows.map((_, i) => i).sort((a, b) => rows[b].priority - rows[a].priority || a - b)
  const residualFor = units => wanted.map((target, k) =>
    columns.reduce((sum, column, i) => sum + column[k] * units[i], -target))
  const preference = units => units.reduce((sum, value, i) => sum + value * rows[i].priority, 0)
  let best = null
  for (const fraction of [0, 0.5, 1]) {
    const units = low.map((value, i) => value + (high[i] - value) * fraction)
    let residual = residualFor(units)
    const change = (i, delta) => {
      units[i] += delta
      residual = residual.map((value, k) => value + columns[i][k] * delta)
    }
    // Exact coordinate minimisers of the continuous convex objective.
    for (let sweep = 0; sweep < 300; sweep++) {
      let movement = 0
      for (const i of order) {
        const norm = dot(columns[i], columns[i])
        if (!norm) continue
        const next = clamp(units[i] - dot(columns[i], residual) / norm, low[i], high[i])
        const delta = next - units[i]
        movement = Math.max(movement, Math.abs(delta))
        change(i, delta)
      }
      if (movement < 1e-7) break
    }
    units.forEach((value, i) => { units[i] = clamp(Math.round(value), low[i], high[i]) })
    residual = residualFor(units)
    // Coordinate jumps plus two-coordinate 5 g moves escape rounding stalls.
    // Strict score descent and a fixed budget keep the search bounded.
    for (let sweep = 0; sweep < 100; sweep++) {
      let improved = false
      for (const i of order) {
        const norm = dot(columns[i], columns[i])
        if (!norm) continue
        const next = clamp(Math.round(units[i] - dot(columns[i], residual) / norm), low[i], high[i])
        const delta = next - units[i]
        const trial = residual.map((value, k) => value + columns[i][k] * delta)
        if (score(trial) < score(residual) - EPS) { change(i, delta); improved = true }
      }
      let pair = null, pairScore = score(residual)
      for (let a = 0; a < order.length; a++) {
        const i = order[a]
        for (let b = a + 1; b < order.length; b++) {
          const j = order[b]
          for (const di of [-1, 1]) for (const dj of [-1, 1]) {
            if (units[i] + di < low[i] || units[i] + di > high[i]
              || units[j] + dj < low[j] || units[j] + dj > high[j]) continue
            const value = score(residual.map((r, k) => r + columns[i][k] * di + columns[j][k] * dj))
            if (value < pairScore - EPS) { pair = [i, di, j, dj]; pairScore = value }
          }
        }
      }
      if (pair) { change(pair[0], pair[1]); change(pair[2], pair[3]); improved = true }
      if (!improved) break
    }
    // Recompute to avoid accumulated update error in final comparisons.
    const value = score(residualFor(units)), preferred = preference(units)
    if (!best || value < best.score - EPS || (Math.abs(value - best.score) <= EPS && preferred > best.preferred)) {
      best = { units, score: value, preferred }
    }
  }
  return best.units.map(value => value * 5)
}
