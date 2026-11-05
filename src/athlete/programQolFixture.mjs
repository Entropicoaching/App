// Public synthetic data shared by the real React and isolated interaction tests.
export const lastWeekKey = id => `entropi2:athlete:${encodeURIComponent(id)}:program:last-week`
export function programQolFixture(extra = {}) {
  const weeks = [0, 1, 2].map(index => ({ id: `qol-week-${index}`, week_number: index,
    block_name: 'Basis', start_date: `2026-11-${String(2 + index * 7).padStart(2, '0')}`,
    sessions: [0, 1].map(day => ({ id: `session-${index}-${day}`, title: `Pas ${index}-${day}`, weekday: day,
      exercises: [{ id: `ex-${index}-${day}`, name: 'Squat', sets: 1, reps: '5', intensity: 'RPE 8' }] })) }))
  const noop = () => {}
  return { entropi2: true, allWeeks: weeks, currentWeek: weeks[1], viewingWeekIdx: 1,
    athlete: { id: 'synthetic-qol' }, computeActiveWeekIdx: () => 1,
    weekStartDate: () => null, fmtWeekRange: () => null, WEEKDAYS_LONG: [],
    exerciseLogs: [], pastLogs: [], readinessLog: { readiness_score: 90 },
    sessionRefs: { current: {} }, dismissedFeedback: new Set(), feedbackInputs: {}, logInputs: {},
    setConfirm: {}, lastLogByExerciseName: {}, exerciseHistory: {}, exWarmupExpanded: {},
    exWarmupWeightOverride: {}, warmupChecked: {}, suggestNextWeight: () => null,
    calcWarmupSets: () => [], suggestWarmupOverride: () => null, parsePlannedRpe: () => 8,
    setViewingWeekIdx: noop, setProgOpenSession: noop, setPastLogs: noop, fetchPastLogs: noop,
    fetchProgramBlockLogs: async () => [], openSession: noop, ...extra }
}
