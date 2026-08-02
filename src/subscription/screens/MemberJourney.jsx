import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BASELINE_LIFTS,
  applyBaselineLoadsToProgram,
  baselineWeekOnePreview,
  emptyBaselineLoads,
  validateBaselineLoads,
} from '../baselineLoads.js'
import { customerSetPresentationState, isCustomerSessionReady, nextUnconfirmedSetIndex } from '../customerJourneyState.js'
import { summarizeCustomerWeek, validateCustomerSetLog } from '../customerSetLogging.js'
import {
  formatDurationSeconds,
  formatTimedPrescription,
  isMemberBodyweightMovement,
  parseTimedPrescription,
  timedMovementInSession,
} from '../memberExerciseLogging.js'
import { memberExerciseGuidance } from '../memberExerciseGuidance.js'
import {
  buildNextWeekProposal,
  buildWeekTwoProposal,
  createCustomerProgram,
  createNextWeekView,
  createProgramReviewPackage,
  createWeekTwoView,
} from '../programReviewPackage.js'
import { buildMemberProgress } from '../memberProgress.js'
import { recoverMemberJourneyFromHistory } from '../memberJourneyRecovery.js'
import { PROGRAM_MATCH_INPUT_SCHEMA_VERSION } from '../templateMatcher.js'
import {
  advanceOngoingCycle,
  clearMemberJourneySnapshot,
  createAssignedSnapshot,
  createAssignmentBinding,
  createMemberSessionDraft,
  createOngoingCycle,
  createSetupBinding,
  createSetupSnapshot,
  loadMemberJourneySnapshot,
  memberJourneyFingerprint,
  memberSessionDraftMatches,
  memberSessionEntryFromDraft,
  memberSessionEntryMatches,
  prefillNextAssistanceSetLoad,
  saveMemberJourneySnapshot,
} from '../memberJourneyStorage.js'
import { color, font, s } from '../theme.js'
import { Button, Card, ChipRow, ChoiceList, Label, Meta, Stepper, TabBar } from '../ui.jsx'

const GOALS = [
  { value: 'general-strength', label: 'Generel styrke', note: 'Et stabilt styrkeforløb med basisbevægelser og assistance.' },
  { value: 'powerlifting-foundation', label: 'Styrkeløftfundament', note: 'Squat, bænkpres og dødløft med dine valgte varianter.' },
]

const LEVELS = [
  { value: 'begynder', label: 'Nybegynder', note: 'Under cirka seks måneders struktureret styrketræning.' },
  { value: 'oevet', label: 'Øvet', note: 'Cirka seks måneder eller mere med struktureret styrketræning.' },
]

const DAYS = [2, 3, 4].map(value => ({ value, label: `${value} træningsdage om ugen` }))
const EQUIPMENT = [
  { value: 'gym', label: 'Full Gym', note: 'Stang, skiver, rack, bænk og almindelige maskiner.' },
  { value: 'home', label: 'Hjemmetræning', note: 'Kræver håndvægte, en stabil bænk eller kasse og en elastik.' },
]
const SQUAT_STYLES = [
  { value: 'high-bar', label: 'High-bar squat' },
  { value: 'low-bar', label: 'Low-bar squat' },
]
const DEADLIFT_STYLES = [
  { value: 'conventional', label: 'Konventionel dødløft' },
  { value: 'sumo', label: 'Sumo dødløft' },
]
const REVIEW_OPTIONS = [
  { value: 'appropriate', label: 'Passende', note: 'Ugen føltes udfordrende, men håndterbar.' },
  { value: 'too-hard', label: 'For hård', note: 'Belastning, RPE eller samlet træthed var for høj.' },
  { value: 'surplus', label: 'Overskud', note: 'Der var tydeligt mere at give af uden at presse teknikken.' },
]

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '48px',
  background: color.bg,
  border: `1px solid ${color.lineStrong}`,
  color: color.text,
  fontFamily: font.sans,
  fontSize: '0.95rem',
  padding: '0.55rem 0.7rem',
}

function canonicalMatchInput(input) {
  const review = createProgramReviewPackage(input)
  if (review.outcome !== 'review-ready') return null
  if (!['high-bar', 'low-bar'].includes(review.decisionTrail.matchInput.squatStyle)
      || !['conventional', 'sumo'].includes(review.decisionTrail.matchInput.deadliftStyle)) return null
  return {
    schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION,
    ...review.decisionTrail.matchInput,
    updatedAt: input?.updatedAt || null,
  }
}

function assignmentBaseline(assignment) {
  return assignment?.baselineLoads
    || assignment?.baseline_loads
    || assignment?.baselineInput
    || assignment?.baseline_input
    || assignment?.matchInput?.baselines
    || assignment?.match_input?.baselines
    || assignment?.setup?.baselineLoads
    || assignment?.customerProgram?.baselineLoads
    || null
}

function resolveAssignment(assignment, initialMatchInput, immutableProgram) {
  if (assignment === undefined) return { status: 'loading', binding: null }
  if (assignment === null) return { status: 'setup', binding: createSetupBinding(initialMatchInput) }
  const assignmentId = String(assignment.id || assignment.assignmentId || '').trim()
  const programId = String(assignment.program_id || assignment.programId || '').trim()
  const sourceMatch = assignment.matchInput || assignment.match_input || initialMatchInput
  const matchInput = canonicalMatchInput(sourceMatch)
  const baselineLoads = assignmentBaseline(assignment)
  if (!assignmentId) return { status: 'error', reason: 'Dit aktive program mangler en identitet.', binding: null }
  if (!programId) return { status: 'error', reason: 'Dit aktive program mangler en programversion.', binding: null }
  if (!matchInput) return { status: 'error', reason: 'Dine programvalg kan ikke læses.', binding: null }
  if (!validateBaselineLoads(baselineLoads).ok) {
    return { status: 'error', reason: 'Dit program mangler gyldige startbelastninger.', binding: null }
  }
  if (!immutableProgram || immutableProgram.id !== programId || !Array.isArray(immutableProgram.sessions) || !immutableProgram.sessions.length) {
    return { status: 'error', reason: 'Den tildelte programversion kan ikke læses.', binding: null }
  }
  const program = applyBaselineLoadsToProgram(immutableProgram, baselineLoads).program
  const binding = createAssignmentBinding({ assignmentId, programId, matchInput, program })
  if (!program || !binding) {
    return { status: 'error', reason: 'Dit aktive program kunne ikke genskabes.', binding: null }
  }
  return {
    status: 'assigned',
    assignmentId,
    programId,
    matchInput,
    baselineLoads: validateBaselineLoads(baselineLoads).values,
    program,
    binding,
  }
}

function weekTwoProgram(program, snapshot) {
  if (!snapshot?.weekTwoChoice) return null
  const proposal = buildWeekTwoProposal(program, snapshot.completedWeekOne)
  const accepted = snapshot.weekTwoChoice === 'accepted' ? proposal : null
  return createWeekTwoView(program, accepted)
}

function programmeWithLatestLoads(program, completedSessions) {
  const latest = new Map()
  for (const entry of completedSessions || []) {
    for (const row of entry?.setLogs || []) {
      if (!row?.actual?.skipped && Number.isFinite(row?.actual?.weightKg)) {
        latest.set(row.exerciseId, row.actual.weightKg)
      }
    }
  }
  return {
    ...program,
    sessions: (program?.sessions || []).map(session => ({
      ...session,
      movements: (session.movements || []).map(movement => ({
        ...movement,
        weekStartingLoadKg: latest.has(movement.exerciseId)
          ? latest.get(movement.exerciseId)
          : Number.isFinite(movement.weekStartingLoadKg)
            ? movement.weekStartingLoadKg
            : Number.isFinite(movement.weekTwoStartingLoadKg)
              ? movement.weekTwoStartingLoadKg
              : movement.startingLoadKg,
        weekLoadSource: latest.has(movement.exerciseId)
          ? 'latest-logged-set'
          : movement.weekLoadSource || movement.weekTwoLoadSource || movement.startingLoadRule || 'athlete-entry-required',
      })),
    })),
  }
}

function ongoingWeekProgram(program, snapshot) {
  const cycle = snapshot?.ongoing
  if (!cycle || !Number.isInteger(cycle.weekNumber) || cycle.weekNumber < 2) return null
  if (cycle.weekNumber === 2 && !cycle.recoveredFromHistory) return weekTwoProgram(program, snapshot)
  const proposalProgram = programmeWithLatestLoads(program, cycle.previousCompleted)
  const proposal = buildNextWeekProposal(proposalProgram, cycle.previousCompleted, cycle.weekNumber)
  if (cycle.currentChoice === 'accepted' && cycle.currentProposalId !== proposal.proposalId) return null
  const accepted = cycle.currentChoice === 'accepted' ? proposal : null
  const view = createNextWeekView(proposalProgram, accepted, cycle.weekNumber)
  return view.progressionChoice === 'rejected-invalid-proposal' ? null : view
}

