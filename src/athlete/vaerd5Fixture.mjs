import { applyWarmupCorrection, saveWarmupOverride, suggestWarmupOverride } from './warmupOverride.js'

export function fixture(extra = {}) {
  const storage = new Map()
  const store = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  const model = [{ weight: 20, reps: 5, pct: '20%' }, { weight: 60, reps: 3, pct: '60%' }]
  const ex = { id: 'ex1', name: 'Squat', recommended_weight: 100, reps: '5', sets: 1 }
  const week = { id: 'w1', week_number: 1, sessions: [{ id: 's1', exercises: [ex] }] }
  const writes = []
  const props = {
    entropi2: false,
    allWeeks: [week], currentWeek: week, viewingWeekIdx: 0, athlete: { id: 'synthetic-a' },
    computeActiveWeekIdx: () => 0, fmtWeekRange: () => null, weekStartDate: () => null,
    exerciseLogs: [], pastLogs: [], readinessLog: { readiness_score: 90 },
    progOpenSession: 's1', dismissedFeedback: new Set(), exerciseHistory: {}, logInputs: {},
    lastLogByExerciseName: {}, exWarmupWeightOverride: {}, exWarmupExpanded: new Set(['ex1']),
    warmupChecked: {}, setConfirm: {}, feedbackInputs: {}, sessionRefs: { current: {} },
    suggestNextWeight: () => null, calcWarmupSets: () => model,
    parsePlannedRpe: () => null,
    suggestWarmupOverride: (...args) => suggestWarmupOverride(...args, store),
    applyWarmupCorrection,
    saveWarmupOverride: (...args) => { writes.push(args); return saveWarmupOverride(...args, store) },
    setWarmupSetEditing: () => {}, setWarmupOverrideTick: () => {},
    ...extra,
  }
  return { props, store, storage, model, ex, week, writes,
    save(sets = applyWarmupCorrection(model, 1, { weight: '55' })) {
      return saveWarmupOverride(props.athlete.id, ex.name, 100, sets, store)
    },
  }
}

export { saveWarmupOverride }
