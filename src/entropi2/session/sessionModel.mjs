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
export function defaults(p, n) {
  const input = p.logInputs?.[setKey(n)] || {}
  // Marc 3. nov.: an empty stored field is not a choice; the next set starts from the plan.
  const given = v => v != null && String(v).trim() !== ''
  return { ...input, weight: given(input.weight) ? input.weight : n?.exercise.recommended_weight ?? '',
    reps: given(input.reps) ? input.reps : fixedRepsEntry(n?.exercise.reps) ?? '', rpe: input.rpe ?? '' }
}
export function warmup(n, input) {
  const w = parseInputNumber(input?.weight)
  // The existing formula distributes integer increments. Keep extreme finite
  // user input out of its decrement loop once centi-kg arithmetic is unsafe.
  return w == null || !n || !Number.isSafeInteger(Math.round(w * 100)) ? [] : calcWarmupSets(w, n.exercise.reps, n.exercise.name)
}

export function createSessionController(latest, changed = () => {}) {
  let selection = null, open = false, finished = false, error = ''
  const writes = new Map(), notes = new Map()
  function confirmed(p) {
    return (p.exerciseLogs || []).filter(l => !l._optimistic &&
      (l.athlete_id == null || l.athlete_id === p.athleteId) &&
      writes.get(`${programStamp(p)}:${l.exercise_id}_${l.set_number}`)?.phase !== 'saving')
  }
  function resolve(p) {
    if (!selection || selection.stamp !== programStamp(p)) return null
    return p.allWeeks.find(w => w.id === selection.weekId)?.sessions?.find(s => s.id === selection.sessionId) || null
  }
  function status(p, key) {
    const entry = writes.get(`${programStamp(p)}:${key}`)
    if (entry?.phase === 'saving') return 'saving'
    if (parked(p, key)) return 'parked'
    if (queued(p, key)) return 'queued'
    const row = rowFor(p, key)
    if (row && !row._optimistic) return 'saved'
    if (row?._optimistic) return 'waiting'
    if (entry?.phase === 'error' || (entry && p.setConfirm?.[key] === 'error')) return 'error'
    return entry ? 'waiting' : 'idle'
  }
  function state() {
    const p = latest(), session = resolve(p), logs = confirmed(p)
    const day = programStamp(p) ? findDagensPas(p.allWeeks, p.currentWeek, logs) : null
    const next = session ? nextSetInSession(session, logs) : null
    const key = setKey(next), phase = key ? status(p, key) : 'idle'
    return { open: open && !!session, selection, session, next, key, phase, error,
      summary: !!session && (finished || (!next && sessionSetTotal(session) > 0)),
      canStart: !!session || !!day?.next, day, input: defaults(p, next),
      note: noteValue(notes.get(`${selection?.stamp}:${key}`) ?? { text: defaults(p, next).note }),
      done: sessionLoggedCount(session, logs), total: sessionSetTotal(session), logs }
  }
  return {
    state,
    refresh() {
      if (selection && !resolve(latest())) { selection = null; open = false; finished = false; error = '' }
      changed()
    },
    start() {
      const p = latest(), stamp = programStamp(p)
      if (!stamp) return false
      const session = resolve(p) || findDagensPas(p.allWeeks, p.currentWeek, confirmed(p))?.session
      if (!session || sessionSetTotal(session) === 0) return false
      selection = { stamp, weekId: p.currentWeek.id, sessionId: session.id }
      open = true; error = ''; changed(); return true
    },
    close() { open = false; changed() },
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
      if (!s.open || s.summary || stamp !== selection.stamp || s.key !== expected || !['weight', 'reps', 'rpe'].includes(name) || !['idle', 'error'].includes(s.phase)) return
      p.setLogInputs(prev => ({ ...prev, [expected]: { ...(prev[expected] || {}), [name]: value } }))
    },
    editNote(expected, value, stamp) {
      const s = state()
      if (!s.open || s.summary || stamp !== selection.stamp || s.key !== expected || !['idle', 'error'].includes(s.phase)) return false
      notes.set(`${stamp}:${expected}`, noteValue(value))
      return true
    },
    async approve(expected, values, stamp) {
      const p = latest(), s = state()
      if (!s.open || s.summary || stamp !== selection.stamp || !s.next || s.key !== expected || !['idle', 'error'].includes(s.phase)) return false
      const input = sessionInput(notes.has(`${stamp}:${expected}`) ? withSetNote(values, s.note) : values)
      if (!input) { error = 'Skriv vægt og hele reps over 0. RPE er valgfri fra 0 til 10.'; changed(); return false }
      if (typeof p.onLogSet !== 'function' || typeof p.parsePlannedRpe !== 'function') {
        error = 'Registrering er ikke tilgængelig.'; changed(); return false
      }
      const id = `${selection.stamp}:${s.key}`
      const write = { key: s.key, phase: 'saving' }
      writes.set(id, write); error = ''; changed()
      // Re-read after notifications as well: no retained exercise or callback crosses a plan change.
      const current = latest(), valid = state()
      if (!valid.open || valid.summary || valid.selection.stamp !== stamp || !valid.next || valid.key !== expected || !resolve(current)) {
        writes.delete(id); changed(); return false
      }
      try {
        const n = valid.next
        const result = await current.onLogSet(n.exercise, n.setNumber, n.totalSets,
          Number(input.reps), current.parsePlannedRpe(n.exercise.intensity), input, { preserveMissingRpe: true })
        // The pinned callback resolves undefined on both success and handled error.
        // Never infer success from resolution, an optimistic row, or setConfirm=saved.
        write.phase = result === false ? 'error' : 'settled'
      } catch {
        write.phase = 'error'
      }
      changed()
      return programStamp(latest()) === stamp && status(latest(), expected) === 'saved'
    },
  }
}