function shortDate(value) {
  const date = typeof value === 'string' ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Dato mangler'
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function snapshotReviewHistory(snapshot) {
  const reviews = new Map()
  if (snapshot?.weeklyReview?.completedAt) reviews.set(1, { weekNumber: 1, ...snapshot.weeklyReview })
  for (const review of snapshot?.ongoing?.reviews || []) reviews.set(review.weekNumber, review)
  if (snapshot?.ongoing?.review?.completedAt) {
    reviews.set(snapshot.ongoing.weekNumber, { weekNumber: snapshot.ongoing.weekNumber, ...snapshot.ongoing.review })
  }
  return [...reviews.values()].sort((left, right) => right.weekNumber - left.weekNumber)
}

function assignedSnapshotFits(snapshot, resolved) {
  if (!snapshot || snapshot.mode !== 'assigned') return false
  const sessions = resolved.program.sessions
  if (snapshot.completedWeekOne.length > sessions.length || snapshot.completedWeekTwo.length > sessions.length) return false
  for (let index = 0; index < snapshot.completedWeekOne.length; index += 1) {
    if (!memberSessionEntryMatches(snapshot.completedWeekOne[index], {
      assignmentId: resolved.assignmentId,
      session: sessions[index],
      weekNumber: 1,
    })) return false
  }
  const weekOneComplete = snapshot.completedWeekOne.length === sessions.length
  if (snapshot.stage === 'week-one' && weekOneComplete) return false
  if (snapshot.stage !== 'week-one' && !weekOneComplete) return false
  if (snapshot.stage === 'week-one' && snapshot.sessionDraft) {
    const next = sessions[snapshot.completedWeekOne.length]
    if (!memberSessionDraftMatches(snapshot.sessionDraft, {
      assignmentId: resolved.assignmentId,
      session: next,
      weekNumber: 1,
    })) return false
  }
  if (snapshot.stage !== 'week-one' && snapshot.sessionDraft?.weekNumber === 1) return false

  const recoveredOngoing = snapshot.stage.startsWith('ongoing-') && snapshot.ongoing?.recoveredFromHistory
  const weekTwo = snapshot.weekTwoChoice ? weekTwoProgram(resolved.program, snapshot) : null
  if (!recoveredOngoing) {
    if (weekTwo?.progressionChoice === 'rejected-invalid-proposal') return false
    if (snapshot.completedWeekTwo.length && !weekTwo) return false
    for (let index = 0; index < snapshot.completedWeekTwo.length; index += 1) {
      if (!memberSessionEntryMatches(snapshot.completedWeekTwo[index], {
        assignmentId: resolved.assignmentId,
        session: weekTwo.sessions[index],
        weekNumber: 2,
      })) return false
    }
    if (snapshot.stage === 'week-two-session') {
      const next = weekTwo?.sessions[snapshot.completedWeekTwo.length]
      if (!next || !memberSessionDraftMatches(snapshot.sessionDraft, {
        assignmentId: resolved.assignmentId,
        session: next,
        weekNumber: 2,
      })) return false
    }
    if (snapshot.stage === 'week-two-ready' && snapshot.completedWeekTwo.length >= sessions.length) return false
    if (snapshot.stage === 'week-two-complete' && snapshot.completedWeekTwo.length !== sessions.length) return false
  }
  if (snapshot.stage.startsWith('ongoing-')) {
    const cycle = snapshot.ongoing
    if (!cycle || (!cycle.recoveredFromHistory && snapshot.completedWeekTwo.length !== sessions.length) || cycle.previousCompleted.length !== sessions.length) return false
    if (cycle.completed.length > sessions.length) return false
    if (!cycle.previousCompleted.every((entry, index) => entry.assignmentId === resolved.assignmentId
      && entry.weekNumber === cycle.weekNumber - 1
      && entry.sessionId === sessions[index]?.id)) return false
    const currentProgram = ongoingWeekProgram(resolved.program, snapshot)
    if (!currentProgram) return false
    for (let index = 0; index < cycle.completed.length; index += 1) {
      const entry = cycle.completed[index]
      if (cycle.recoveredFromHistory) {
        if (entry.assignmentId !== resolved.assignmentId || entry.weekNumber !== cycle.weekNumber
            || entry.sessionId !== currentProgram.sessions[index]?.id) return false
      } else if (!memberSessionEntryMatches(entry, {
        assignmentId: resolved.assignmentId,
        session: currentProgram.sessions[index],
        weekNumber: cycle.weekNumber,
      })) return false
    }
    if (snapshot.stage === 'ongoing-session') {
      const next = currentProgram.sessions[cycle.completed.length]
      if (!next || !memberSessionDraftMatches(snapshot.sessionDraft, {
        assignmentId: resolved.assignmentId,
        session: next,
        weekNumber: cycle.weekNumber,
      })) return false
    }
    if (snapshot.stage === 'ongoing-ready' && cycle.completed.length >= sessions.length) return false
    if (['ongoing-review', 'ongoing-proposal'].includes(snapshot.stage) && cycle.completed.length !== sessions.length) return false
    const ongoingIds = [...cycle.previousCompleted, ...cycle.completed].map(item => item.clientId)
    return new Set(ongoingIds).size === ongoingIds.length
  }
  const ids = [...snapshot.completedWeekOne, ...snapshot.completedWeekTwo].map(item => item.clientId)
  return new Set(ids).size === ids.length
}

function freshSnapshot(userId, resolved, initialMatchInput, historySessions) {
  if (!userId || !resolved.binding) return { value: null, recoveryBlocked: null }
  const stored = loadMemberJourneySnapshot({ userId, expectedBinding: resolved.binding })
  if (resolved.status === 'setup') return { value: stored || createSetupSnapshot(userId, initialMatchInput), recoveryBlocked: null }
  if (resolved.status !== 'assigned') return { value: null, recoveryBlocked: null }
  if (stored && assignedSnapshotFits(stored, resolved)) return { value: stored, recoveryBlocked: null }
  if (stored) clearMemberJourneySnapshot(userId)
  const recovery = recoverMemberJourneyFromHistory({
    userId,
    assignmentId: resolved.assignmentId,
    programId: resolved.programId,
    matchInput: resolved.matchInput,
    baselineLoads: resolved.baselineLoads,
    binding: resolved.binding,
    program: resolved.program,
    sessions: historySessions,
  })
  if (recovery.status === 'recovered' && assignedSnapshotFits(recovery.snapshot, resolved)) {
    return { value: recovery.snapshot, recoveryBlocked: null }
  }
  if (recovery.status === 'blocked' || recovery.status === 'recovered') {
    return { value: null, recoveryBlocked: recovery.reason || 'recovered-state-did-not-match-program' }
  }
  return { value: createAssignedSnapshot({
    userId,
    binding: resolved.binding,
    matchInput: resolved.matchInput,
    baselineLoads: resolved.baselineLoads,
  }), recoveryBlocked: null }
}

function StateMessage({ label, title, children, actionLabel, onAction, onLogout }) {
  return <div style={s.page}>
    <Label>{label}</Label>
    <h1 style={s.h1}>{title}</h1>
    <p style={{ ...s.body, marginBottom: '1.25rem' }}>{children}</p>
    {onAction && <Button onClick={onAction}>{actionLabel}</Button>}
    {onLogout && <Button variant="ghost" onClick={onLogout} style={{ marginTop: '0.65rem' }}>Log ud</Button>}
  </div>
}

function StorageNotice({ onRetry }) {
  return <Card style={{ borderColor: color.lineStrong, margin: '0 auto 0.8rem', maxWidth: '486px' }}>
    <Label>Dine seneste ændringer er ikke gemt</Label>
    <p role="alert" style={{ ...s.body, color: color.text, margin: '0 0 0.75rem' }}>
      Træningen er stadig åben. Prøv igen, før du lukker eller genindlæser siden.
    </p>
    <Button variant="ghost" onClick={onRetry}>Prøv at gemme igen</Button>
  </Card>
}

function MatchSetup({ snapshot, onChange, onContinue, onLogout }) {
  const input = snapshot.matchInput
  const selectedCount = ['goal', 'level', 'daysPerWeek', 'equipment', 'squatStyle', 'deadliftStyle'].filter(field => input[field]).length
  const complete = Boolean(input.goal && input.level && input.daysPerWeek && input.equipment)
    && ['high-bar', 'low-bar'].includes(input.squatStyle)
    && ['conventional', 'sumo'].includes(input.deadliftStyle)
  const review = complete ? createProgramReviewPackage(input) : null
  const update = (field, value) => onChange({
    ...input,
    [field]: value,
    schemaVersion: PROGRAM_MATCH_INPUT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  })
  return <div style={s.page}>
    <Label>Programopsætning · 1 af 3</Label>
    <h1 style={s.h1}>Vælg rammerne for din træning.</h1>
    <p style={{ ...s.body, marginBottom: '1.25rem' }}>Det tager cirka to minutter. Dine svar bestemmer antal pas, øvelser og startbelastninger.</p>
    <Card><Meta style={{ marginBottom: '0.5rem' }}>Mål</Meta><ChoiceList options={GOALS} value={input.goal} onChange={value => update('goal', value)} /></Card>
    <Card><Meta style={{ marginBottom: '0.5rem' }}>Erfaring</Meta><ChoiceList options={LEVELS} value={input.level} onChange={value => update('level', value)} /></Card>
    <Card><Meta style={{ marginBottom: '0.5rem' }}>Træningsdage</Meta><ChoiceList options={DAYS} value={input.daysPerWeek} onChange={value => update('daysPerWeek', value)} /></Card>
    <Card><Meta style={{ marginBottom: '0.5rem' }}>Træningssted</Meta><ChoiceList options={EQUIPMENT} value={input.equipment} onChange={value => update('equipment', value)} /></Card>
    <Card><Meta style={{ marginBottom: '0.5rem' }}>Squat-variant</Meta><ChoiceList options={SQUAT_STYLES} value={input.squatStyle} onChange={value => update('squatStyle', value)} /><Meta style={{ marginTop: '0.55rem' }}>{input.equipment === 'home' ? 'Ved hjemmetræning bruger programmet den nærmeste håndvægtsvariant af dit valg.' : 'Ved Full Gym bruger programmet præcis den variant, du vælger.'}</Meta></Card>
    <Card><Meta style={{ marginBottom: '0.5rem' }}>Dødløft-variant</Meta><ChoiceList options={DEADLIFT_STYLES} value={input.deadliftStyle} onChange={value => update('deadliftStyle', value)} /><Meta style={{ marginTop: '0.55rem' }}>{input.equipment === 'home' ? 'Ved hjemmetræning bruger programmet den nærmeste håndvægtsvariant af dit valg.' : 'Sumo bliver aldrig ændret til konventionel.'}</Meta></Card>
    {complete && review?.outcome !== 'review-ready' && <Card style={{ borderColor: color.lineStrong }}>
      <Label>Ret et valg</Label><p style={{ ...s.body, color: color.text, margin: 0 }}>Kombinationen kan ikke blive til et sikkert program endnu. Vælg træningssted eller varianter igen.</p>
    </Card>}
    <Button variant="ghost" onClick={onLogout} style={{ marginTop: '0.65rem' }}>Log ud</Button>
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 35, background: color.panel, borderTop: `1px solid ${color.lineStrong}`, padding: '0.6rem max(1rem, env(safe-area-inset-left)) calc(0.6rem + env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: '488px', margin: '0 auto' }}><Meta style={{ display: 'block', marginBottom: '0.35rem', textAlign: 'center' }}>{selectedCount} af 6 valg udfyldt</Meta><Button disabled={review?.outcome !== 'review-ready'} onClick={() => onContinue(canonicalMatchInput(input))}>Angiv startbelastninger</Button></div>
    </div>
  </div>
}

function BaselineSetup({ snapshot, onChange, onBack, onContinue }) {
  const review = createProgramReviewPackage(snapshot.matchInput)
  const validation = validateBaselineLoads(snapshot.baselineLoads)
  const mainMovement = lift => review.program.sessions.flatMap(session => session.movements).find(movement => movement.role === lift.role)
  const liftName = lift => mainMovement(lift)?.exerciseName || lift.label
  const update = (liftId, field, raw) => {
    const cleaned = String(raw).replace(',', '.')
    if (!/^\d*\.?\d*$/.test(cleaned)) return
    onChange({
      ...snapshot.baselineLoads,
      [liftId]: {
        ...snapshot.baselineLoads[liftId],
        [field]: cleaned === '' && field === 'weightKg' ? null : Number(cleaned),
      },
    })
  }
  return <div style={s.page}>
    <Label>Programopsætning · 2 af 3</Label>
    <h1 style={s.h1}>Start med det, du kan nu.</h1>
    <p style={{ ...s.body, marginBottom: '1.1rem' }}>Angiv et nyligt tungt sæt med vægt, reps og RPE. Et 1RM er 1 rep ved RPE 10. RPE 8 betyder cirka to reps tilbage. Vi bruger et forsigtigt estimat til uge 1.</p>
    {BASELINE_LIFTS.map(lift => {
      const value = snapshot.baselineLoads[lift.id]
      const preview = baselineWeekOnePreview(lift.id, value, mainMovement(lift)?.prescription)
      return <Card key={lift.id} style={{ borderColor: validation.errors[lift.id] ? color.lineStrong : color.accentBorder }}>
        <Label tone="muted">{liftName(lift)}</Label>
        <label><Meta>Vægt</Meta><div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.3rem' }}><input aria-label={`${liftName(lift)} vægt i kg`} inputMode="decimal" value={value?.weightKg ?? ''} onChange={event => update(lift.id, 'weightKg', event.target.value)} placeholder="fx 100" style={{ ...inputStyle, fontFamily: font.display, fontSize: '1.4rem' }} /><Meta>kg</Meta></div></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', marginTop: '0.6rem' }}>
          <label><Meta>Reps</Meta><input aria-label={`${liftName(lift)} reps`} inputMode="numeric" value={value?.reps ?? 1} onChange={event => update(lift.id, 'reps', event.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }} /></label>
          <label><Meta>RPE</Meta><input aria-label={`${liftName(lift)} RPE`} inputMode="decimal" value={value?.rpe ?? 10} onChange={event => update(lift.id, 'rpe', event.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }} /></label>
        </div>
        {preview ? <Meta style={{ color: color.accent, marginTop: '0.65rem' }}>Estimeret 1RM: ca. {preview.estimatedOneRepMaxKg} kg · start i uge 1: {preview.startingLoadKg} kg · mål RPE {preview.targetRpe}</Meta> : <Meta style={{ marginTop: '0.65rem' }}>{validation.errors[lift.id] || 'Indtast sættet for at se en forsigtig start.'}</Meta>}
      </Card>
    })}
    <Card><Meta>Sådan bruges tallene</Meta><p style={{ ...s.body, color: color.text, margin: '0.35rem 0 0' }}>Startvægten bruger samme konservative beregning som uge-1-programmet. Assistance får ingen gættet vægt, og alle værdier kan rettes ved sættet.</p></Card>
    <Button disabled={!validation.ok} onClick={() => onContinue(validation.values)}>Gennemse programmet</Button>
    <Button variant="ghost" onClick={onBack} style={{ marginTop: '0.65rem' }}>Tilbage til mine valg</Button>
  </div>
}

