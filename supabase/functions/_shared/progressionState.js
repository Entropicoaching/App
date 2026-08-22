// Progressionstilstand v1
//
// Den er bevidst en lille, serialiserbar kontrakt. En model må få denne
// tilstand som input, men må aldrig være den eneste hukommelse om et forløb.

export const PROGRESSION_STATE_SCHEMA_VERSION = 1
export const PROGRESSION_EDITABLE_FIELDS = ['sets', 'reps', 'load_kg', 'rpe_target']

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = value => typeof value === 'string' && value.trim().length > 0
const isPositiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0
const isFiniteNumber = value => Number.isFinite(Number(value))

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(',', '.')
  const direct = Number(normalized)
  if (Number.isFinite(direct)) return direct
  const match = normalized.match(/-?[\d.]+/)
  const parsed = match ? Number(match[0]) : null
  return Number.isFinite(parsed) ? parsed : null
}

function targetWeight(exercise) {
  if (!Array.isArray(exercise?.sets)) return null
  const weights = exercise.sets
    .map(set => toNumber(set?.weight))
    .filter(weight => weight !== null)
  return weights.length ? Math.max(...weights) : null
}

function repTarget(exercise) {
  if (Array.isArray(exercise?.sets) && exercise.sets.length) {
    const first = exercise.sets[0]?.reps
    if (first !== null && first !== undefined && String(first).trim()) return String(first).trim()
  }
  if (exercise?.reps !== null && exercise?.reps !== undefined && String(exercise.reps).trim()) {
    return String(exercise.reps).trim()
  }
  return null
}

/** De konkrete, redigerbare mål for et forecast. */
export function targetPrescriptionForExercise(exercise) {
  const explicitSets = Array.isArray(exercise?.sets) ? exercise.sets : []
  const setCount = explicitSets.length || (isPositiveInteger(exercise?.sets) ? Number(exercise.sets) : 0)
  return {
    set_count: setCount,
    reps: repTarget(exercise),
    load_kg: targetWeight(exercise),
    rpe_target: toNumber(exercise?.rpeTarget ?? exercise?.intensity),
  }
}

function sourceWeight(exercise) {
  return toNumber(exercise?.recommended_weight)
}

function sourceExerciseFor(sourceExercises, target, index) {
  const targetName = String(target?.name || '').trim().toLocaleLowerCase('da-DK')
  if (targetName) {
    const sameName = sourceExercises.find(source =>
      String(source?.name || '').trim().toLocaleLowerCase('da-DK') === targetName)
    if (sameName) return sameName
  }
  return sourceExercises[index] || {}
}

function historyEntryFor(state) {
  if (!isObject(state?.program?.source_week)
    || !isObject(state?.program?.target_week)
    || !Array.isArray(state?.expected_progression?.exercises)) return null
  return {
    source_week_number: Number(state.program.source_week.number),
    target_week_number: Number(state.program.target_week.number),
    decisions: state.expected_progression.exercises.map(exercise => ({
      exercise_name: exercise.exercise_name,
      decision: exercise.expected?.decision,
      target_load_kg: exercise.expected?.load_kg?.target ?? null,
      confidence: exercise.confidence,
    })),
    rationale: state.last_decision?.rationale || null,
  }
}

function actualEvidence(actual = {}) {
  const totalSets = Number(actual.total) || 0
  const skippedSets = Number(actual.skipped) || 0
  const rpeValues = Array.isArray(actual.rpes)
    ? actual.rpes.map(toNumber).filter(value => value !== null)
    : []
  return {
    total_sets: totalSets,
    skipped_sets: skippedSets,
    rpe_sets: rpeValues.length,
    average_rpe: rpeValues.length
      ? Math.round((rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) * 10) / 10
      : null,
  }
}

