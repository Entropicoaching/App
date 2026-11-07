import { findDagensPas, nextSetInSession, sessionSetTotal, sessionLoggedCount } from '../../nextSet.js'
import { inputInteger, parseInputNumber, optionalInput } from '../../inputValues.js'
import { fixedRepsEntry } from '../../fixedRepsEntry.js'
import { noteValue, withSetNote } from './noter/noteModel.mjs'
import { calcWarmupSets } from '../../warmup.js'

// Existing weeks are the program: fetchProgram reads weeks/sessions/exercises.
// Include prescriptions, order and comments so a retained click cannot write an old plan.
const plan = week => [week?.id, week?.athlete_id, week?.program_id, week?.block_id,
  (week?.sessions || []).map(s => [s.id, s.title, s.session_order,
    (s.exercises || []).map(e => [e.id, e.name, e.exercise_order, e.sets, e.reps,
      e.intensity, e.recommended_weight, e.note, e.tempo, e.restSeconds])])]
export function programStamp(p) {
  if (p.enabled !== true || !p.athleteId || p.programError || p.offlineSnapshotAt != null || !p.currentWeek?.id) return null
  const week = p.allWeeks?.find(w => w.id === p.currentWeek.id)
  if (!week || JSON.stringify(plan(week)) !== JSON.stringify(plan(p.currentWeek))) return null
  if (week.athlete_id != null && week.athlete_id !== p.athleteId) return null
  return JSON.stringify([p.athleteId, (p.allWeeks || []).map(plan), week.id])
}
export const setKey = n => n ? `${n.exercise.id}_${n.setNumber}` : null
export const rowFor = (p, key) => (p.exerciseLogs || []).find(l =>
  `${l.exercise_id}_${l.set_number}` === key && (l.athlete_id == null || l.athlete_id === p.athleteId))
const parked = (p, key) => (p.parkedSets || []).some(s => `${s.exerciseId}_${s.setNumber}` === key)
const queued = (p, key) => (p.pendingSyncKeys || []).includes(key)
export function sessionInput(input = {}) {
  const weight = parseInputNumber(input.weight), reps = inputInteger(input.reps)
  const rpe = optionalInput(input.rpe) ? null : parseInputNumber(input.rpe)
  if (weight == null || reps == null || reps < 1 || (!optionalInput(input.rpe) && (rpe == null || rpe > 10))) return null
  return { ...input, weight: String(weight), reps: String(reps), rpe: rpe == null ? '' : String(rpe),
    rpe_source: rpe == null ? null : 'athlete' }
}
// Only earlier confirmed sets of this exact program exercise can supply a pair.
// RPE and notes describe an effort; they are never copied into another set.
export function setSuggestion(p, n, logs = p.exerciseLogs || []) {
  if (p.enabled !== true || !p.athleteId || !n) return { weight: '', reps: '', label: null }
  const previous = (p.exerciseLogsError || p.exerciseLogsLoading ? [] : logs).filter(row => row.exercise_id === n.exercise.id &&
    Number.isInteger(row.set_number) && row.set_number > 0 && row.set_number < n.setNumber &&
    !row.skipped && !row._optimistic && (row.athlete_id == null || row.athlete_id === p.athleteId) &&
    !queued(p, `${row.exercise_id}_${row.set_number}`) && !parked(p, `${row.exercise_id}_${row.set_number}`))
    .sort((a, b) => b.set_number - a.set_number)
    .map(row => sessionInput({ weight: row.weight, reps: row.reps_completed, rpe: '' })).find(Boolean)
  return previous ? { weight: previous.weight, reps: previous.reps, label: 'Som sidste sæt' }
    : { weight: n.exercise.recommended_weight ?? '', reps: fixedRepsEntry(n.exercise.reps) ?? '', label: 'Som planlagt' }
}
export function quickSetLabel(input, suggestion) {
  const entered = sessionInput(input), proposed = sessionInput({ ...suggestion, rpe: '' })
  return entered && proposed && entered.weight === proposed.weight && entered.reps === proposed.reps
    ? suggestion.label : 'Godkendt'
}
export function defaults(p, n, suggestion = setSuggestion(p, n), edited = new Set()) {
  const key = setKey(n), pending = queued(p, key) ? rowFor(p, key) : null
  // Reloaded queue overlays carry the approved values; never show plan defaults
  // as if they were the values waiting to reach the server.
  const input = { ...(pending ? { weight: pending.weight, reps: pending.reps_completed,
    rpe: pending.rpe_actual ?? '', note: pending.note ?? '' } : {}), ...(p.logInputs?.[key] || {}) }
  const given = v => v != null && String(v).trim() !== ''
  // Host placeholders may be empty, but a field cleared here is an explicit edit.
  return { ...input, weight: edited.has('weight') || given(input.weight) ? input.weight : suggestion.weight,
    reps: edited.has('reps') || given(input.reps) ? input.reps : suggestion.reps, rpe: input.rpe ?? '' }
}
export function warmup(n, input) {
  const w = parseInputNumber(input?.weight)
  // The existing formula distributes integer increments. Keep extreme finite
  // user input out of its decrement loop once centi-kg arithmetic is unsafe.
  return w == null || !n || !Number.isSafeInteger(Math.round(w * 100)) ? [] : calcWarmupSets(w, n.exercise.reps, n.exercise.name)
}