function SetupSubmit({ snapshot, busy, error, onSubmit, onBack, onRetryAssignment }) {
  const review = createProgramReviewPackage(snapshot.matchInput)
  const program = createCustomerProgram(review, snapshot.baselineLoads)
  if (snapshot.stage === 'submitted') return <StateMessage label="Program oprettet" title="Uge 1 bliver gjort klar." actionLabel="Hent mit uge-1-program" onAction={onRetryAssignment}>
    Dine valg og startbelastninger er modtaget. Vi åbner programmet, så snart det er klar.
  </StateMessage>
  return <div style={s.page}>
    <Label>Programopsætning · 3 af 3</Label>
    <h1 style={s.h1}>{program.name}</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>{program.rationale}</p>
    {program.sessions.map((session, sessionIndex) => <Card key={session.id}><details open={sessionIndex === 0 ? true : undefined}>
      <summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: color.text, cursor: 'pointer' }}><span>{session.label}</span><Meta>Pas {sessionIndex + 1} af {program.sessions.length}</Meta></summary>
      {session.movements.map(movement => <div key={movement.exerciseId} style={{ padding: '0.55rem 0', borderTop: `1px solid ${color.line}` }}>
        <div style={{ color: color.text }}>{movement.exerciseName}</div>
        <Meta style={{ marginTop: '0.25rem' }}>{movement.prescription.sets} sæt × {movement.prescription.reps} · RPE {movement.prescription.targetRpe} · {movementLoadText(movement, 1)}</Meta>
        <TimedPrescriptionCountdown exerciseName={movement.exerciseName} prescription={movement.prescription} />
      </div>)}
    </details></Card>)}
    {error && <p role="alert" style={{ ...s.body, color: '#d98973' }}>{error}</p>}
    <Button disabled={busy} onClick={onSubmit}>{busy ? 'Opretter uge 1…' : 'Opret mit uge-1-program'}</Button>
    <Button disabled={busy} variant="ghost" onClick={onBack} style={{ marginTop: '0.65rem' }}>Ret startbelastninger</Button>
  </div>
}

function movementLoadText(movement, weekNumber) {
  if (isMemberBodyweightMovement(movement)) return 'kropsvægt'
  const load = Number.isFinite(movement.weekStartingLoadKg)
    ? movement.weekStartingLoadKg
    : weekNumber === 2 && Number.isFinite(movement.weekTwoStartingLoadKg)
      ? movement.weekTwoStartingLoadKg
      : movement.startingLoadKg
  return Number.isFinite(load) ? `${load} kg` : 'vælges ved sættet'
}

function setLoadText(movement, weightKg) {
  if (isMemberBodyweightMovement(movement) && weightKg === 0) return 'Kropsvægt'
  return Number.isFinite(weightKg) ? `${weightKg} kg` : 'vælg belastning'
}

