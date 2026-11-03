const STEP = 2.5
const RAMPS = {
  3: [[40, 5], [60, 3], [80, 1]],
  4: [[40, 5], [55, 4], [70, 3], [85, 1]],
  5: [[35, 5], [50, 4], [65, 3], [80, 2], [90, 1]],
}

/**
 * Standalone suggestion from today's first work set, supplied by the caller.
 * Contract: { weight: number } in total kg, already normalized by the adapter.
 * No exercise/equipment minimum is inferred. Below 10 kg there is no room for
 * three distinct positive 2.5 kg steps below the work weight, so return [].
 * Percent is calculated from the rounded kg; targetPercent is the ramp target.
 */
export function warmupSets(firstWorkSet) {
  const weight = firstWorkSet?.weight
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 10 ||
      !Number.isSafeInteger(Math.round(weight * 100))) return []

  const count = weight < 80 ? 3 : weight < 160 ? 4 : 5
  const ramp = RAMPS[count]
  const highestUnit = Math.ceil(weight / STEP) - 1
  let previousUnit = 0
  return ramp.map(([targetPercent, reps], index) => {
    // Reserve room for the remaining steps. Small loads can round to the same
    // kg, but the suggested ramp must stay distinct and below the work set.
    const unit = Math.max(previousUnit + 1, Math.min(
      Math.round((weight / STEP) * (targetPercent / 100)),
      highestUnit - (count - index - 1),
    ))
    previousUnit = unit
    const roundedWeight = unit * STEP
    return { weight: roundedWeight, reps, targetPercent,
      percent: Math.round((roundedWeight / weight) * 100) }
  })
}