function projectionFor({ source, target, actual }) {
  const evidence = actualEvidence(actual)
  const sourceLoad = sourceWeight(source)
  const targetLoad = targetPrescriptionForExercise(target).load_kg

  if (targetLoad === null || targetLoad === 0 || sourceLoad === null || sourceLoad === 0) {
    return {
      decision: 'manual_load',
      load_kg: null,
      confidence: 'needs_review',
      rationale: 'Belastningen mangler en sikker numerisk baseline og skal vælges manuelt.',
      evidence,
    }
  }

  if (evidence.total_sets > 0 && evidence.skipped_sets / evidence.total_sets > 0.5) {
    return {
      decision: 'repeat',
      load_kg: { min: targetLoad, target: targetLoad, max: targetLoad },
      confidence: 'low',
      rationale: 'Flertallet af de loggede sæt var skippet; belastningen holdes, indtil der er et komplet grundlag.',
      evidence,
    }
  }

  if (targetLoad > sourceLoad) {
    return {
      decision: 'increase',
      load_kg: { min: sourceLoad, target: targetLoad, max: targetLoad },
      confidence: evidence.rpe_sets >= 2 ? 'medium' : 'needs_review',
      rationale: 'Den godkendte plan forventer en kontrolleret stigning fra kildeugen.',
      evidence,
    }
  }

  if (targetLoad < sourceLoad) {
    return {
      decision: 'decrease',
      load_kg: { min: targetLoad, target: targetLoad, max: sourceLoad },
      confidence: evidence.rpe_sets >= 2 ? 'medium' : 'needs_review',
      rationale: 'Den godkendte plan forventer en kontrolleret reduktion fra kildeugen.',
      evidence,
    }
  }

  return {
    decision: 'hold',
    load_kg: { min: targetLoad, target: targetLoad, max: targetLoad },
    confidence: evidence.rpe_sets >= 2 ? 'medium' : 'needs_review',
    rationale: 'Ingen stabil afvigelse i de strukturerede input kræver en ny belastning endnu.',
    evidence,
  }
}

function requiredText(errors, value, path) {
  if (!isText(value)) errors.push(`${path} mangler`)
}

function validLoadRange(range) {
  return isObject(range)
    && isFiniteNumber(range.min)
    && isFiniteNumber(range.target)
    && isFiniteNumber(range.max)
    && Number(range.min) <= Number(range.target)
    && Number(range.target) <= Number(range.max)
}

function validPrescription(prescription) {
  return isObject(prescription)
    && isPositiveInteger(prescription.set_count)
    && (prescription.reps === null || isText(prescription.reps))
    && (prescription.load_kg === null || (isFiniteNumber(prescription.load_kg) && Number(prescription.load_kg) >= 0))
    && (prescription.rpe_target === null || (isFiniteNumber(prescription.rpe_target)
      && Number(prescription.rpe_target) >= 0 && Number(prescription.rpe_target) <= 10))
}

function validOverride(override) {
  return isObject(override)
    && Array.isArray(override.fields)
    && override.fields.length > 0
    && override.fields.every(field => PROGRESSION_EDITABLE_FIELDS.includes(field))
    && isText(override.reason)
}

/**
 * Bygger en versioneret, modeluafhængig forventning for den næste uge.
 * Der er ingen fri tekst som implicit hukommelse: alle beslutningsfelter
 * er strukturerede og kan valideres før de gemmes eller sendes til en model.
 */