function TimedPrescriptionCountdown({ exerciseName, prescription }) {
  const timed = parseTimedPrescription(prescription)
  const [timer, setTimer] = useState(() => ({
    remaining: timed?.countdownSeconds || 0,
    running: false,
    endsAt: null,
  }))

  useEffect(() => {
    if (!timer.running || !timer.endsAt) return undefined
    const tick = () => setTimer(current => {
      if (!current.running || !current.endsAt) return current
      const remaining = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
      return remaining === 0
        ? { remaining: 0, running: false, endsAt: null }
        : { ...current, remaining }
    })
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [timer.running, timer.endsAt])

  if (!timed) return null
  const start = () => setTimer(current => {
    const remaining = current.remaining > 0 ? current.remaining : timed.countdownSeconds
    return { remaining, running: true, endsAt: Date.now() + remaining * 1000 }
  })
  const pause = () => setTimer(current => {
    if (!current.running || !current.endsAt) return current
    return {
      remaining: Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)),
      running: false,
      endsAt: null,
    }
  })
  const reset = () => setTimer({ remaining: timed.countdownSeconds, running: false, endsAt: null })
  return <div data-timed-prescription style={{ marginTop: '0.65rem', padding: '0.75rem', background: color.bg, border: `1px solid ${color.lineStrong}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
      <Meta>Timer · mål {formatTimedPrescription(timed)}</Meta>
      <span aria-live="polite" aria-label={`${exerciseName} timer`} style={{ color: timer.remaining === 0 ? color.accent : color.text, fontFamily: font.display, fontSize: '1.45rem' }}>{formatDurationSeconds(timer.remaining)}</span>
    </div>
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
      <button type="button" onClick={timer.running ? pause : start} style={{ flex: 1, minHeight: '44px', background: color.panel, border: `1px solid ${color.accentBorder}`, color: color.text, fontFamily: font.mono, cursor: 'pointer' }}>{timer.running ? 'Pause' : timer.remaining === 0 ? 'Start igen' : 'Start timer'}</button>
      <button type="button" onClick={reset} style={{ minHeight: '44px', padding: '0 0.8rem', background: 'transparent', border: `1px solid ${color.lineStrong}`, color: color.muted, fontFamily: font.mono, cursor: 'pointer' }}>Nulstil</button>
    </div>
    <Meta style={{ marginTop: '0.5rem', color: color.dim }}>Timeren er et hjælpemiddel. Sekunder gemmes ikke som reps.</Meta>
  </div>
}

function ExerciseGuidance({ movement, compact = false }) {
  const guidance = memberExerciseGuidance(movement)
  if (!guidance) return null
  if (compact) return <Meta style={{ marginTop: '0.3rem', color: color.muted }}>Fokus: {guidance.cues.join(' · ')}</Meta>
  return <div style={{ margin: '0.65rem 0', padding: '0.7rem 0.8rem', background: color.bg, borderLeft: `2px solid ${color.accentBorder}` }}>
    <Meta style={{ marginBottom: '0.35rem', color: color.accent }}>Fokus i sættet</Meta>
    {guidance.cues.map(cue => <div key={cue} style={{ color: color.text, fontSize: '0.88rem', lineHeight: 1.45 }}>· {cue}</div>)}
  </div>
}

function OpenWeightInput({ value, step, onChange, bodyweight = false }) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : '')
  const buttonStyle = {
    width: '56px',
    minHeight: '48px',
    flexShrink: 0,
    background: color.panel,
    border: `1px solid ${color.lineStrong}`,
    color: color.text,
    fontFamily: font.mono,
    fontSize: '1.05rem',
    cursor: 'pointer',
  }
  const commitText = raw => {
    const cleaned = raw.replace(',', '.')
    if (!/^\d*\.?\d*$/.test(cleaned)) return
    setText(cleaned)
    onChange(cleaned === '' ? null : Math.min(500, Math.max(0, Number(cleaned))))
  }
  const adjust = direction => {
    const current = text === '' ? 0 : Number(text)
    const next = Math.min(500, Math.max(0, Math.round((current + direction * step) * 100) / 100))
    setText(String(next))
    onChange(next)
  }
  const chooseBodyweight = () => {
    setText('0')
    onChange(0)
  }
  return <div style={{ marginBottom: '0.9rem' }}>
    <Meta style={{ marginBottom: '0.35rem', textTransform: 'uppercase' }}>{bodyweight ? 'Belastning' : 'Vægt'}</Meta>
    {bodyweight && <button type="button" aria-pressed={value === 0} onClick={chooseBodyweight} style={{ width: '100%', minHeight: '44px', marginBottom: '0.5rem', background: value === 0 ? color.accentSoft : color.panel, border: `1px solid ${value === 0 ? color.accentBorder : color.lineStrong}`, color: color.text, fontFamily: font.mono, cursor: 'pointer' }}>Kropsvægt · 0 kg</button>}
    <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
      <button aria-label="Vægt ned" onClick={() => adjust(-1)} style={buttonStyle}>−</button>
      <label style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.3rem', background: color.bg, border: `1px solid ${color.lineStrong}` }}>
        <input aria-label={bodyweight ? 'Ekstern belastning' : 'Vægt'} inputMode="decimal" placeholder={bodyweight ? '0' : 'Vælg'} value={text} onChange={event => commitText(event.target.value)} style={{ width: '5.2rem', background: 'transparent', border: 'none', outline: 'none', color: color.text, fontFamily: font.display, fontSize: '1.55rem', textAlign: 'right' }} />
        <Meta>kg</Meta>
      </label>
      <button aria-label="Vægt op" onClick={() => adjust(1)} style={buttonStyle}>+</button>
    </div>
    {bodyweight
      ? value === 0
        ? <Meta style={{ marginTop: '0.35rem', color: color.accent }}>Kropsvægt. Angiv kun ekstra vægt, hvis du brugte den.</Meta>
        : value === null && <Meta style={{ marginTop: '0.35rem', color: color.accent }}>Brug “Kropsvægt · 0 kg”, når der ikke var ekstra vægt.</Meta>
      : value === null && <Meta style={{ marginTop: '0.35rem', color: color.accent }}>Vælg vægten til første sæt. Den kopieres automatisk til næste sæt i øvelsen.</Meta>}
  </div>
}

function WeekHome({ program, weekNumber = 1, completed, onStart, error, draft = null, onResume = null, recovered = false }) {
  const next = program.sessions[completed.length]
  const totalSets = next?.movements.reduce((sum, movement) => sum + Number(movement.prescription?.sets || 0), 0) || 0
  const confirmedSets = draft?.rows?.filter((_, index) => draft.confirmed?.[index]).length || 0
  return <div style={s.page}>
    <Label>Uge {weekNumber} · {completed.length} af {program.sessions.length} pas</Label>
    <h1 style={s.h1}>{draft ? `Fortsæt ${next?.label}` : next?.label || 'Ugen er gennemført'}</h1>
    <p style={{ ...s.body, marginBottom: '0.9rem' }}>{draft
      ? `${confirmedSets} af ${draft.rows.length} sæt er logget. Kladden er gemt på denne enhed.`
      : `${totalSets} arbejdssæt. Dine startbelastninger er klar, og du fortsætter samme sted efter en refresh.`}</p>
    {recovered && <Card style={{ borderColor: color.accentBorder }}><Label tone="muted">Historik fundet</Label><p style={{ ...s.body, color: color.text, margin: 0 }}>Din pasrækkefølge er genskabt fra gemte træninger. Denne uge holder vægtene, indtil en ny fuld uge er vurderet.</p></Card>}
    {error && <p role="alert" style={{ ...s.body, color: '#d98973' }}>{error}</p>}
    <Button onClick={draft ? onResume : onStart}>{draft ? `Fortsæt ${next?.label}` : `Start ${next?.label || 'næste pas'}`}</Button>
    {next && <Card>
      <details>
        <summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: color.text, cursor: 'pointer' }}><span>Se øvelser og startvægte</span><Meta>{next.movements.length} øvelser</Meta></summary>
        {next.movements.map(movement => <div key={movement.exerciseId} style={{ padding: '0.7rem 0', borderTop: `1px solid ${color.line}` }}>
          <div style={{ color: color.text }}>{movement.exerciseName}</div>
          <Meta style={{ marginTop: '0.25rem' }}>{movement.prescription.sets} sæt × {movement.prescription.reps} · mål RPE {movement.prescription.targetRpe} · {movementLoadText(movement, weekNumber)}</Meta>
          <TimedPrescriptionCountdown exerciseName={movement.exerciseName} prescription={movement.prescription} />
        </div>)}
      </details>
    </Card>}
  </div>
}

function StrictSessionLog({ session, weekNumber, draft, onDraftChange, onPersist, onBack }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeSetRef = useRef(null)
  const movementByExercise = useMemo(() => new Map(session.movements.map(movement => [movement.exerciseId, movement])), [session.movements])
  const ready = isCustomerSessionReady(draft.rows, draft.confirmed, validateCustomerSetLog)
  const confirmedCount = draft.rows.filter((_, index) => draft.confirmed[index]).length
  useEffect(() => {
    if (draft.activeIndex === null || !activeSetRef.current) return
    activeSetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [draft.activeIndex])
  const updateRow = (index, field, value) => onDraftChange({
    ...draft,
    rows: draft.rows.map((row, rowIndex) => rowIndex === index ? {
      ...row,
      actual: { ...row.actual, [field]: value, ...(field === 'weightKg' ? { weightTouched: true } : {}) },
    } : row),
  })
  const toggleSkip = index => onDraftChange({
    ...draft,
    rows: draft.rows.map((row, rowIndex) => rowIndex !== index ? row : {
      ...row,
      actual: row.actual.skipped
        ? { weightKg: isMemberBodyweightMovement(movementByExercise.get(row.exerciseId)) ? 0 : row.planned.weightKg, weightTouched: false, repsCompleted: row.planned.reps, rpeActual: row.planned.rpe, note: row.actual.note, skipped: false }
        : { weightKg: null, weightTouched: false, repsCompleted: null, rpeActual: null, note: row.actual.note, skipped: true },
    }),
  })
  const confirm = index => {
    const currentRow = draft.rows[index]
    const movement = movementByExercise.get(currentRow.exerciseId)
    const normalizedRow = isMemberBodyweightMovement(movement) && currentRow.actual.skipped === false && currentRow.actual.weightKg === null
      ? { ...currentRow, actual: { ...currentRow.actual, weightKg: 0 } }
      : currentRow
    if (!validateCustomerSetLog(normalizedRow).ok) {
      setError('Vælg en belastning, eller markér sættet tydeligt som sprunget over.')
      return
    }
    setError('')
    const confirmed = { ...draft.confirmed, [index]: true }
    const rows = draft.rows.map((row, rowIndex) => rowIndex === index ? normalizedRow : row)
    const nextDraft = {
      ...draft,
      rows,
      confirmed,
      activeIndex: nextUnconfirmedSetIndex(draft.rows.length, confirmed, index),
    }
    onDraftChange(prefillNextAssistanceSetLoad(nextDraft, index))
  }
  const edit = index => onDraftChange({ ...draft, confirmed: { ...draft.confirmed, [index]: false }, activeIndex: index })
  const finish = async () => {
    const entry = memberSessionEntryFromDraft(draft, session)
    if (!entry || !ready) return setError('Alle planlagte sæt skal være logget eller tydeligt sprunget over.')
    setBusy(true)
    setError('')
    try { await onPersist(entry) } catch (persistError) {
      setError(persistError?.message || 'Passet kunne ikke gemmes. Dine sæt bliver stående, så du kan prøve igen.')
    } finally { setBusy(false) }
  }
  return <div style={s.page}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}><Label>Uge {weekNumber} · {session.label}</Label><Meta>{confirmedCount}/{draft.rows.length} sæt afklaret</Meta></div>
    <h1 style={s.h1}>Log ét sæt ad gangen.</h1>
    <p style={{ ...s.body, marginBottom: '0.8rem' }}>Ret vægt, reps eller RPE, hvis sættet afveg fra planen. Hvert valg gemmes på denne enhed.</p>
    <Button variant="ghost" onClick={onBack} style={{ marginBottom: '0.9rem' }}>Gem og gå tilbage</Button>
    {session.movements.map((movement, movementIndex) => {
      const bodyweight = isMemberBodyweightMovement(movement)
      const rows = draft.rows.map((row, index) => ({ row, index })).filter(item => item.row.exerciseId === movement.exerciseId)
      const movementConfirmed = rows.filter(({ index }) => draft.confirmed[index]).length
      const activeMovement = rows.some(({ index }) => index === draft.activeIndex)
      const openMovement = activeMovement || (draft.activeIndex === null && movementIndex === session.movements.length - 1)
      return <Card key={movement.exerciseId} style={{ borderColor: color.lineStrong }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.65rem', alignItems: 'baseline' }}><Label tone="muted">Øvelse {movementIndex + 1} af {session.movements.length}</Label><Meta>{movementConfirmed}/{rows.length} sæt</Meta></div>
        <h2 style={{ fontFamily: font.display, fontWeight: 400, fontSize: '1.4rem', lineHeight: 1.15, color: color.text, margin: '0 0 0.3rem' }}>{movement.exerciseName}</h2>
        <Meta style={{ marginBottom: '0.6rem' }}>{movement.prescription.sets} sæt × {movement.prescription.reps} · mål RPE {movement.prescription.targetRpe} · {movementLoadText(movement, weekNumber)}</Meta>
        {!openMovement && <button type="button" onClick={() => onDraftChange({ ...draft, activeIndex: rows.find(({ index }) => !draft.confirmed[index])?.index ?? rows[0].index })} style={{ width: '100%', minHeight: '44px', background: 'transparent', border: `1px solid ${color.lineStrong}`, color: color.muted, fontFamily: font.mono, cursor: 'pointer' }}>{movementConfirmed === rows.length ? 'Se og ret sæt' : 'Åbn øvelsen'}</button>}
        {openMovement && <ExerciseGuidance movement={movement} />}
        {openMovement && <TimedPrescriptionCountdown exerciseName={movement.exerciseName} prescription={movement.prescription} />}
        {openMovement && rows.map(({ row, index }) => {
          const presentation = customerSetPresentationState({ index, activeIndex: draft.activeIndex, confirmed: draft.confirmed })
          return <div ref={index === draft.activeIndex ? activeSetRef : null} key={`${row.exerciseId}-${row.setNumber}`} data-set-state={presentation} style={{ border: presentation === 'active' ? `1px solid ${color.accentBorder}` : 'none', borderTop: `1px solid ${presentation === 'active' ? color.accentBorder : color.line}`, background: presentation === 'active' ? color.accentSoft : 'transparent', margin: presentation === 'active' ? '0.2rem -0.45rem' : 0, padding: presentation === 'active' ? '0.8rem 0.45rem' : '0.8rem 0', opacity: draft.confirmed[index] ? 0.76 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}><Meta>Sæt {row.setNumber}</Meta><Meta style={{ color: presentation === 'upcoming' ? color.dim : color.accent }}>{presentation === 'logged' ? 'Logget' : presentation === 'active' ? 'Klar' : 'Ikke logget'}</Meta></div>
            {draft.confirmed[index] ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', marginTop: '0.4rem' }}><Meta>{row.actual.skipped ? `Sprunget over${row.actual.note ? ` · ${row.actual.note}` : ''}` : `${setLoadText(movement, row.actual.weightKg)} × ${row.actual.repsCompleted} · RPE ${row.actual.rpeActual}`}</Meta><button onClick={() => edit(index)} style={{ background: 'none', border: 'none', padding: '0.25rem', color: color.muted, fontFamily: font.mono, cursor: 'pointer' }}>Ret</button></div>
              : index !== draft.activeIndex ? <button onClick={() => onDraftChange({ ...draft, activeIndex: index })} style={{ width: '100%', minHeight: '44px', marginTop: '0.55rem', background: 'transparent', border: `1px solid ${color.lineStrong}`, color: color.muted, fontFamily: font.mono, cursor: 'pointer' }}>Åbn sæt {row.setNumber}</button>
                : row.actual.skipped ? <div style={{ marginTop: '0.55rem' }}><Meta>Dette sæt markeres som sprunget over.</Meta><Button variant="soft" onClick={() => confirm(index)} style={{ marginTop: '0.65rem' }}>Bekræft spring over</Button><button onClick={() => toggleSkip(index)} style={{ display: 'block', margin: '0.55rem auto 0', background: 'none', border: 'none', color: color.muted, fontFamily: font.mono, cursor: 'pointer' }}>Fortryd</button></div>
                  : <div style={{ marginTop: '0.65rem' }}>
                    <div style={{ background: color.bg, border: `1px solid ${color.line}`, padding: '0.8rem' }}>
                      <Meta style={{ marginBottom: '0.65rem' }}>Plan: {bodyweight ? 'Kropsvægt' : setLoadText(movement, row.planned.weightKg)} × {row.planned.reps} · mål RPE {row.planned.rpe}</Meta>
                      <OpenWeightInput value={bodyweight && row.actual.weightKg === null ? 0 : row.actual.weightKg} step={movement.prescription.loadIncrementKg || 2.5} bodyweight={bodyweight} onChange={value => updateRow(index, 'weightKg', value)} />
                      <Stepper label="Faktiske reps" value={row.actual.repsCompleted} unit="reps" step={1} min={1} max={30} onChange={value => updateRow(index, 'repsCompleted', value)} />
                      <ChipRow label="Faktisk RPE" options={[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]} value={row.actual.rpeActual} onChange={value => updateRow(index, 'rpeActual', value)} />
                      <input aria-label={`Note til ${movement.exerciseName} sæt ${row.setNumber}`} value={row.actual.note} onChange={event => updateRow(index, 'note', event.target.value)} placeholder="Kort note (valgfri)" maxLength={500} style={inputStyle} />
                    </div>
                    <Button onClick={() => confirm(index)} style={{ marginTop: '0.65rem' }}>Log sæt {row.setNumber}</Button>
                    <button onClick={() => toggleSkip(index)} style={{ display: 'block', margin: '0.7rem auto 0', padding: '0.35rem', background: 'none', border: 'none', color: color.dim, fontFamily: font.mono, fontSize: '0.58rem', cursor: 'pointer' }}>Spring over dette sæt</button>
                  </div>}
          </div>
        })}
      </Card>
    })}
    {error && <p role="alert" style={{ ...s.body, color: '#d98973' }}>{error}</p>}
    <Button disabled={!ready || busy} onClick={finish}>{busy ? 'Gemmer passet…' : `Afslut og gem pas · ${confirmedCount}/${draft.rows.length}`}</Button>
    <Meta style={{ marginTop: '0.85rem', textAlign: 'center' }}>Gemt efter hvert sæt.</Meta>
  </div>
}

function WeekReview({ weekNumber, completed, review: reviewValue, onChange, onContinue }) {
  const logs = completed.flatMap(entry => entry.setLogs)
  const summary = summarizeCustomerWeek(logs, weekNumber)
  const review = reviewValue || { rating: '', note: '', completedAt: null }
  return <div style={s.page}>
    <Label>Uge {weekNumber} gennemført</Label>
    <h1 style={s.h1}>Hvordan var ugen samlet?</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>Når de planlagte sæt er gennemført, foreslår vi normalt næste vægttrin. Manglende reps, højere RPE end planlagt eller “For hård” holder belastningen tilbage.</p>
    <Card><Label tone="muted">Registreret</Label><Meta>{summary.completedSets}/{summary.plannedSets} sæt gennemført · {summary.skippedSets} sprunget over · gennemsnitlig RPE {summary.averageRpeActual ?? '—'}</Meta></Card>
    <Card><Meta style={{ marginBottom: '0.5rem' }}>Din vurdering</Meta><ChoiceList options={REVIEW_OPTIONS} value={review.rating} onChange={rating => onChange({ ...review, rating, completedAt: null })} /></Card>
    <label><Meta style={{ marginBottom: '0.4rem' }}>Note (valgfri)</Meta><textarea value={review.note} onChange={event => onChange({ ...review, note: event.target.value.slice(0, 500), completedAt: null })} placeholder="Hvad skal næste uge tage højde for?" rows={4} style={{ ...inputStyle, resize: 'vertical', marginBottom: '1rem' }} /></label>
    <Button disabled={!review.rating} onClick={() => onContinue({ ...review, note: review.note.trim(), completedAt: new Date().toISOString() })}>Se forslag til uge {weekNumber + 1}</Button>
  </div>
}

function ProposalItem({ item, forceKeep }) {
  const increases = item.action === 'increase-load' && !forceKeep
  const from = Number.isFinite(item.fromLoadKg) ? `${item.fromLoadKg} kg` : 'ingen bekræftet belastning'
  const to = increases && Number.isFinite(item.toLoadKg) ? `${item.toLoadKg} kg` : from
  return <div style={{ padding: '0.75rem 0', borderTop: `1px solid ${color.line}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}><span style={{ color: color.text }}>{item.exerciseName}</span><Meta style={{ color: increases ? color.accent : color.muted }}>{increases ? 'Foreslår stigning' : 'Behold'}</Meta></div>
    <Meta style={{ marginTop: '0.3rem' }}>{increases ? `${from} → ${to}` : `Næste start: ${to}`}</Meta>
    <Meta style={{ marginTop: '0.25rem', color: color.muted }}>{forceKeep
      ? 'Du markerede ugen som for hård. Derfor øges belastningen ikke.'
      : item.action === 'increase-load'
        ? `Alle planlagte sæt blev gennemført inden for RPE-målet. Derfor foreslår vi +${item.progressionKg} kg.`
        : item.roleClass === 'assistance' && Number.isFinite(item.toLoadKg)
          ? 'Næste uge starter med din senest brugte vægt.'
          : 'Belastningen bliver stående, fordi hele grundlaget for en stigning ikke var til stede.'}</Meta>
  </div>
}

