// Pure, opt-in calculation. No persistence, feature flags or UI dependencies.
// Input is one exercise occurrence from one completed week, in kg:
// { weight, plannedSets, targetReps, sets: [{ weight, reps, rpe }] }.
// Numbers must already be parsed; warmups and unconfirmed logs must be excluded.
// Use separate calls for different prescriptions/sessions; never merge by name.
const MAX_CENTS = 1e12
const cents = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  const scaled = value * 100, rounded = Math.round(scaled)
  return rounded <= MAX_CENTS && Math.abs(scaled - rounded) < 0.000001 ? rounded : null
}
const positiveInteger = value => Number.isSafeInteger(value) && value > 0

/**
 * Returns { weight, changePercent, action, reasonCode, reason }.
 * Invalid reference weight yields null weight (no usable suggestion).
 * incrementKg defaults to 2.5; weights/increments support hundredths of kg.
 * Increases round down, reductions round up: neither direction exceeds 5%.
 * A suggestion is advisory and requires coach review before any later write.
 */
export function suggestNextWeekLoad(lastWeek, { incrementKg = 2.5 } = {}) {
  const baseline = cents(lastWeek?.weight)
  const result = (next, reasonCode, reason) => ({
    weight: next == null ? null : next / 100,
    changePercent: baseline > 0 ? (next - baseline) / baseline * 100 : 0,
    action: next == null ? 'unavailable' : next > baseline ? 'increase' : next < baseline ? 'reduce' : 'hold',
    reasonCode, reason,
  })
  const hold = (code, reason) => result(baseline, code, reason)
  if (baseline == null) return result(null, 'invalid_weight', 'Ingen brugbar vægt. Kontrollér sidste uges vægt.')
  const step = cents(incrementKg)
  if (!step) return hold('invalid_increment', 'Behold vægten. Vælg et positivt vægttrin i hele hundrededele kg.')
  if (baseline === 0) return hold('zero_weight', 'Behold vægten. Nul kg giver ikke grundlag for procentvis progression.')
  const { plannedSets, targetReps, sets } = lastWeek
  if (!positiveInteger(plannedSets) || !positiveInteger(targetReps) || !Array.isArray(sets) || sets.length !== plannedSets) {
    return hold('incomplete_week', 'Behold vægten. Der mangler en fuld uge med planlagte sæt og repsmål.')
  }
  // Array.from includes sparse entries, so holes cannot pass Array.every.
  const rows = Array.from(sets)
  if (!rows.every(set => set && cents(set.weight) != null && positiveInteger(set.reps) &&
    typeof set.rpe === 'number' && Number.isFinite(set.rpe) && set.rpe >= 0 && set.rpe <= 10)) {
    return hold('invalid_set', 'Behold vægten. Alle sæt skal have gyldig vægt, reps og RPE fra 0 til 10.')
  }
  if (!rows.every(set => cents(set.weight) === baseline)) {
    return hold('mixed_loads', 'Behold vægten. Forskellige sætvægte kræver coachens vurdering.')
  }
  const highEffort = rows.some(set => set.rpe >= 9)
  if (highEffort) {
    const next = Math.ceil((baseline * 95) / (100 * step)) * step
    return next < baseline
      ? result(next, 'high_rpe', 'Foreslå op til 5 % lavere vægt: mindst ét sæt havde RPE 9 eller højere.')
      : hold('step_too_large', 'Behold vægten. Vægttrinnet tillader ikke en reduktion inden for 5 %.')
  }
  if (rows.some(set => set.reps < targetReps)) {
    return hold('reps_not_met', 'Behold vægten. Repsmålet blev ikke nået i alle sæt.')
  }
  if (plannedSets < 2 || rows.some(set => set.rpe > 7)) {
    return hold('maintain', 'Behold vægten. En stigning kræver mindst to sæt med opfyldt repsmål og RPE højst 7.')
  }
  const next = Math.floor((baseline * 1025) / (1000 * step)) * step
  return next > baseline
    ? result(next, 'low_rpe', 'Foreslå op til 2,5 % højere vægt: alle sæt nåede repsmålet med RPE højst 7.')
    : hold('step_too_large', 'Behold vægten. Mindste vægttrin overstiger den forsigtige stigning på 2,5 %.')
}