export function buildProgressionStateV1({ sourceWeek, targetWeek, actuals = {}, logWindow, previousState = null, createdAt = new Date().toISOString() }) {
  if (!isText(sourceWeek?.id) || !isPositiveInteger(sourceWeek?.week_number)) {
    throw new Error('Kildeugen mangler id eller gyldigt ugenummer')
  }
  if (!isPositiveInteger(targetWeek?.week_number)) {
    throw new Error('Måluge mangler gyldigt ugenummer')
  }

  const sourceSessions = Array.isArray(sourceWeek.sessions) ? sourceWeek.sessions : []
  const targetSessions = Array.isArray(targetWeek.sessions) ? targetWeek.sessions : []
  const exercises = []

  targetSessions.forEach((session, sessionIndex) => {
    const sourceSession = sourceSessions[sessionIndex] || {}
    const sourceExercises = Array.isArray(sourceSession.exercises) ? sourceSession.exercises : []
    const targetExercises = Array.isArray(session?.exercises) ? session.exercises : []

    targetExercises.forEach((target, exerciseIndex) => {
      const source = sourceExerciseFor(sourceExercises, target, exerciseIndex)
      const exerciseName = String(target?.name || source?.name || '').trim()
      if (!exerciseName) return
      const projection = projectionFor({ source, target, actual: actuals[exerciseName] })
      exercises.push({
        key: `${sessionIndex}:${exerciseIndex}`,
        session_label: String(session?.label || sourceSession?.title || 'Træning'),
        exercise_name: exerciseName,
        source: {
          load_kg: sourceWeight(source),
          sets: source?.sets ?? null,
          reps: source?.reps ?? null,
          rpe_target: toNumber(source?.intensity),
        },
        expected: {
          decision: projection.decision,
          load_kg: projection.load_kg,
          prescription: targetPrescriptionForExercise(target),
        },
        evidence: projection.evidence,
        confidence: projection.confidence,
        rationale: projection.rationale,
      })
    })
  })

  const aggregate = exercises.reduce((summary, exercise) => ({
    total_sets: summary.total_sets + exercise.evidence.total_sets,
    skipped_sets: summary.skipped_sets + exercise.evidence.skipped_sets,
    rpe_sets: summary.rpe_sets + exercise.evidence.rpe_sets,
  }), { total_sets: 0, skipped_sets: 0, rpe_sets: 0 })
  const priorHistory = Array.isArray(previousState?.decision_history) ? previousState.decision_history : []
  const previousEntry = historyEntryFor(previousState)
  const decisionHistory = (previousEntry ? [previousEntry, ...priorHistory] : priorHistory).slice(0, 3)

  return {
    schema_version: PROGRESSION_STATE_SCHEMA_VERSION,
    program: {
      source_week: {
        id: sourceWeek.id,
        number: Number(sourceWeek.week_number),
        block_name: sourceWeek.block_name || null,
        start_date: sourceWeek.start_date || null,
      },
      target_week: {
        number: Number(targetWeek.week_number),
        block_name: targetWeek.block_name || null,
        start_date: targetWeek.start_date || null,
      },
    },
    expected_progression: {
      review_trigger: 'Når målugen er logget',
      exercises,
    },
    last_decision: {
      kind: previousState ? 'reviewed' : 'initialized',
      at: createdAt,
      rationale: previousState
        ? 'Forrige godkendte forventning er med som versionskontekst; den erstattes ikke af fri tekst.'
        : 'Første forventning er bygget af den valgte kildeuge og dens strukturerede logopsummering.',
    },
    // De seneste beslutninger følger med i selve snapshot'et, så næste
    // modelkald ikke skal rekonstruere forløbet fra fri tekst eller chatlog.
    decision_history: decisionHistory,
    next_decision: {
      trigger: 'Når målugen er logget',
      required_inputs: [
        'planlagt belastning og RPE-mål',
        'antal gennemførte og skippede sæt',
        'faktisk RPE eller eksplicit manglende RPE',
      ],
      question: 'Understøtter de observerede sæt den godkendte forventning, eller skal næste interval ændres?',
    },
    evidence: {
      source_week_id: sourceWeek.id,
      log_window: {
        from: logWindow?.from || null,
        to: logWindow?.to || null,
      },
      summary: aggregate,
    },
    assumptions: [
      'Kun strukturerede logs i evidensvinduet bruges.',
      'Manglende RPE tolkes ikke som et let sæt.',
      'Øvelser uden sikker numerisk baseline får ikke en automatisk vægtprognose.',
    ],
  }
}

