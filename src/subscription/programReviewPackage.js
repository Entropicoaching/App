// Et lokalt review-pakkeformat mellem generatoren og en senere sikker
// server-side tildelingsvej. Det tildeler aldrig et program og indeholder
// ingen brugerhemmeligheder eller adgangsbeslutninger.

import { resolveProgramDraft } from './programResolver.js'
import { applyBaselineLoadsToProgram } from './baselineLoads.js'
import { progressionEvidenceForMovement } from './progressionEvidence.js'
import { validateCustomerSetLog } from './customerSetLogging.js'
import { STANDARD_LOAD_INCREMENT_KG } from './programPrescriptions.js'

export const PROGRAM_REVIEW_PACKAGE_SCHEMA_VERSION = 1
export const NEXT_WEEK_PROPOSAL_SCHEMA_VERSION = 3
export const WEEK_TWO_PROPOSAL_SCHEMA_VERSION = NEXT_WEEK_PROPOSAL_SCHEMA_VERSION

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

// Identitet, ikke sikkerhed: den gør et review-udkast let at sammenligne i UI,
// tests og senere server-logik. Den må aldrig bruges som autorisation.
function fingerprint(value) {
  let hash = 2166136261
  for (const character of stableValue(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createProgramReviewPackage(input) {
  const resolution = resolveProgramDraft(input)
  if (resolution.outcome !== 'review-ready') {
    return { outcome: 'manual-review', reason: resolution.reason, selection: resolution.selection }
  }

  const decisionTrail = {
    matcherVersion: resolution.selection.matcherVersion,
    engineVersion: resolution.engineVersion,
    catalogueVersion: resolution.catalogueVersion,
    prescriptionLibraryVersion: resolution.prescriptionLibraryVersion,
    policyPackId: resolution.policyPackId,
    template: resolution.template,
    matchInput: resolution.selection.matchInput,
  }
  const program = resolution.program
  const reviewId = `review-${fingerprint({ decisionTrail, program })}`

  return {
    outcome: 'review-ready',
    schemaVersion: PROGRAM_REVIEW_PACKAGE_SCHEMA_VERSION,
    reviewId,
    status: 'awaiting-marc-program-version-approval',
    decisionTrail,
    program,
    assignment: null,
    guards: [
      'client-cannot-assign',
      'no-entitlement-write',
      'requires-immutable-approved-program-version',
      'requires-server-side-assignment',
    ],
  }
}

export function createCustomerProgram(reviewPackage, baselineLoads = null) {
  if (reviewPackage?.outcome !== 'review-ready') return null
  const baseProgram = {
    id: reviewPackage.reviewId,
    name: reviewPackage.decisionTrail.template.label,
    rationale: reviewPackage.decisionTrail.matchInput.goal === 'powerlifting-foundation'
      ? 'Dit styrkeløftfundament følger de squat- og dødløftvarianter, du selv har valgt.'
      : 'Din styrkebase er bygget ud fra dit mål, din erfaring, dine dage og dit udstyr.',
    sessions: reviewPackage.program.sessions,
  }
  // Baseline er valgfri for preview-kald og obligatorisk i kunderejsens
  // træningsflow. Et ugyldigt input returnerer null frem for en gættet vægt.
  if (baselineLoads === null) return baseProgram
  return applyBaselineLoadsToProgram(baseProgram, baselineLoads).program
}

function safeProgressedLoad(loadKg) {
  if (!Number.isFinite(loadKg) || loadKg <= 0) return null
  return Math.round((loadKg + STANDARD_LOAD_INCREMENT_KG) * 100) / 100
}

function uniqueProgramMovements(program) {
  const unique = new Map()
  for (const session of program?.sessions || []) {
    for (const movement of session.movements || []) {
      if (!unique.has(movement.exerciseId)) unique.set(movement.exerciseId, movement)
    }
  }
  return [...unique.values()]
}

function latestLoggedLoad(completedSessions, exerciseId) {
  let latest = null
  for (const entry of completedSessions || []) {
    for (const setLog of entry?.setLogs || []) {
      const checked = validateCustomerSetLog(setLog)
      if (checked.ok && checked.value.exerciseId === exerciseId && !checked.value.actual.skipped) {
        latest = checked.value.actual.weightKg
      }
    }
  }
  return latest
}

const REJECTED_EXPOSURE_REASONS = Object.freeze({
  'invalid-set-log-present': 'mindst ét sæt havde ugyldige eller modstridende data',
  'incomplete-exposure': 'ikke alle planlagte sæt var afsluttet',
  'skipped-set-present': 'mindst ét planlagt sæt blev sprunget over',
  'rep-target-not-met': 'repmålet blev ikke nået i alle sæt',
  'rpe-above-target': 'mindst ét sæt lå over det planlagte RPE-loft',
  'load-deviates-from-plan': 'belastningen afveg mere end den tilladte sammenligningsgrænse',
  'mixed-session-data': 'sættene kom fra forskellige pas eller uger',
  'validated-set-logs-required': 'passet manglede validerede sætdata',
})

function insufficientEvidenceReason(evidence, missingExpectedSessionIds = [], reviewWeekNumber = 1) {
  const latestRejected = evidence.rejectedExposures?.at(-1)
  const detail = latestRejected ? REJECTED_EXPOSURE_REASONS[latestRejected.reason] : null
  if (detail) return `Belastningen fastholdes, fordi ${detail}.`
  if (missingExpectedSessionIds.length) {
    return `Belastningen fastholdes, fordi mindst én planlagt eksponering i uge ${reviewWeekNumber} mangler en komplet, sammenlignelig logning.`
  }
  return `Belastningen fastholdes, fordi uge ${reviewWeekNumber} ikke indeholder en komplet, sammenlignelig logning for løftet.`
}

function expectedSessionIdsForMovement(program, exerciseId) {
  return (program?.sessions || [])
    .filter(session => (session.movements || []).some(movement => movement.exerciseId === exerciseId))
    .map(session => session.id)
}

function proposalIdentityPayload(proposal) {
  return {
    schemaVersion: proposal.schemaVersion,
    programId: proposal.programId,
    programFingerprint: proposal.programFingerprint,
    week: proposal.week,
    status: proposal.status,
    proposals: proposal.proposals,
  }
}

function proposalIdFor(proposal) {
  const prefix = proposal?.week === 2 ? 'week-two' : `week-${proposal?.week}`
  return `${prefix}-${fingerprint(proposalIdentityPayload(proposal))}`
}

function programFingerprint(program) {
  return `program-${fingerprint(program)}`
}

function validNextWeekNumber(value) {
  return Number.isInteger(value) && value >= 2
}

// Only the immediately preceding week may drive a proposal. This keeps old,
// rejected evidence from blocking later weeks and prevents a stale week-one log
// from being reused for a week-three increase.
function completedSessionsForWeek(completedSessions, weekNumber) {
  return (completedSessions || []).filter(entry => Array.isArray(entry?.setLogs)
    && entry.setLogs.some(log => log?.weekNumber === weekNumber))
}

// V3 foreslår kun en ændring til næste eksponering af samme hovedløft.
// Assistance genbruger højst atletens egen senest bekræftede belastning. Ingen
// volumen- og belastningsstigning kan ske samtidig. Et komplet løft i den
// foregående uge ved eller under RPE-loftet er nok til præcis ét reviewet
// vægttrin; manglende,
// sprunget-over eller afvist data holder belastningen. Hele forslaget bindes til
// det konkrete program før det kan accepteres.
export function buildNextWeekProposal(program, completedSessions, nextWeekNumber) {
  if (!validNextWeekNumber(nextWeekNumber)) throw new RangeError('Næste uge skal være et helt tal på mindst 2.')
  const reviewWeekNumber = nextWeekNumber - 1
  const reviewSessions = completedSessionsForWeek(completedSessions, reviewWeekNumber)
  const proposals = []
  for (const movement of uniqueProgramMovements(program)) {
      const latestAthleteLoad = latestLoggedLoad(reviewSessions, movement.exerciseId)
      if (movement.roleClass !== 'main') {
        proposals.push({
          exerciseId: movement.exerciseId,
          exerciseName: movement.exerciseName,
          roleClass: movement.roleClass,
          action: 'keep',
          fromLoadKg: latestAthleteLoad,
          toLoadKg: latestAthleteLoad,
          loadSource: Number.isFinite(latestAthleteLoad) ? 'latest-logged-set' : 'athlete-entry-required',
          progressionKg: null,
          evidenceStatus: Number.isFinite(latestAthleteLoad) ? 'latest-valid-set' : 'no-valid-load',
          comparableExposureCount: 0,
          reason: Number.isFinite(latestAthleteLoad)
            ? 'Næste uge genbruger kun den senest bekræftede belastning. Der foreslås ingen automatisk stigning for assistanceøvelsen.'
            : 'Der findes ingen bekræftet belastning. Atleten skal vælge belastningen; appen gætter ikke 0 kg.',
        })
        continue
      }
      const evidence = progressionEvidenceForMovement(reviewSessions, movement)
      const baseLoad = evidence.latest?.referenceLoadKg ?? movement.startingLoadKg ?? latestAthleteLoad ?? null
      const expectedSessionIds = expectedSessionIdsForMovement(program, movement.exerciseId)
      const comparableSessionIds = new Set(evidence.exposures.map(exposure => exposure.sessionId))
      const missingExpectedSessionIds = expectedSessionIds.filter(sessionId => !comparableSessionIds.has(sessionId))
      const hasSufficientEvidence = evidence.exposures.length >= 1
        && evidence.rejectedExposures.length === 0
        && missingExpectedSessionIds.length === 0
      const progressedLoad = hasSufficientEvidence ? safeProgressedLoad(baseLoad) : null
      const canProgress = progressedLoad !== null
      const progressionKg = canProgress ? STANDARD_LOAD_INCREMENT_KG : null
      proposals.push({
        exerciseId: movement.exerciseId,
        exerciseName: movement.exerciseName,
        roleClass: movement.roleClass,
        action: canProgress ? 'increase-load' : 'keep',
        fromLoadKg: baseLoad,
        toLoadKg: canProgress && progressedLoad !== null ? progressedLoad : baseLoad,
        loadSource: evidence.latest ? 'comparable-exposure' : Number.isFinite(movement.startingLoadKg) ? 'programme-start' : Number.isFinite(latestAthleteLoad) ? 'latest-logged-set' : 'athlete-entry-required',
        progressionKg,
        evidenceStatus: evidence.status,
        comparableExposureCount: evidence.exposures.length,
        reason: canProgress
          ? `Alle planlagte uge-${reviewWeekNumber}-logninger ramte repmålet inden for RPE-loftet. Næste uge foreslås ét fast, reviewet vægttrin på ${progressionKg} kg.`
          : !hasSufficientEvidence
            ? insufficientEvidenceReason(evidence, missingExpectedSessionIds, reviewWeekNumber)
            : 'Belastningen kunne ikke øges med det reviewede vægttrin. Behold planen.',
      })
  }
  const proposal = {
    schemaVersion: NEXT_WEEK_PROPOSAL_SCHEMA_VERSION,
    programId: program?.id || null,
    programFingerprint: programFingerprint(program),
    week: nextWeekNumber,
    status: 'proposal-requires-athlete-choice',
    proposals,
  }
  return { ...proposal, proposalId: proposalIdFor(proposal) }
}

export function buildWeekTwoProposal(program, completedSessions) {
  return buildNextWeekProposal(program, completedSessions, 2)
}

export function validateNextWeekProposal(program, proposal, expectedWeekNumber = null) {
  const errors = []
  if (!program || !proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return { ok: false, errors: ['proposal-required'] }
  if (proposal.schemaVersion !== NEXT_WEEK_PROPOSAL_SCHEMA_VERSION) errors.push('wrong-schema-version')
  if (proposal.programId !== (program.id || null)) errors.push('wrong-program-id')
  if (proposal.programFingerprint !== programFingerprint(program)) errors.push('wrong-program-fingerprint')
  if (!validNextWeekNumber(proposal.week)) errors.push('invalid-proposal-week')
  if (expectedWeekNumber !== null
      && (!validNextWeekNumber(expectedWeekNumber) || proposal.week !== expectedWeekNumber)) errors.push('wrong-proposal-week')
  if (proposal.status !== 'proposal-requires-athlete-choice') errors.push('wrong-proposal-state')
  if (!Array.isArray(proposal.proposals)) return { ok: false, errors: [...errors, 'proposal-items-required'] }

  const movements = uniqueProgramMovements(program)
  const movementById = new Map(movements.map(movement => [movement.exerciseId, movement]))
  const ids = new Set()
  if (proposal.proposals.length !== movements.length) errors.push('wrong-proposal-item-count')
  for (const item of proposal.proposals) {
    const movement = movementById.get(item?.exerciseId)
    if (!movement) { errors.push('unknown-exercise'); continue }
    if (ids.has(item.exerciseId)) errors.push('duplicate-exercise')
    ids.add(item.exerciseId)
    if (item.exerciseName !== movement.exerciseName || item.roleClass !== movement.roleClass) errors.push('movement-contract-mismatch')
    if (!['increase-load', 'keep'].includes(item.action)) errors.push('invalid-action')
    const finiteFrom = Number.isFinite(item.fromLoadKg)
    const finiteTo = Number.isFinite(item.toLoadKg)
    if ((finiteFrom && item.fromLoadKg < 0) || (finiteTo && item.toLoadKg < 0)) errors.push('negative-load')

    if (item.action === 'increase-load') {
      const safe = safeProgressedLoad(item.fromLoadKg)
      if (movement.roleClass !== 'main' || !finiteFrom || !finiteTo || item.toLoadKg !== safe || item.progressionKg !== STANDARD_LOAD_INCREMENT_KG) {
        errors.push('unsafe-load-increase')
      }
    } else {
      if (finiteFrom !== finiteTo || (finiteFrom && item.fromLoadKg !== item.toLoadKg) || (!finiteFrom && (item.fromLoadKg !== null || item.toLoadKg !== null))) {
        errors.push('invalid-keep-load')
      }
      if (item.progressionKg !== null) errors.push('keep-cannot-have-progression-kg')
    }
  }
  for (const movement of movements) if (!ids.has(movement.exerciseId)) errors.push('missing-exercise')
  if (proposal.proposalId !== proposalIdFor(proposal)) errors.push('proposal-fingerprint-mismatch')
  return { ok: errors.length === 0, errors }
}

export function validateWeekTwoProposal(program, proposal) {
  return validateNextWeekProposal(program, proposal, 2)
}

function currentMovementLoad(movement) {
  if (Number.isFinite(movement?.weekStartingLoadKg)) return movement.weekStartingLoadKg
  if (Number.isFinite(movement?.weekTwoStartingLoadKg)) return movement.weekTwoStartingLoadKg
  return Number.isFinite(movement?.startingLoadKg) ? movement.startingLoadKg : null
}

function currentMovementLoadSource(movement) {
  return movement?.weekLoadSource
    || movement?.weekTwoLoadSource
    || (Number.isFinite(movement?.startingLoadKg) ? 'programme-start' : 'athlete-entry-required')
}

// A generic week view always exposes the effective starting load through the
// same field names. Passing null as the proposal is an explicit keep choice and
// carries the current plan forward; a malformed proposal never applies a load.
export function createNextWeekView(program, acceptedProposal, nextWeekNumber = acceptedProposal?.week) {
  const weekIsValid = validNextWeekNumber(nextWeekNumber)
  const validation = !weekIsValid
    ? { ok: false, errors: ['invalid-next-week'] }
    : acceptedProposal === null || acceptedProposal === undefined
      ? { ok: true, errors: [] }
      : validateNextWeekProposal(program, acceptedProposal, nextWeekNumber)
  const proposalAccepted = Boolean(acceptedProposal) && validation.ok
  const proposalRejected = Boolean(acceptedProposal) && !validation.ok
  const accepted = proposalAccepted
    ? new Map(acceptedProposal.proposals.map(item => [item.exerciseId, item]))
    : new Map()

  return {
    ...program,
    weekNumber: weekIsValid ? nextWeekNumber : null,
    progressionChoice: proposalAccepted
      ? 'accepted-visible-proposal'
      : proposalRejected
        ? 'rejected-invalid-proposal'
        : weekIsValid
          ? `kept-week-${nextWeekNumber - 1}-plan`
          : 'rejected-invalid-proposal',
    acceptedProposalId: proposalAccepted ? acceptedProposal.proposalId : null,
    proposalValidation: validation,
    sessions: (program?.sessions || []).map(session => ({
      ...session,
      movements: (session.movements || []).map(movement => ({
        ...movement,
        weekStartingLoadKg: proposalAccepted
          ? Number.isFinite(accepted.get(movement.exerciseId)?.toLoadKg)
            ? accepted.get(movement.exerciseId).toLoadKg
            : null
          : proposalRejected
            ? null
            : currentMovementLoad(movement),
        weekLoadSource: accepted.get(movement.exerciseId)?.loadSource
          || currentMovementLoadSource(movement),
      })),
    })),
  }
}

// En accept ændrer aldrig det oprindelige program. Den opretter kun en lokal,
// synlig uge-2-visning med de belastninger atleten eksplicit har accepteret.
// Den er stadig ikke en server-tildeling eller en automatisk progression.
export function createWeekTwoView(program, acceptedProposal) {
  const validation = acceptedProposal === null || acceptedProposal === undefined
    ? { ok: true, errors: [] }
    : validateWeekTwoProposal(program, acceptedProposal)
  const proposalAccepted = Boolean(acceptedProposal) && validation.ok
  const accepted = proposalAccepted
    ? new Map(acceptedProposal.proposals.map(item => [item.exerciseId, item]))
    : new Map()

  return {
    ...program,
    weekNumber: 2,
    progressionChoice: proposalAccepted
      ? 'accepted-visible-proposal'
      : acceptedProposal
        ? 'rejected-invalid-proposal'
        : 'kept-week-one-plan',
    acceptedProposalId: proposalAccepted ? acceptedProposal.proposalId : null,
    proposalValidation: validation,
    sessions: program.sessions.map(session => ({
      ...session,
      movements: session.movements.map(movement => ({
        ...movement,
        weekTwoStartingLoadKg: Number.isFinite(accepted.get(movement.exerciseId)?.toLoadKg)
          ? accepted.get(movement.exerciseId).toLoadKg
          : null,
        weekTwoLoadSource: accepted.get(movement.exerciseId)?.loadSource
          || (Number.isFinite(movement.startingLoadKg) ? 'programme-start' : 'athlete-entry-required'),
      })),
    })),
  }
}
