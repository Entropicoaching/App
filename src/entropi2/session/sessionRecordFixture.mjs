import './sessionSaveRegister.mjs'
import { bygGrundlag } from '../../athlete/rekorder.js'
import { loadOfflineSets } from '../../offlineSetQueue.js'
import { markNetworkSuccess } from '../../offlineSession.js'
import { reset } from './sessionSaveBoundary.mjs'
const { lavSaetSkrivning } = await import('../../athlete/saetSkrivning.js')

// Actual copied writer; only transport, storage and the host's state are synthetic.
// Import sessionSaveRegister.mjs before this fixture to deny the real client.
export function sessionRecordFixture(t, extra = {}) {
  reset(); markNetworkSuccess()
  const values = new Map(), writes = [], receipts = [], timers = new Map()
  const storage = { getItem: k => values.get(k) ?? null,
    setItem(k, v) { writes.push(k); values.set(k, v) } }
  for (const [key, value] of [['localStorage', storage], ['navigator', { onLine: true }]]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true })
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] })
  }
  const ex = { id: 'record-lift', name: 'Squat', sets: 2, reps: 5, recommended_weight: 90 }
  const week = { id: 'record-week', athlete_id: 'synthetic-record-owner', start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ id: 'record-session', title: 'Pas', exercises: [ex] }] }
  const p = { enabled: true, athlete: { id: week.athlete_id }, athleteId: week.athlete_id,
    now: new Date('2026-11-05T12:00:00Z'), storage, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: {}, pendingSyncKeys: [], parkedSets: [], setConfirm: {},
    parsePlannedRpe: () => null, rekordFejring: null, fejredeRef: { current: new Set() },
    rekordGrundlagFoer: bygGrundlag([{ navn: 'Squat', weight: 80, reps: 5 }]), ...extra }
  let changed = () => {}, fetches = 0
  const set = name => value => { p[name] = typeof value === 'function' ? value(p[name]) : value; changed() }
  p.setLogInputs = set('logInputs')
  p.setRekordFejring = value => { set('rekordFejring')(value); if (p.rekordFejring) receipts.push(p.rekordFejring) }
  const noop = () => {}, ref = { current: {} }
  const handlers = () => lavSaetSkrivning({ athlete: p.athlete, currentWeek: p.currentWeek, allWeeks: p.allWeeks,
    exerciseLogs: p.exerciseLogs, logInputs: p.logInputs, feedbackInputs: {}, setWriteRef: ref,
    setExerciseLogs: set('exerciseLogs'), setLogInputs: p.setLogInputs, setSetConfirm: set('setConfirm'),
    setPendingSyncCount() { p.pendingSyncKeys = Object.keys(loadOfflineSets(p.athlete.id, storage)); changed() },
    fetchExerciseLogs() { fetches++ }, setLastLoggedSet: noop, setRestPause: noop, showFlash: noop,
    setPrToast: noop, setPrToastFading: noop, setRekordFejring: p.setRekordFejring, fejredeRef: p.fejredeRef })
  p.onLogSet = (...args) => handlers().logDagensPasSet(...args)
  const save = (setNumber = 1, weight = 90, reps = 5) => p.onLogSet(ex, setNumber, ex.sets, reps, null,
    { weight, reps, rpe: '' }, { sessionOnly: true, preserveMissingRpe: true })
  const clock = { setTimeout(fn, ms) { const id = {}; timers.set(id, { fn, ms }); return id },
    clearTimeout(id) { timers.delete(id) } }
  t.after(markNetworkSuccess)
  return { p, ex, week, values, writes, receipts, handlers, save, clock, timers,
    onChange(fn) { changed = fn }, get fetches() { return fetches } }
}