export function validateProgressionStateV1(state) {
  const errors = []
  if (!isObject(state)) return { ok: false, errors: ['Tilstanden er ikke et objekt'] }
  if (Number(state.schema_version) !== PROGRESSION_STATE_SCHEMA_VERSION) errors.push('schema_version skal være 1')

  const program = state.program
  if (!isObject(program)) {
    errors.push('program mangler')
  } else {
    if (!isObject(program.source_week)) errors.push('program.source_week mangler')
    else {
      requiredText(errors, program.source_week.id, 'program.source_week.id')
      if (!isPositiveInteger(program.source_week.number)) errors.push('program.source_week.number mangler')
    }
    if (!isObject(program.target_week)) errors.push('program.target_week mangler')
    else if (!isPositiveInteger(program.target_week.number)) errors.push('program.target_week.number mangler')
  }

  const expected = state.expected_progression
  if (!isObject(expected) || !Array.isArray(expected.exercises) || expected.exercises.length === 0) {
    errors.push('expected_progression.exercises mangler')
  } else {
    expected.exercises.forEach((exercise, index) => {
      const prefix = `expected_progression.exercises[${index}]`
      if (!isObject(exercise)) {
        errors.push(`${prefix} er ugyldig`)
        return
      }
      requiredText(errors, exercise.key, `${prefix}.key`)
      requiredText(errors, exercise.exercise_name, `${prefix}.exercise_name`)
      requiredText(errors, exercise.expected?.decision, `${prefix}.expected.decision`)
      if (exercise.expected?.load_kg !== null && !validLoadRange(exercise.expected?.load_kg)) {
        errors.push(`${prefix}.expected.load_kg er ugyldig`)
      }
      if (!validPrescription(exercise.expected?.prescription)) {
        errors.push(`${prefix}.expected.prescription er ugyldig`)
      }
      if (exercise.override !== undefined && !validOverride(exercise.override)) {
        errors.push(`${prefix}.override kræver felter og begrundelse`)
      }
      requiredText(errors, exercise.rationale, `${prefix}.rationale`)
      requiredText(errors, exercise.confidence, `${prefix}.confidence`)
    })
  }

  if (!isObject(state.last_decision)) errors.push('last_decision mangler')
  else {
    requiredText(errors, state.last_decision.kind, 'last_decision.kind')
    requiredText(errors, state.last_decision.rationale, 'last_decision.rationale')
  }

  if (!Array.isArray(state.decision_history) || state.decision_history.length > 3) {
    errors.push('decision_history er ugyldig')
  } else {
    state.decision_history.forEach((entry, index) => {
      const prefix = `decision_history[${index}]`
      if (!isObject(entry)) {
        errors.push(`${prefix} er ugyldig`)
        return
      }
      if (!isPositiveInteger(entry.source_week_number)) errors.push(`${prefix}.source_week_number mangler`)
      if (!isPositiveInteger(entry.target_week_number)) errors.push(`${prefix}.target_week_number mangler`)
      if (!Array.isArray(entry.decisions) || entry.decisions.length === 0) errors.push(`${prefix}.decisions mangler`)
      requiredText(errors, entry.rationale, `${prefix}.rationale`)
    })
  }

  if (!isObject(state.next_decision)) errors.push('next_decision mangler')
  else {
    requiredText(errors, state.next_decision.trigger, 'next_decision.trigger')
    requiredText(errors, state.next_decision.question, 'next_decision.question')
    if (!Array.isArray(state.next_decision.required_inputs) || state.next_decision.required_inputs.length === 0) {
      errors.push('next_decision.required_inputs mangler')
    }
  }

  if (!isObject(state.evidence)) errors.push('evidence mangler')
  else {
    requiredText(errors, state.evidence.source_week_id, 'evidence.source_week_id')
    if (!isObject(state.evidence.log_window)) errors.push('evidence.log_window mangler')
    if (!isObject(state.evidence.summary)) errors.push('evidence.summary mangler')
  }

  if (!Array.isArray(state.assumptions) || state.assumptions.length === 0 || !state.assumptions.every(isText)) {
    errors.push('assumptions mangler')
  }
  return { ok: errors.length === 0, errors }
}

function sameNullableNumber(left, right) {
  if (left === null || left === undefined || left === '') return right === null || right === undefined || right === ''
  if (right === null || right === undefined || right === '') return false
  return Number(left) === Number(right)
}

function sameNullableText(left, right) {
  const normalizedLeft = left === null || left === undefined ? null : String(left).trim()
  const normalizedRight = right === null || right === undefined ? null : String(right).trim()
  return normalizedLeft === normalizedRight
}

/**
 * Sikrer, at den uge der sendes, præcis matcher den forskrift Marc godkendte.
 * Kladden er ikke godkendt, hvis et af de redigerbare felter er ændret bagefter.
 */