function NextWeekProposal({ program, completed, weekNumber, review, onChoose, error }) {
  const nextWeekNumber = weekNumber + 1
  const proposal = buildNextWeekProposal(program, completed, nextWeekNumber)
  const items = proposal.proposals || proposal.items || []
  const forceKeep = review.rating === 'too-hard'
  const hasIncrease = !forceKeep && items.some(item => item.action === 'increase-load')
  return <div style={s.page}>
    <Label>Forslag til uge {nextWeekNumber}</Label>
    <h1 style={s.h1}>Her er præcis, hvad der ændres.</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>Forslaget bygger på dine gennemførte sæt og din vurdering. Det bruges først, når du vælger det.</p>
    <Card><Label tone="muted">Din vurdering</Label><p style={{ ...s.body, color: color.text, margin: 0 }}>{REVIEW_OPTIONS.find(item => item.value === review.rating)?.label}{review.note ? ` · ${review.note}` : ''}</p></Card>
    <Card><Label tone="muted">Næste uges start</Label>{items.map(item => <ProposalItem key={item.exerciseId} item={item} forceKeep={forceKeep} />)}</Card>
    {error && <p role="alert" style={{ ...s.body, color: '#d98973' }}>{error}</p>}
    <Button onClick={() => onChoose(forceKeep ? 'kept' : 'accepted', proposal)}>{forceKeep ? 'Fortsæt med samme vægte' : hasIncrease ? 'Brug forslaget' : 'Brug de viste vægte'}</Button>
    {!forceKeep && <Button variant="ghost" onClick={() => onChoose('kept', proposal)} style={{ marginTop: '0.65rem' }}>Behold samme vægte</Button>}
  </div>
}

