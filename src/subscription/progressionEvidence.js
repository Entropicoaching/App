// Evidence extraction for a future member progression engine. This module is
// deliberately conservative: it turns logged sets into comparable exposures,
// but never writes a program or changes an athlete's plan.

import { validateCustomerSetLog } from './customerSetLogging.js'
import { adaptiveBaselineFromPerformance } from './baselineLoads.js'

function numberRange(text) {
  return String(text || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || []
}

function targetReps(prescription) {
  if (Number.isInteger(prescription?.targetReps)) return prescription.targetReps
  const values = numberRange(prescription?.reps)
  return values.length ? Math.max(...values) : null
}

function rpeCeiling(prescription) {
  const values = numberRange(prescription?.targetRpe)
  return values.length ? Math.max(...values) : null
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function comparableExposureFromSession(entry, movement) {
  const expectedSets = Number(movement?.prescription?.sets)
  const prescriptionRepTarget = targetReps(movement?.prescription)
  const maxRpe = rpeCeiling(movement?.prescription)
  if (!entry || !movement || !Number.isInteger(expectedSets) || !prescriptionRepTarget || !maxRpe) {
    return { ok: false, reason: 'missing-programme-contract' }
  }
  if (!Array.isArray(entry.setLogs)) return { ok: false, reason: 'validated-set-logs-required' }

  const checked = entry.setLogs.map(validateCustomerSetLog)
  if (checked.some(result => !result.ok)) return { ok: false, reason: 'invalid-set-log-present' }
  const sets = checked.map(result => result.value)
    .filter(log => log.exerciseId === movement.exerciseId)
    .sort((a, b) => a.setNumber - b.setNumber)

  if (sets.length !== expectedSets || new Set(sets.map(log => log.setNumber)).size !== expectedSets) {
    return { ok: false, reason: 'incomplete-exposure' }
  }
  if (sets.some(log => log.actual.skipped)) return { ok: false, reason: 'skipped-set-present' }
  // The set log contains the concrete rep target shown to the athlete. For a
  // 4–6 prescription the UI may plan 5 reps; completing those 5 must not be
  // rejected later for failing an unseen target of 6.
  if (sets.some(log => log.actual.repsCompleted < log.planned.reps)) return { ok: false, reason: 'rep-target-not-met' }
  if (sets.some(log => log.actual.rpeActual > maxRpe)) return { ok: false, reason: 'rpe-above-target' }

  // A load changed dramatically by the athlete is useful training data, but it
  // is not automatically comparable to the generated prescription.
  if (sets.some(log => log.planned.weightKg > 0 && Math.abs(log.actual.weightKg - log.planned.weightKg) / log.planned.weightKg > 0.1)) {
    return { ok: false, reason: 'load-deviates-from-plan' }
  }

  const week = sets[0].weekNumber
  const sessionId = sets[0].sessionId
  if (sets.some(log => log.weekNumber !== week || log.sessionId !== sessionId)) return { ok: false, reason: 'mixed-session-data' }
  return {
    ok: true,
    key: `${week}:${sessionId}:${movement.exerciseId}`,
    weekNumber: week,
    sessionId,
    referenceLoadKg: Math.round(average(sets.map(log => log.actual.weightKg)) * 100) / 100,
    completedSets: sets.length,
    repTarget: Math.max(...sets.map(log => log.planned.reps)),
    maxRpe,
  }
}

export function comparableExposures(completedSessions, movement) {
  const unique = new Map()
  for (const entry of completedSessions || []) {
    const exposure = comparableExposureFromSession(entry, movement)
    if (exposure.ok) unique.set(exposure.key, exposure)
  }
  const ordered = [...unique.values()].sort((a, b) => a.weekNumber - b.weekNumber || a.sessionId.localeCompare(b.sessionId))
  const latest = ordered.at(-1)
  if (!latest || latest.referenceLoadKg <= 0) return ordered
  // "Sammenlignelig" gælder også mellem eksponeringerne. To isoleret gyldige
  // pas på fx 100 og 200 kg må ikke tilsammen udløse en stigning fra 200 kg.
  return ordered.filter(exposure => Math.abs(exposure.referenceLoadKg - latest.referenceLoadKg) / latest.referenceLoadKg <= 0.1)
}

function rejectedExposures(completedSessions, movement) {
  const rejected = []
  for (const [index, entry] of (completedSessions || []).entries()) {
    const relevantLogs = Array.isArray(entry?.setLogs)
      ? entry.setLogs.filter(log => log?.exerciseId === movement?.exerciseId)
      : []
    if (!relevantLogs.length) continue
    const result = comparableExposureFromSession(entry, movement)
    if (!result.ok) {
      rejected.push({
        weekNumber: relevantLogs[0]?.weekNumber ?? null,
        sessionId: relevantLogs[0]?.sessionId || entry?.sessionId || `entry-${index + 1}`,
        reason: result.reason,
      })
    }
  }
  return rejected
}

export function progressionEvidenceForMovement(completedSessions, movement) {
  const exposures = comparableExposures(completedSessions, movement)
  const rejected = rejectedExposures(completedSessions, movement)
  const adaptive = movement?.baselinePerformance?.adaptiveBaseline || adaptiveBaselineFromPerformance(movement?.baselinePerformance)
  // Week 1 itself is the progression history for week 2. Baseline confidence
  // remains visible as context, but may not force an otherwise complete,
  // acceptable week to repeat solely because older history is absent.
  const requiredExposures = 1
  if (exposures.length < requiredExposures) {
    return {
      status: 'insufficient-comparable-exposures',
      exposures,
      rejectedExposures: rejected,
      latest: exposures.at(-1) || null,
      requiredExposures,
      baselineConfidence: adaptive?.confidence || 'not-recorded',
    }
  }
  return {
    status: 'comparable-exposure',
    exposures,
    rejectedExposures: rejected,
    latest: exposures.at(-1),
    requiredExposures,
    baselineConfidence: adaptive?.confidence || 'not-recorded',
  }
}