export function progressionStateMatchesDraftPayload(state, payload) {
  const validation = validateProgressionStateV1(state)
  if (!validation.ok) return { ok: false, errors: validation.errors }
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : null
  if (!sessions) return { ok: false, errors: ['Udkastets sessioner mangler'] }

  const payloadExercises = []
  sessions.forEach((session, sessionIndex) => {
    const exercises = Array.isArray(session?.exercises) ? session.exercises : []
    exercises.forEach((exercise, exerciseIndex) => {
      payloadExercises.push({ key: `${sessionIndex}:${exerciseIndex}`, exercise })
    })
  })

  const expectedExercises = state.expected_progression.exercises
  const errors = []
  if (payloadExercises.length !== expectedExercises.length) {
    errors.push('Udkastets øvelser matcher ikke den godkendte progressionstilstand')
  }

  expectedExercises.forEach(expected => {
    const payloadExercise = payloadExercises.find(item => item.key === expected.key)?.exercise
    if (!payloadExercise) {
      errors.push(`${expected.exercise_name}: mangler i udkastet`)
      return
    }
    if (!sameNullableText(payloadExercise.name, expected.exercise_name)) {
      errors.push(`${expected.exercise_name}: øvelsesnavnet matcher ikke godkendelsen`)
    }
    const actual = targetPrescriptionForExercise(payloadExercise)
    const approved = expected.expected.prescription
    if (Number(actual.set_count) !== Number(approved.set_count)) errors.push(`${expected.exercise_name}: sæt matcher ikke godkendelsen`)
    if (!sameNullableText(actual.reps, approved.reps)) errors.push(`${expected.exercise_name}: reps matcher ikke godkendelsen`)
    if (!sameNullableNumber(actual.load_kg, approved.load_kg)) errors.push(`${expected.exercise_name}: vægt matcher ikke godkendelsen`)
    if (!sameNullableNumber(actual.rpe_target, approved.rpe_target)) errors.push(`${expected.exercise_name}: RPE matcher ikke godkendelsen`)
  })
  return { ok: errors.length === 0, errors }
}

/** Returnerer kun et komplet, valideret snapshot til et eventuelt modelkald. */
export function progressionModelContextV1(state) {
  const validation = validateProgressionStateV1(state)
  if (!validation.ok) return { available: false, missing: validation.errors }
  return {
    available: true,
    context: {
      schema_version: state.schema_version,
      program: state.program,
      expected_progression: state.expected_progression,
      last_decision: state.last_decision,
      decision_history: state.decision_history,
      next_decision: state.next_decision,
      evidence: state.evidence,
      assumptions: state.assumptions,
    },
  }
}

/**
 * En uge kan kun sendes, når netop dens forventning er eksplicit godkendt.
 * Ellers returnerer vi en konkret grund i stedet for at gætte på manglende kontekst.
 */
export function assessProgressionGate({ latestState, sourceWeek, targetWeekNumber }) {
  if (!latestState) {
    return {
      status: 'approval_required',
      can_commit: false,
      reasons: ['Ingen godkendt progressionstilstand findes endnu.'],
    }
  }
  if (latestState.status !== 'approved') {
    return {
      status: 'context_missing',
      can_commit: false,
      reasons: ['Den seneste progressionstilstand er ikke godkendt.'],
    }
  }
  const validation = validateProgressionStateV1(latestState.state)
  if (!validation.ok) {
    return {
      status: 'context_missing',
      can_commit: false,
      reasons: validation.errors,
    }
  }
  if (latestState.source_week_id === sourceWeek.id
    && Number(latestState.target_week_number) === Number(targetWeekNumber)
    && !latestState.target_week_id) {
    return { status: 'approved_for_draft', can_commit: true, reasons: [] }
  }
  if (latestState.target_week_id === sourceWeek.id) {
    return {
      status: 'approval_required',
      can_commit: false,
      reasons: ['Kildeugen har nu en afsluttet forventning; næste forventning skal godkendes.'],
    }
  }
  return {
    status: 'approval_required',
    can_commit: false,
    reasons: ['Den seneste progressionstilstand passer ikke til den valgte kildeuge og skal erstattes eksplicit.'],
  }
}
