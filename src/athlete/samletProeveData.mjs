// Synthetic production-shaped snapshots shared by SSR and actual model checks.
import assert from 'node:assert/strict'

export const athletes = {
  athlete: { id: 'synthetic-athlete', user_id: 'synthetic-athlete-user', name: 'Testfornavn Testefternavn', kcal_target: 2400, protein_target: 150, goal: 'Testmål' },
  preview: { id: 'synthetic-preview', user_id: 'synthetic-other-user', name: 'Testfornavn Testefternavn', kcal_target: 2400, protein_target: 150, goal: 'Testmål' },
  own: { id: 'synthetic-own', user_id: 'synthetic-coach-user', name: 'Testfornavn Testefternavn', kcal_target: 2400, protein_target: 150, goal: 'Testmål' },
}
export const week = {
  id: 'synthetic-week', week_number: 1, start_date: '2026-11-02', block_name: 'Testblok',
  sessions: [{ id: 'synthetic-session', title: 'Testpas', weekday: 2, day_of_week: 3,
    exercises: [{ id: 'synthetic-exercise', name: 'Squat', sets: 3, reps: '3', weight: 60, intensity: 'RPE 7', rest_seconds: 120 }] }],
}
export const tabs = ['hjem', 'program', 'fremgang', 'kost', 'beskeder', 'profil', 'volumen']

export function scenario(mode, tab, state = 'ready', extra = {}) {
  assert.ok(Object.hasOwn(athletes, mode)); assert.ok(tabs.includes(tab))
  assert.ok(['ready', 'empty', 'loading', 'error'].includes(state))
  const athlete = { ...athletes[mode] }
  const session = { user: { id: mode === 'athlete' ? athlete.user_id : 'synthetic-coach-user' } }
  const currentWeek = { ...week, athlete_id: athlete.id, sessions: week.sessions.map(row => ({
    ...row, week_id: week.id, exercises: row.exercises.map(exercise => ({ ...exercise, session_id: row.id })),
  })) }
  const logs = [{ id: 'synthetic-log', athlete_id: athlete.id, exercise_id: 'synthetic-exercise', set_number: 1,
    logged_at: '2026-11-04T09:00:00Z', weight: 60, reps_completed: 3, rpe: 7, exercises: { name: 'Squat' } }]
  const seed = {
    athlete, requestedTab: tab === 'profil' ? 'hjem' : tab, loading: false, loadError: false, homeProgramLoading: false,
    onboardingDone: true, rekordIndeks: null, currentWeek, allWeeks: [currentWeek],
    progOpenSession: 'synthetic-session', exerciseLogs: logs, volumeLogs: logs, fremgangLogs: logs,
    messages: [{ id: 'synthetic-message', athlete_id: athlete.id, sender_role: 'coach', content: 'Syntetisk besked fra din coach', created_at: '2026-11-04T10:00:00Z' }],
    weightLogs: [{ athlete_id: athlete.id, weight: 80, logged_at: '2026-11-04T09:00:00Z' }],
    historicalMealLogs: [{ athlete_id: athlete.id, date: '2026-11-04', kcal: 550, protein: 30 }],
    profileOwner: tab === 'profil' ? `${session.user.id}:${athlete.id}` : null,
  }
  if (state === 'empty') Object.assign(seed, { currentWeek: null, allWeeks: [], exerciseLogs: [], volumeLogs: [], fremgangLogs: [], messages: [], weightLogs: [], historicalMealLogs: [] })
  // These are the real host loading/error states; do not invent per-tab error props.
  if (state === 'loading' || state === 'error') Object.assign(seed, { athlete: null, loading: true, loadError: state === 'error' })
  return { seed: { ...seed, ...extra }, props: { entropi2: true, role: mode === 'athlete' ? 'athlete' : 'coach', session,
    ...(mode === 'athlete' ? {} : { coachAthleteId: athlete.id, onExitPreview() {} }) } }
}
