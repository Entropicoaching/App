// Atletens estimerede 1RM er et lille, separat inputlag. V1 bruger kun en
// synlig, konservativ uge-1-konvertering og aldrig 1RM'et som sætvægt.
// Senere progression er fortsat et eksplicit valg efter loggede sæt.

export const BASELINE_LIFTS = [
  { id: 'squat', role: 'squat-pattern', label: 'Squat' },
  { id: 'bench', role: 'bench-pattern', label: 'Bænkpres' },
  { id: 'deadlift', role: 'hinge-pattern', label: 'Dødløft' },
]

export const BASELINE_PERFORMANCE_INPUT_SCHEMA_VERSION = 1

const liftByRole = new Map(BASELINE_LIFTS.map(lift => [lift.role, lift]))

// These are deliberately product constants, rather than an implicit formula.
// They are conservative first-week starting points for the current reviewed
// rep/RPE ranges and must be versioned/reviewed before a real assignment path.
export const WEEK_ONE_STARTING_LOAD_PERCENTAGES = Object.freeze({
  squat: 0.725,
  bench: 0.675,
  deadlift: 0.70,
})

// Baseline is evidence, not a diagnosis. The athlete may enter a genuine hard
// set, but the estimate is less reliable when it is far from failure or has
// many repetitions. We therefore use a lower bound for week one and never
// compensate with automatic volume changes.
const BASELINE_CONFIDENCE = Object.freeze({
  high: { uncertaintyPercent: 0.025, introPercentOffset: 0, rpeCap: 7, minimumComparableExposures: 2 },
  medium: { uncertaintyPercent: 0.05, introPercentOffset: -0.015, rpeCap: 6.5, minimumComparableExposures: 2 },
  low: { uncertaintyPercent: 0.08, introPercentOffset: -0.025, rpeCap: 6, minimumComparableExposures: 3 },
})

function roundDownToAvailableLoad(value, increment = 2.5) {
  if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) return null
  return Math.floor((value + 1e-9) / increment) * increment
}