function WeekComplete({ weekNumber, completed, onContinue, onHistory }) {
  const summary = summarizeCustomerWeek(completed.flatMap(entry => entry.setLogs), weekNumber)
  return <div style={s.page}>
    <Label>Uge {weekNumber} gennemført</Label>
    <h1 style={s.h1}>Ugen er gemt.</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>Næste uge tager udgangspunkt i dine loggede sæt og din vurdering.</p>
    <Card><Label tone="muted">Uge {weekNumber}</Label><Meta>{summary.completedSets}/{summary.plannedSets} sæt gennemført · {summary.skippedSets} sprunget over · gennemsnitlig RPE {summary.averageRpeActual ?? '—'}</Meta></Card>
    <Button onClick={onContinue}>Vurder uge {weekNumber} og fortsæt</Button>
    <Button variant="ghost" onClick={onHistory} style={{ marginTop: '0.65rem' }}>Se historik</Button>
  </div>
}

function HistoryScreen({ progress, reviews, onToday }) {
  const sessions = progress.sessionSummaries || []
  const trends = (progress.mainMovementTrends || []).filter(item => item.latest)
  return <div style={s.page}>
    <Label>Din træning</Label>
    <h1 style={s.h1}>Historik og udvikling.</h1>
    <p style={{ ...s.body, marginBottom: '1rem' }}>Her ser du det, du faktisk har logget. Sammenligninger vises kun, når reps og RPE er ens.</p>
    {!sessions.length && <Card><Label tone="muted">Ingen gemte pas endnu</Label><p style={{ ...s.body, color: color.text, margin: '0 0 0.8rem' }}>Dit første afsluttede pas bliver vist her med øvelser, sæt og belastninger.</p><Button variant="ghost" onClick={onToday}>Gå til dagens pas</Button></Card>}
    {trends.length > 0 && <Card><Label tone="muted">Seneste hovedløft</Label>{trends.map(item => <div key={item.exerciseId} style={{ padding: '0.7rem 0', borderTop: `1px solid ${color.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.65rem' }}><span style={{ color: color.text }}>{item.exerciseName}</span><Meta>{item.latest.lastSet.displayLoad}</Meta></div>
      <Meta style={{ marginTop: '0.25rem' }}>{item.latest.lastSet.reps} reps · RPE {item.latest.lastSet.rpe} · {shortDate(item.latest.date)}</Meta>
      {item.comparison.comparable && <Meta style={{ marginTop: '0.25rem', color: item.comparison.loadDeltaKg > 0 ? color.good : color.muted }}>{item.comparison.loadDeltaKg > 0 ? '+' : ''}{String(item.comparison.loadDeltaKg).replace('.', ',')} kg ved samme reps og RPE</Meta>}
    </div>)}</Card>}
    {reviews.length > 0 && <Card><Label tone="muted">Ugevurderinger</Label>{reviews.map(review => <div key={review.weekNumber} style={{ padding: '0.7rem 0', borderTop: `1px solid ${color.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.65rem' }}><span style={{ color: color.text }}>Uge {review.weekNumber}</span><Meta>{REVIEW_OPTIONS.find(item => item.value === review.rating)?.label || 'Vurderet'}</Meta></div>
      {review.note && <p style={{ ...s.body, color: color.text, margin: '0.35rem 0 0' }}>{review.note}</p>}
    </div>)}</Card>}
    {sessions.length > 0 && <Card><Label tone="muted">Seneste pas</Label>{sessions.map(session => <div key={session.clientId} style={{ padding: '0.7rem 0', borderTop: `1px solid ${color.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.65rem' }}><span style={{ color: color.text }}>{session.sessionLabel}</span><Meta>{shortDate(session.date)}</Meta></div>
      <Meta style={{ marginTop: '0.25rem' }}>{session.setCount} sæt gennemført{session.skippedSetCount ? ` · ${session.skippedSetCount} sprunget over` : ''} · {session.syncStatus === 'synced' ? 'gemt' : session.syncStatus === 'failed' ? 'afventer synk' : 'gemt på enheden'}</Meta>
    </div>)}</Card>}
  </div>
}

function ProgramScreen({ program, weekNumber, matchInput, onToday, onLogout }) {
  const level = matchInput.level === 'oevet' ? 'Øvet' : 'Nybegynder'
  const equipment = matchInput.equipment === 'gym' ? 'Full Gym' : 'Hjemmetræning'
  const squat = matchInput.squatStyle === 'low-bar' ? 'Low-bar squat' : 'High-bar squat'
  const deadlift = matchInput.deadliftStyle === 'sumo' ? 'Sumo dødløft' : 'Konventionel dødløft'
  return <div style={s.page}>
    <Label>Dit program · uge {weekNumber}</Label>
    <h1 style={s.h1}>{program.name}</h1>
    <p style={{ ...s.body, marginBottom: '0.8rem' }}>{program.rationale}</p>
    <Card style={{ borderColor: color.accentBorder }}><Label tone="muted">Tilpasset efter dine svar</Label><p style={{ ...s.body, color: color.text, margin: 0 }}>{level} · {matchInput.daysPerWeek} dage · {equipment} · {squat} · {deadlift}</p></Card>
    <Card><Label tone="muted">Sådan udvikler planen sig</Label><p style={{ ...s.body, color: color.text, margin: 0 }}>Et fuldt gennemført hovedløft inden for rep- og RPE-målet giver normalt ét vægttrin næste uge. “For hård”, manglende reps eller høj RPE holder vægten. Assistance starter med din senest loggede belastning.</p></Card>
    {program.sessions.map(session => <Card key={session.id}><details><summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: color.text, cursor: 'pointer' }}><span>{session.label}</span><Meta>{session.movements.length} øvelser</Meta></summary>{session.movements.map(movement => <div key={movement.exerciseId} style={{ padding: '0.65rem 0', borderTop: `1px solid ${color.line}` }}><div style={{ color: color.text }}>{movement.exerciseName}</div><Meta>{movement.prescription.sets} sæt × {movement.prescription.reps} · RPE {movement.prescription.targetRpe} · {movementLoadText(movement, weekNumber)}</Meta><ExerciseGuidance movement={movement} compact /></div>)}</details></Card>)}
    <Button onClick={onToday}>Gå til dagens pas</Button>
    <Button variant="ghost" onClick={onLogout} style={{ marginTop: '0.65rem' }}>Log ud</Button>
  </div>
}

function MemberTabs({ tab, onChange }) {
  return <TabBar tab={tab} onChange={onChange} tabs={[
    { id: 'today', label: 'I dag' },
    { id: 'history', label: 'Historik' },
    { id: 'program', label: 'Program' },
  ]} />
}

export default function MemberJourney({
  userId,
  assignment,
  program = null,
  historySessions = [],
  initialMatchInput = null,
  onCompleteSetup,
  onPersistSession,
  onLogout,
  onRetry = null,
}) {
  const stableUserId = String(userId || '')
  const resolved = useMemo(() => resolveAssignment(assignment, initialMatchInput, program), [assignment, initialMatchInput, program])
  const bindingToken = resolved.binding ? memberJourneyFingerprint(resolved.binding) : 'none'

  if (!stableUserId) return <div style={s.wrap}><StateMessage label="Medlemskonto" title="Bruger-id mangler." onLogout={onLogout}>Log ind igen, så program og lokal kladde kan bindes til den rigtige konto.</StateMessage></div>
  if (resolved.status === 'loading') return <div style={s.wrap}><StateMessage label="Medlemskonto" title="Henter dit program…" actionLabel={onRetry ? 'Prøv igen' : 'Log ud'} onAction={onRetry || onLogout}>Vi finder dit program og den seneste træningslog.</StateMessage></div>
  if (resolved.status === 'error') return <div style={s.wrap}><StateMessage label="Medlemskonto" title="Vi kan ikke åbne din træning endnu." actionLabel={onRetry ? 'Prøv igen' : 'Log ud'} onAction={onRetry || onLogout}>{resolved.reason}</StateMessage></div>
  return <MemberJourneyState
    key={`${stableUserId}:${bindingToken}`}
    stableUserId={stableUserId}
    resolved={resolved}
    historySessions={historySessions}
    initialMatchInput={initialMatchInput}
    onCompleteSetup={onCompleteSetup}
    onPersistSession={onPersistSession}
    onLogout={onLogout}
    onRetry={onRetry}
  />
}

function MemberJourneyState({
  stableUserId,
  resolved,
  historySessions,
  initialMatchInput,
  onCompleteSetup,
  onPersistSession,
  onLogout,
  onRetry,
}) {
  const bindingToken = memberJourneyFingerprint(resolved.binding)
  const [initial] = useState(() => {
    const fresh = freshSnapshot(stableUserId, resolved, initialMatchInput, historySessions)
    return { ...fresh, storageError: fresh.value ? !saveMemberJourneySnapshot(fresh.value) : false }
  })
  const [snapshot, setSnapshot] = useState(initial.value)
  const snapshotRef = useRef(initial.value)
  const [storageError, setStorageError] = useState(initial.storageError)
  const [setupBusy, setSetupBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [tab, setTab] = useState('today')
  const [sessionLogOpen, setSessionLogOpen] = useState(true)
  const progress = useMemo(() => buildMemberProgress({
    sessions: historySessions,
    assignment: { assignmentId: resolved.assignmentId, programId: resolved.programId },
    program: resolved.program,
  }), [historySessions, resolved.assignmentId, resolved.programId, resolved.program])
  const screenResetKey = [
    snapshot?.stage || '',
    snapshot?.sessionDraft?.clientId || '',
    snapshot?.completedWeekOne?.length || 0,
    snapshot?.completedWeekTwo?.length || 0,
    snapshot?.ongoing?.completed?.length || 0,
    tab,
  ].join(':')

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [screenResetKey])

  const commitSnapshot = useCallback(update => {
    const next = typeof update === 'function' ? update(snapshotRef.current) : update
    snapshotRef.current = next
    setSnapshot(next)
    setStorageError(!saveMemberJourneySnapshot(next))
  }, [])

  const retryStorage = () => {
    if (snapshotRef.current && saveMemberJourneySnapshot(snapshotRef.current)) setStorageError(false)
  }
  const withNotice = (screen, { navigation = false } = {}) => <div style={s.wrap}>
    {storageError && <StorageNotice onRetry={retryStorage} />}
    {screen}
    {navigation && <MemberTabs tab={tab} onChange={next => { setSessionLogOpen(false); setTab(next) }} />}
  </div>

  if (initial.recoveryBlocked) {
    const refreshRecovery = onRetry
      ? async () => {
        const refreshed = await onRetry()
        if (refreshed && typeof window !== 'undefined') window.location.reload()
      }
      : onLogout
    return withNotice(<StateMessage label="Din træningshistorik" title="Vi kan ikke placere dit næste pas sikkert endnu." actionLabel={onRetry ? 'Hent historikken igen' : 'Log ud'} onAction={refreshRecovery}>Vi fandt gemte pas, men rækkefølgen eller sættene var ikke komplette nok til at genskabe ugen uden at gætte. Historikken er ikke slettet, og appen starter ikke forfra.</StateMessage>)
  }
  if (!snapshot || memberJourneyFingerprint(snapshot.binding) !== bindingToken) return withNotice(<StateMessage label="Medlemskonto" title="Åbner det rigtige program…" actionLabel={onRetry ? 'Prøv igen' : 'Log ud'} onAction={onRetry || onLogout}>En gammel lokal kladde bliver ikke åbnet under en ny programtildeling.</StateMessage>)

  if (resolved.status === 'setup') {
    const changeMatch = matchInput => commitSnapshot(current => ({ ...current, stage: 'match', matchInput, baselineLoads: emptyBaselineLoads() }))
    const submit = async () => {
      const matchInput = canonicalMatchInput(snapshot.matchInput)
      const baseline = validateBaselineLoads(snapshot.baselineLoads)
      if (!matchInput || !baseline.ok) return setActionError('Opsætningen mangler gyldige programvalg eller startbelastninger.')
      if (typeof onCompleteSetup !== 'function') return setActionError('Opsætningen kan ikke sendes endnu. Prøv igen fra medlemslinket.')
      setSetupBusy(true)
      setActionError('')
      try {
        await onCompleteSetup({ requestId: snapshot.requestId, matchInput, baselineLoads: baseline.values })
        commitSnapshot(current => ({ ...current, stage: 'submitted', matchInput, baselineLoads: baseline.values }))
      } catch (error) {
        setActionError(error?.message || 'Programmet kunne ikke oprettes. Dine valg er gemt, så du kan prøve igen.')
      } finally { setSetupBusy(false) }
    }
    if (snapshot.stage === 'match') return withNotice(<MatchSetup snapshot={snapshot} onChange={changeMatch} onContinue={matchInput => commitSnapshot(current => ({ ...current, stage: 'baseline', matchInput }))} onLogout={onLogout} />)
    if (snapshot.stage === 'baseline') return withNotice(<BaselineSetup snapshot={snapshot} onChange={baselineLoads => commitSnapshot(current => ({ ...current, baselineLoads }))} onBack={() => commitSnapshot(current => ({ ...current, stage: 'match' }))} onContinue={baselineLoads => commitSnapshot(current => ({ ...current, stage: 'submit', baselineLoads }))} />)
    return withNotice(<SetupSubmit snapshot={snapshot} busy={setupBusy} error={actionError} onSubmit={submit} onBack={() => commitSnapshot(current => ({ ...current, stage: 'baseline' }))} onRetryAssignment={onRetry || submit} />)
  }

  const visibleWeekNumber = snapshot.ongoing?.weekNumber
    || (snapshot.stage.startsWith('week-two') ? 2 : 1)
  const visibleProgram = snapshot.ongoing
    ? ongoingWeekProgram(resolved.program, snapshot) || resolved.program
    : snapshot.weekTwoChoice
      ? weekTwoProgram(resolved.program, snapshot) || resolved.program
      : resolved.program
  if (tab === 'history') return withNotice(<HistoryScreen progress={progress} reviews={snapshotReviewHistory(snapshot)} onToday={() => setTab('today')} />, { navigation: true })
  if (tab === 'program') return withNotice(<ProgramScreen program={visibleProgram} weekNumber={visibleWeekNumber} matchInput={resolved.matchInput} onToday={() => setTab('today')} onLogout={onLogout} />, { navigation: true })

  if (typeof onPersistSession !== 'function') return withNotice(<StateMessage label="Træningslog" title="Gemning er ikke klar." actionLabel={onRetry ? 'Prøv igen' : 'Log ud'} onAction={onRetry || onLogout}>Programmet er sikkert åbnet, men passet kan ikke gemmes endnu.</StateMessage>)

  const startSession = (session, weekNumber, ongoing = false) => {
    const timed = timedMovementInSession(session)
    if (timed) {
      return setActionError(`${timed.movement.exerciseName} har et tidsmål på ${formatTimedPrescription(timed.timed)}. Timeren kan bruges her, men passet kan ikke gemmes endnu, fordi medlemsloggen ikke har et sikkert felt til varighed. Sekunder bliver ikke gemt som reps.`)
    }
    const draft = createMemberSessionDraft({ assignmentId: resolved.assignmentId, session, weekNumber })
    if (!draft) return setActionError('Passet kunne ikke åbnes sikkert. Prøv at hente programmet igen.')
    setActionError('')
    setSessionLogOpen(true)
    setTab('today')
    commitSnapshot(current => ({
      ...current,
      stage: ongoing ? 'ongoing-session' : weekNumber === 1 ? 'week-one' : 'week-two-session',
      sessionDraft: draft,
    }))
  }
  const persistSession = async (entry, weekNumber, ongoing = false) => {
    const activeProgram = ongoing ? ongoingWeekProgram(resolved.program, snapshot) : weekNumber === 2 ? weekTwoProgram(resolved.program, snapshot) : null
    const outbound = {
      ...entry,
      programId: resolved.programId,
      weekTwoChoice: ongoing ? snapshot.ongoing.currentChoice : weekNumber === 2 ? snapshot.weekTwoChoice : null,
      acceptedProposalId: activeProgram?.acceptedProposalId || null,
    }
    await onPersistSession(outbound)
    setSessionLogOpen(false)
    commitSnapshot(current => {
      if (ongoing) {
        const completed = [...current.ongoing.completed, outbound]
        return {
          ...current,
          ongoing: { ...current.ongoing, completed },
          sessionDraft: null,
          stage: completed.length === resolved.program.sessions.length ? 'ongoing-review' : 'ongoing-ready',
        }
      }
      if (weekNumber === 1) {
        const completedWeekOne = [...current.completedWeekOne, outbound]
        return { ...current, completedWeekOne, sessionDraft: null, stage: completedWeekOne.length === resolved.program.sessions.length ? 'week-review' : 'week-one' }
      }
      const completedWeekTwo = [...current.completedWeekTwo, outbound]
      return { ...current, completedWeekTwo, sessionDraft: null, stage: completedWeekTwo.length === resolved.program.sessions.length ? 'week-two-complete' : 'week-two-ready' }
    })
  }

  if (snapshot.stage === 'week-one') {
    const session = resolved.program.sessions[snapshot.completedWeekOne.length]
    if (snapshot.sessionDraft && sessionLogOpen) return withNotice(<StrictSessionLog session={session} weekNumber={1} draft={snapshot.sessionDraft} onDraftChange={draft => commitSnapshot(current => ({ ...current, sessionDraft: draft }))} onPersist={entry => persistSession(entry, 1)} onBack={() => setSessionLogOpen(false)} />)
    return withNotice(<WeekHome program={resolved.program} weekNumber={1} completed={snapshot.completedWeekOne} draft={snapshot.sessionDraft} onResume={() => setSessionLogOpen(true)} onStart={() => startSession(session, 1)} error={actionError} />, { navigation: true })
  }
  if (snapshot.stage === 'week-review') return withNotice(<WeekReview weekNumber={1} completed={snapshot.completedWeekOne} review={snapshot.weeklyReview} onChange={weeklyReview => commitSnapshot(current => ({ ...current, weeklyReview }))} onContinue={weeklyReview => commitSnapshot(current => ({ ...current, weeklyReview, stage: 'week-two-proposal' }))} />, { navigation: true })
  if (snapshot.stage === 'week-two-proposal') {
    const choose = (choice, proposal) => {
      const nextProgram = createWeekTwoView(resolved.program, choice === 'accepted' ? proposal : null)
      if (nextProgram.progressionChoice === 'rejected-invalid-proposal') return setActionError('Forslaget matcher ikke længere programmet. Hent et nyt forslag, før du fortsætter.')
      setActionError('')
      commitSnapshot(current => ({ ...current, weekTwoChoice: choice, stage: 'week-two-ready' }))
    }
    return withNotice(<NextWeekProposal program={resolved.program} completed={snapshot.completedWeekOne} weekNumber={1} review={snapshot.weeklyReview} onChoose={choose} error={actionError} />, { navigation: true })
  }
  if (['week-two-ready', 'week-two-session', 'week-two-complete'].includes(snapshot.stage)) {
    const weekTwo = weekTwoProgram(resolved.program, snapshot)
    if (!weekTwo || weekTwo.progressionChoice === 'rejected-invalid-proposal') return withNotice(<StateMessage label="Uge 2" title="Forslaget kunne ikke åbnes sikkert." actionLabel="Lav forslaget igen" onAction={() => commitSnapshot(current => ({ ...current, weekTwoChoice: null, stage: 'week-two-proposal' }))}>Uge 1 er bevaret. Ingen belastning er ændret.</StateMessage>)
    if (snapshot.stage === 'week-two-complete') {
      const continueJourney = () => {
        const ongoing = createOngoingCycle({
          stage: 'ongoing-review',
          weekNumber: 2,
          previousCompleted: snapshot.completedWeekOne,
          completed: snapshot.completedWeekTwo,
          currentChoice: snapshot.weekTwoChoice,
          currentProposalId: snapshot.weekTwoChoice === 'accepted' ? weekTwo.acceptedProposalId : null,
          review: null,
          reviews: snapshot.weeklyReview ? [{ weekNumber: 1, ...snapshot.weeklyReview }] : [],
          recoveredFromHistory: false,
        })
        if (!ongoing) return setActionError('Ugen kunne ikke gøres klar til vurdering. Dine pas er stadig gemt.')
        commitSnapshot(current => ({ ...current, ongoing, sessionDraft: null, stage: 'ongoing-review' }))
      }
      return withNotice(<WeekComplete weekNumber={2} completed={snapshot.completedWeekTwo} onContinue={continueJourney} onHistory={() => setTab('history')} />, { navigation: true })
    }
    const session = weekTwo.sessions[snapshot.completedWeekTwo.length]
    if (snapshot.stage === 'week-two-session' && snapshot.sessionDraft && sessionLogOpen) return withNotice(<StrictSessionLog session={session} weekNumber={2} draft={snapshot.sessionDraft} onDraftChange={draft => commitSnapshot(current => ({ ...current, sessionDraft: draft }))} onPersist={entry => persistSession(entry, 2)} onBack={() => setSessionLogOpen(false)} />)
    return withNotice(<WeekHome program={weekTwo} weekNumber={2} completed={snapshot.completedWeekTwo} draft={snapshot.sessionDraft} onResume={() => setSessionLogOpen(true)} onStart={() => startSession(session, 2)} error={actionError} />, { navigation: true })
  }

  const ongoingProgram = ongoingWeekProgram(resolved.program, snapshot)
  if (!ongoingProgram) return withNotice(<StateMessage label={`Uge ${snapshot.ongoing?.weekNumber || ''}`} title="Ugens vægte kunne ikke genskabes." actionLabel={onRetry ? 'Hent programmet igen' : 'Log ud'} onAction={onRetry || onLogout}>Dine afsluttede pas er bevaret. Appen starter ikke en ny uge på et usikkert grundlag.</StateMessage>)
  const cycle = snapshot.ongoing
  if (snapshot.stage === 'ongoing-ready' || snapshot.stage === 'ongoing-session') {
    const session = ongoingProgram.sessions[cycle.completed.length]
    if (snapshot.stage === 'ongoing-session' && snapshot.sessionDraft && sessionLogOpen) return withNotice(<StrictSessionLog session={session} weekNumber={cycle.weekNumber} draft={snapshot.sessionDraft} onDraftChange={draft => commitSnapshot(current => ({ ...current, sessionDraft: draft }))} onPersist={entry => persistSession(entry, cycle.weekNumber, true)} onBack={() => setSessionLogOpen(false)} />)
    return withNotice(<WeekHome program={ongoingProgram} weekNumber={cycle.weekNumber} completed={cycle.completed} draft={snapshot.sessionDraft} recovered={cycle.recoveredFromHistory && cycle.reviews.length === 0} onResume={() => setSessionLogOpen(true)} onStart={() => startSession(session, cycle.weekNumber, true)} error={actionError} />, { navigation: true })
  }
  if (snapshot.stage === 'ongoing-review') return withNotice(<WeekReview weekNumber={cycle.weekNumber} completed={cycle.completed} review={cycle.review} onChange={review => commitSnapshot(current => ({ ...current, ongoing: { ...current.ongoing, review } }))} onContinue={review => commitSnapshot(current => ({ ...current, ongoing: { ...current.ongoing, review }, stage: 'ongoing-proposal' }))} />, { navigation: true })
  const proposalProgram = programmeWithLatestLoads(resolved.program, cycle.completed)
  const chooseNextWeek = (choice, proposal) => {
    const nextProgram = createNextWeekView(proposalProgram, choice === 'accepted' ? proposal : null, cycle.weekNumber + 1)
    if (nextProgram.progressionChoice === 'rejected-invalid-proposal') return setActionError('Forslaget matcher ikke længere dine gemte sæt. Hent siden igen, før du fortsætter.')
    const ongoing = advanceOngoingCycle(snapshot.ongoing, {
      choice,
      proposalId: choice === 'accepted' ? proposal.proposalId : null,
    })
    if (!ongoing) return setActionError('Næste uge kunne ikke gemmes sikkert. Den afsluttede uge er bevaret.')
    setActionError('')
    commitSnapshot(current => ({ ...current, ongoing, sessionDraft: null, stage: 'ongoing-ready' }))
  }
  return withNotice(<NextWeekProposal program={proposalProgram} completed={cycle.completed} weekNumber={cycle.weekNumber} review={cycle.review} onChoose={chooseNextWeek} error={actionError} />, { navigation: true })
}