export function createSessionController(latest, changed = () => {}) {
  let selection = null, open = false, finished = false, error = '', dead = false, lifetime = 0
  const writes = new Map(), notes = new Map(), edits = new Map()
  let feelingScope = null, feelingDraft = {}, skipConfirm = null, skipWrite = null
  function confirmed(p) {
    return (p.exerciseLogs || []).filter(l => !l._optimistic &&
      !queued(p, `${l.exercise_id}_${l.set_number}`) && !parked(p, `${l.exercise_id}_${l.set_number}`) &&
      (l.athlete_id == null || l.athlete_id === p.athleteId) &&
      writes.get(`${programStamp(p)}:${l.exercise_id}_${l.set_number}`)?.phase !== 'saving')
  }
  function resolve(p) {
    if (dead || !selection || selection.stamp !== programStamp(p)) return null
    return p.allWeeks.find(w => w.id === selection.weekId)?.sessions?.find(s => s.id === selection.sessionId) || null
  }
  function status(p, key) {
    const entry = writes.get(`${programStamp(p)}:${key}`)
    if (entry?.phase === 'saving') return 'saving'
    if (parked(p, key) || entry?.phase === 'parked') return 'parked'
    if (queued(p, key)) return 'queued'
    const row = rowFor(p, key)
    if (row && !row._optimistic) return 'saved'
    if (entry?.phase === 'queued') return 'queued'
    if (row?._optimistic) return 'waiting'
    if (entry?.phase === 'error' || (entry && p.setConfirm?.[key] === 'error')) return 'error'
    return entry ? 'waiting' : 'idle'
  }
  // Void handlers confirm nothing. Only current host rows/queue own the result.
  function skipBusy(p) {
    if (!skipWrite || skipWrite.stamp !== programStamp(p)) return false
    if (skipWrite.phase === 'saving') return true
    if (skipWrite.phase === 'error') return false
    if (p.exerciseLogsLoading || p.exerciseLogsError) return true
    const matched = skipWrite.keys.every(key => skipWrite.undo
      ? !rowFor(p, key) && !queued(p, key) && !parked(p, key)
      : rowFor(p, key)?.skipped === true && status(p, key) === 'saved')
    if (!matched) return true
    // Confirmation belongs to this operation, not to all future rows on its keys.
    skipWrite = null
    return false
  }
  function skipAllowed(p, s) {
    return p.readOnly !== true && !p.onHoliday && !p.programLoading &&
      !p.exerciseLogsLoading && !p.exerciseLogsError && !p.pendingSessionAction &&
      s.open && !s.summary && !!s.next && !skipBusy(p) &&
      !rowFor(p, s.key) && ['idle', 'error'].includes(s.phase) &&
      ![...writes.values()].some(w => w.phase === 'saving')
  }
  function remaining(p, ex) {
    return Array.from({ length: ex.sets || 0 }, (_, i) => `${ex.id}_${i + 1}`).filter(key => !rowFor(p, key))
  }
  function exerciseReady(p, s) {
    // A queued delete without a row is still occupied. The existing host must
    // not include that slot in its remaining-set selection.
    return remaining(p, s.next.exercise).every(key => ['idle', 'error'].includes(status(p, key)))
  }
  const confirmation = (p, s) => JSON.stringify([s.selection?.stamp, s.key, s.next ? remaining(p, s.next.exercise) : []])
  async function writeSkip(expected, stamp, kind) {
    const p = latest(), s = state(), undo = kind === 'undo'
    const ex = undo ? s.session?.exercises.find(ex =>
      Array.from({ length: ex.sets || 0 }, (_, i) => `${ex.id}_${i + 1}`).includes(expected)) : s.next?.exercise
    const row = rowFor(p, expected)
    if (dead || !s.open || stamp !== s.selection?.stamp || !ex || p.readOnly === true ||
        p.onHoliday || p.programLoading || p.exerciseLogsLoading || p.exerciseLogsError ||
        p.pendingSessionAction || skipBusy(p) || [...writes.values()].some(w => w.phase === 'saving')) return false
    if (undo ? !row?.skipped || status(p, expected) !== 'saved'
      : !skipAllowed(p, s) || expected !== s.key || (kind === 'exercise' &&
        (skipConfirm !== confirmation(p, s) || !exerciseReady(p, s)))) return false
    const callback = undo ? p.onUnskipSet : kind === 'exercise' ? p.onSkipExercise : p.onSkipSet
    if (typeof callback !== 'function' || (!undo && typeof p.parsePlannedRpe !== 'function')) return false
    const keys = undo || kind === 'set' ? [expected] : remaining(p, ex)
    const write = { stamp, keys, undo, phase: 'saving' }, startedIn = lifetime
    skipWrite = write; skipConfirm = null; error = ''; changed()
    const valid = () => !dead && lifetime === startedIn && resolve(latest()) &&
      state().open && state().selection?.stamp === stamp && latest().readOnly !== true &&
      !latest().onHoliday && !latest().programLoading && !latest().exerciseLogsLoading &&
      !latest().exerciseLogsError && !latest().pendingSessionAction &&
      (undo || (!state().summary && state().key === expected)) &&
      (kind !== 'exercise' || JSON.stringify(remaining(latest(), ex)) === JSON.stringify(keys)) &&
      keys.every(key => undo ? rowFor(latest(), key)?.skipped && status(latest(), key) === 'saved'
        : !rowFor(latest(), key) && ['idle', 'error'].includes(status(latest(), key)))
    try {
      const planned = undo || kind === 'exercise' ? null : p.parsePlannedRpe(ex.intensity)
      if (!valid()) { if (skipWrite === write) skipWrite = null; if (!dead) changed(); return false }
      const current = latest()
      const result = await (undo ? current.onUnskipSet(ex.id, row.set_number)
        : kind === 'exercise' ? current.onSkipExercise(ex)
          : current.onSkipSet(ex.id, s.next.setNumber, planned))
      write.phase = result === false ? 'error' : 'settled'
    } catch { write.phase = 'error' }
    if (dead || lifetime !== startedIn || !resolve(latest()) || skipWrite !== write) return false
    if (write.phase === 'error') error = 'Handlingen kunne ikke bekræftes. Kontrollér sættene og prøv igen.'
    changed()
    return !skipBusy(latest()) && write.phase !== 'error'
  }
  function state() {
    const p = latest(), session = resolve(p), logs = confirmed(p)
    const day = !dead && programStamp(p) ? findDagensPas(p.allWeeks, p.currentWeek, logs) : null
    const next = session ? nextSetInSession(session, logs) : null
    const key = setKey(next), phase = key ? status(p, key) : 'idle'
    const suggestion = setSuggestion(p, next, logs)
    const input = defaults(p, next, suggestion, edits.get(`${selection?.stamp}:${key}`))
    // Completion is optional and local. Queued/parked/optimistic rows cannot unlock it.
    const canFeel = !!session && !next && sessionSetTotal(session) > 0 &&
      session.exercises.every(ex => Array.from({ length: ex.sets || 0 }, (_, i) =>
        status(p, `${ex.id}_${i + 1}`) === 'saved').every(Boolean)) &&
      logs.some(row => !row.skipped && session.exercises.some(ex =>
        ex.id === row.exercise_id && row.set_number > 0 && row.set_number <= ex.sets))
    const scope = canFeel ? JSON.stringify([selection.stamp, session.id]) : null
    const skipBlocked = skipBusy(p)
    const base = { open: open && !!session, summary: !!session && (finished || (!next && sessionSetTotal(session) > 0)), next, key, phase }
    const skip = { busy: skipBlocked, confirm: skipConfirm === confirmation(p, { selection, key, next }),
      canSet: skipAllowed(p, base) && typeof p.onSkipSet === 'function',
      canExercise: skipAllowed(p, base) && typeof p.onSkipExercise === 'function' && exerciseReady(p, base),
      count: next ? remaining(p, next.exercise).length : 0,
      message: skipBlocked ? skipWrite.phase === 'saving' ? 'Behandler spring over. Vent på svar.'
        : skipWrite.keys.some(k => parked(p, k)) ? 'Spring over kunne ikke synkroniseres. Kontakt din coach.'
        : skipWrite.keys.some(k => queued(p, k)) ? 'Spring over venter på net. Ikke bekræftet gemt.'
        : 'Afventer bekræftelse af spring over. Kontrollér sættene før du fortsætter.' : '' }
    return { open: open && !!session, selection, session, next, key, phase, error, skip,
      feeling: scope ? { scope, draft: scope === feelingScope ? { ...feelingDraft } : {} } : null,
      summary: !!session && (finished || (!next && sessionSetTotal(session) > 0)),
      canStart: !!session || !!day?.next, day, input, approveLabel: quickSetLabel(input, suggestion),
      note: noteValue(notes.get(`${selection?.stamp}:${key}`) ?? { text: input.note }),
      done: sessionLoggedCount(session, logs), total: sessionSetTotal(session), logs }
  }
  return {
    state,
    // Terminal revocation precedes view teardown; retained methods cannot reopen it.
    dispose() { dead = true; lifetime++; selection = null; open = false; finished = false; error = ''; feelingScope = null; feelingDraft = {}; skipConfirm = null; skipWrite = null },
    refresh() {
      if (dead) return
      if (selection && !resolve(latest())) { lifetime++; selection = null; open = false; finished = false; error = ''; feelingScope = null; feelingDraft = {}; skipConfirm = null; skipWrite = null }
      changed()
    },
    start() {
      if (dead) return false
      const p = latest(), stamp = programStamp(p)
      if (!stamp) return false
      const session = resolve(p) || findDagensPas(p.allWeeks, p.currentWeek, confirmed(p))?.session
      if (!session || sessionSetTotal(session) === 0) return false
      if (selection?.stamp !== stamp) lifetime++
      selection = { stamp, weekId: p.currentWeek.id, sessionId: session.id }
      open = true; error = ''; changed(); return true
    },
    close() { if (dead) return; open = false; skipConfirm = null; changed() },
    requestSkip(expected, stamp) {
      const s = state()
      if (!s.skip.canExercise || expected !== s.key || stamp !== s.selection?.stamp) return false
      skipConfirm = confirmation(latest(), s); changed(); return true
    },
    cancelSkip() { if (dead) return; skipConfirm = null; changed() },
    skipSet: (expected, stamp) => writeSkip(expected, stamp, 'set'),
    skipExercise: (expected, stamp) => writeSkip(expected, stamp, 'exercise'),
    unskipSet: (expected, stamp) => writeSkip(expected, stamp, 'undo'),
    finish() {
      if (!state().open) return false
      if (!finished) { finished = true; error = ''; changed() }
      return true
    },
    resume() {
      if (!state().open || !finished) return false
      finished = false; changed(); return true
    },
    edit(expected, name, value, stamp) {
      const p = latest(), s = state()
      if (p.readOnly === true || skipBusy(p) || !s.open || s.summary || stamp !== selection.stamp || s.key !== expected || !['weight', 'reps', 'rpe'].includes(name) || !['idle', 'error'].includes(s.phase)) return
      const id = `${stamp}:${expected}`
      if (!edits.has(id)) edits.set(id, new Set())
      edits.get(id).add(name)
      p.setLogInputs(prev => ({ ...prev, [expected]: { ...(prev[expected] || {}), [name]: value } }))
    },
    editFeeling(scope, draft) {
      const s = state()
      if (!s.open || !s.feeling || s.feeling.scope !== scope) return false
      // Keep invalid input visible for validation, never pass it to onLogSet.
      feelingScope = scope
      feelingDraft = { rpe: draft?.rpe ?? '', energy: draft?.energy ?? '', note: draft?.note ?? '' }
      return true
    },
    editNote(expected, value, stamp) {
      const s = state()
      if (latest().readOnly === true || skipBusy(latest()) || !s.open || s.summary || stamp !== selection.stamp || s.key !== expected || !['idle', 'error'].includes(s.phase)) return false
      notes.set(`${stamp}:${expected}`, noteValue(value))
      return true
    },
    async approve(expected, values, stamp) {
      const p = latest(), s = state()
      if (p.readOnly === true || skipBusy(p) || !s.open || s.summary || stamp !== selection.stamp || !s.next || s.key !== expected || !['idle', 'error'].includes(s.phase)) return false
      const input = sessionInput(notes.has(`${stamp}:${expected}`) ? withSetNote(values, s.note) : values)
      if (!input) { error = 'Skriv vægt og hele gentagelser over 0. RPE er valgfri fra 0 til 10.'; changed(); return false }
      if (typeof p.onLogSet !== 'function' || typeof p.parsePlannedRpe !== 'function') {
        error = 'Registrering er ikke tilgængelig.'; changed(); return false
      }
      const id = `${selection.stamp}:${s.key}`, startedIn = lifetime
      const write = { key: s.key, phase: 'saving' }
      writes.set(id, write); error = ''; changed()
      // Re-read after notifications as well: no retained exercise or callback crosses a plan change.
      const current = latest(), valid = state()
      if (current.readOnly === true || !valid.open || valid.summary || valid.selection.stamp !== stamp || !valid.next || valid.key !== expected || !resolve(current)) {
        writes.delete(id); if (!dead) changed(); return false
      }
      let storageFailed = false
      try {
        const n = valid.next, plannedRpe = current.parsePlannedRpe(n.exercise.intensity)
        // A supplied parser may synchronously invalidate/dispose this view too.
        const ready = state()
        if (dead || lifetime !== startedIn || latest().readOnly === true || !ready.open || ready.summary || ready.key !== expected || ready.selection.stamp !== stamp) { writes.delete(id); if (!dead) changed(); return false }
        const result = await current.onLogSet(n.exercise, n.setNumber, n.totalSets,
          Number(input.reps), plannedRpe, input, { preserveMissingRpe: true, sessionOnly: true })
        // The pinned callback resolves undefined on both success and handled error.
        // Never infer success from resolution, an optimistic row, or setConfirm=saved.
        write.phase = ['saved', 'queued', 'parked', 'error'].includes(result?.phase) ? result.phase : result === false ? 'error' : 'settled'
        storageFailed = result?.storageFailed
      } catch {
        write.phase = 'error'
      }
      // The host still owns an already-started write; only its stale UI response is revoked.
      if (dead || lifetime !== startedIn || !resolve(latest())) return false
      if (storageFailed) error = 'Sættet kunne ikke gemmes lokalt. Behold passet åbent og prøv igen, når der er net.'
      changed()
      return programStamp(latest()) === stamp && status(latest(), expected) === 'saved'
    },
  }
}