function rpeRange(value) {
  return String(value || '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || []
}

export function targetRpeWithCap(targetRpe, cap) {
  const values = rpeRange(targetRpe)
  if (!values.length || !Number.isFinite(cap)) return targetRpe
  const lower = Math.min(...values)
  const upper = Math.min(Math.max(...values), cap)
  if (upper <= lower) return String(upper)
  return `${lower}–${upper}`
}

export function emptyBaselineLoads() {
  return Object.fromEntries(BASELINE_LIFTS.map(lift => [lift.id, { weightKg: null, reps: 1, rpe: 10 }]))
}

function normalisePerformanceInput(value) {
  // A legacy number remains a truthful 1RM input rather than becoming corrupt
  // local data when the pilot moves to the richer performance format.
  if (Number.isFinite(value)) return { weightKg: value, reps: 1, rpe: 10 }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return { weightKg: Number(value.weightKg), reps: Number(value.reps), rpe: Number(value.rpe) }
}

export function estimatedOneRepMaxFromPerformance(value) {
  const input = normalisePerformanceInput(value)
  if (!input || !Number.isFinite(input.weightKg) || !Number.isInteger(input.reps) || !Number.isFinite(input.rpe)) return null
  // Epley with a visible RIR adjustment: reps at failure ≈ performed reps +
  // (10 - RPE). This is only a conservative starting estimate, never a claim
  // about an athlete's true max or a substitute for their judgement.
  const repsAtFailure = input.reps + (10 - input.rpe)
  // A true 1RM (1 rep at RPE 10) must reproduce its entered load exactly.
  return Math.round(input.weightKg * (1 + Math.max(0, repsAtFailure - 1) / 30) * 100) / 100
}

export function baselineConfidenceFromPerformance(value) {
  const input = normalisePerformanceInput(value)
  if (!input || !Number.isFinite(input.weightKg) || input.weightKg <= 0 || !Number.isInteger(input.reps) || input.reps < 1 || input.reps > 12 || !Number.isFinite(input.rpe) || input.rpe < 5 || input.rpe > 10) return null
  // A hard single to five is the clearest signal. A submaximal/high-rep set is
  // still useful, but starts more carefully and needs an extra exposure before
  // any automatic week-two suggestion.
  if (input.reps <= 5 && input.rpe >= 8) return 'high'
  if (input.reps <= 8 && input.rpe >= 7) return 'medium'
  return 'low'
}

export function adaptiveBaselineFromPerformance(value) {
  const estimatedOneRepMaxKg = estimatedOneRepMaxFromPerformance(value)
  const confidence = baselineConfidenceFromPerformance(value)
  if (!Number.isFinite(estimatedOneRepMaxKg) || !confidence) return null
  const policy = BASELINE_CONFIDENCE[confidence]
  const conservativeOneRepMaxKg = Math.round(estimatedOneRepMaxKg * (1 - policy.uncertaintyPercent) * 100) / 100
  return {
    estimatedOneRepMaxKg,
    conservativeOneRepMaxKg,
    confidence,
    uncertaintyPercent: policy.uncertaintyPercent,
    introPercentOffset: policy.introPercentOffset,
    introRpeCap: policy.rpeCap,
    minimumComparableExposures: policy.minimumComparableExposures,
    // The start is only allowed to alter load and the effort ceiling. Volume is
    // deliberately left to the reviewed template until real log evidence exists.
    automaticChangesAllowed: ['load', 'rpe-cap'],
    automaticChangesForbidden: ['set-count', 'exercise-selection', 'frequency'],
  }
}

export function validateBaselineLoads(input) {
  const values = input || {}
  const errors = {}
  const normalized = {}

  for (const lift of BASELINE_LIFTS) {
    const performance = normalisePerformanceInput(values[lift.id])
    if (!performance || !Number.isFinite(performance.weightKg) || performance.weightKg <= 0 || performance.weightKg > 500 || !Number.isInteger(performance.reps) || performance.reps < 1 || performance.reps > 12 || !Number.isFinite(performance.rpe) || performance.rpe < 5 || performance.rpe > 10) {
      errors[lift.id] = 'Indtast vægt, 1–12 reps og RPE 5–10 for et repræsentativt tungt sæt.'
      normalized[lift.id] = null
      continue
    }
    normalized[lift.id] = {
      schemaVersion: BASELINE_PERFORMANCE_INPUT_SCHEMA_VERSION,
      weightKg: Math.round(performance.weightKg * 100) / 100,
      reps: performance.reps,
      rpe: Math.round(performance.rpe * 10) / 10,
      estimatedOneRepMaxKg: estimatedOneRepMaxFromPerformance(performance),
      adaptiveBaseline: adaptiveBaselineFromPerformance(performance),
    }
  }

  return { ok: Object.keys(errors).length === 0, values: normalized, errors }
}

export function baselineLiftForMovement(movement) {
  return liftByRole.get(movement?.role) || null
}

export function weekOnePercentageForMovement(liftId, prescription = null) {
  const explicit = prescription?.weekOnePercentOfEstimated1RM
  return Number.isFinite(explicit) && explicit > 0 && explicit < 1
    ? explicit
    : WEEK_ONE_STARTING_LOAD_PERCENTAGES[liftId]
}

export function weekOneStartingLoadFromOneRepMax(liftId, oneRepMaxKg, prescription = null) {
  const percentage = weekOnePercentageForMovement(liftId, prescription)
  if (!Number.isFinite(oneRepMaxKg) || !percentage) return null
  return roundDownToAvailableLoad(oneRepMaxKg * percentage, prescription?.loadIncrementKg ?? 2.5)
}

export function adaptiveWeekOneStartingLoad(liftId, baselinePerformance, prescription = null) {
  const adaptive = baselinePerformance?.adaptiveBaseline || adaptiveBaselineFromPerformance(baselinePerformance)
  if (!adaptive) return null
  const basePercentage = weekOnePercentageForMovement(liftId, prescription)
  const adjustedPercentage = Math.max(0.5, basePercentage + adaptive.introPercentOffset)
  return {
    startingLoadKg: roundDownToAvailableLoad(adaptive.conservativeOneRepMaxKg * adjustedPercentage, prescription?.loadIncrementKg ?? 2.5),
    startingPercentage: Math.round(adjustedPercentage * 1000) / 10,
    ...adaptive,
  }
}

// Shared presentation/application contract. UI previews and the generated
// customer program must call the same function, otherwise a raw e1RM preview
// can show a heavier number than the conservative load that is actually used.
export function baselineWeekOnePreview(liftId, baselinePerformance, prescription = null) {
  const adaptive = adaptiveWeekOneStartingLoad(liftId, baselinePerformance, prescription)
  if (!adaptive || !Number.isFinite(adaptive.startingLoadKg)) return null
  return {
    estimatedOneRepMaxKg: adaptive.estimatedOneRepMaxKg,
    conservativeOneRepMaxKg: adaptive.conservativeOneRepMaxKg,
    confidence: adaptive.confidence,
    startingLoadKg: adaptive.startingLoadKg,
    startingPercentage: adaptive.startingPercentage,
    targetRpe: targetRpeWithCap(prescription?.targetRpe, adaptive.introRpeCap),
    introRpeCap: adaptive.introRpeCap,
    minimumComparableExposures: adaptive.minimumComparableExposures,
    uncertaintyPercent: adaptive.uncertaintyPercent,
    automaticChangesAllowed: adaptive.automaticChangesAllowed,
    automaticChangesForbidden: adaptive.automaticChangesForbidden,
  }
}

// Returnerer en ny visning. Originalprogrammet, recept og senere uge-2-valg
// bevares. Kun hovedløft med et direkte, valideret 1RM får en afledt uge-1-
// startvægt; assistanceløft får ikke en opfundet vægt.
export function applyBaselineLoadsToProgram(program, baselineInput) {
  const validation = validateBaselineLoads(baselineInput)
  if (!program || !validation.ok) return { program: null, validation }

  return {
    validation,
    program: {
      ...program,
      baselineLoads: validation.values,
      sessions: program.sessions.map(session => ({
        ...session,
        movements: session.movements.map(movement => {
          const lift = movement.roleClass === 'main' ? baselineLiftForMovement(movement) : null
          const baseline = lift ? validation.values[lift.id] : null
          const oneRepMaxKg = baseline?.estimatedOneRepMaxKg ?? null
          const adaptiveStart = lift ? baselineWeekOnePreview(lift.id, baseline, movement.prescription) : null
          return lift
            ? {
                ...movement,
                estimatedOneRepMaxKg: oneRepMaxKg,
                baselinePerformance: baseline,
                startingLoadKg: adaptiveStart?.startingLoadKg ?? weekOneStartingLoadFromOneRepMax(lift.id, oneRepMaxKg, movement.prescription),
                startingLoadRule: `adaptive-baseline-${adaptiveStart?.confidence || 'unknown'}-v1`,
                prescription: adaptiveStart ? {
                  ...movement.prescription,
                  baseTargetRpe: movement.prescription?.targetRpe,
                  targetRpe: adaptiveStart.targetRpe,
                  adaptiveIntroRpeCap: adaptiveStart.introRpeCap,
                } : movement.prescription,
                baselineGuidance: adaptiveStart ? {
                  confidence: adaptiveStart.confidence,
                  conservativeOneRepMaxKg: adaptiveStart.conservativeOneRepMaxKg,
                  uncertaintyPercent: adaptiveStart.uncertaintyPercent,
                  startingPercentage: adaptiveStart.startingPercentage,
                  introRpeCap: adaptiveStart.introRpeCap,
                  minimumComparableExposures: adaptiveStart.minimumComparableExposures,
                  automaticChangesAllowed: adaptiveStart.automaticChangesAllowed,
                  automaticChangesForbidden: adaptiveStart.automaticChangesForbidden,
                } : null,
              }
            : { ...movement }
        }),
      })),
    },
  }
}
