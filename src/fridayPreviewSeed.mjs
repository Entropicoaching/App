export const ATHLETE = '33333333-3333-4333-8333-333333333333'
export const USER = '22222222-2222-4222-8222-222222222222'
export const COACH = '11111111-1111-4111-8111-111111111111'
export const PREVIEW_ANALYSIS = 'aaaaaaaa-aaaa-4aaa-8aaa-000000024000'
const id = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`
export function buildPreviewSeed(now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  const monday = new Date(day); monday.setDate(day.getDate() - (day.getDay() + 6) % 7)
  const date = offset => { const d = new Date(monday); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const tables = { profiles: [{ id: USER, role: 'athlete' }, { id: COACH, role: 'coach' }],
    athletes: [{ id: ATHLETE, user_id: USER, name: 'Testatlet', email: 'atlet@example.test',
      status: 'active', hidden: false, onboarding_completed_at: date(-60),
      onboarding_guide_completed_at: date(-60), competition_date: date(35) }],
    automation_alerts: [], coach_briefing_seen: [], coach_signal_actions: [], custom_foods: [],
    exercise_library: [], frontend_errors: [], meal_logs: [], meal_templates: [], meet_plans: [],
    meet_results: [], warmup_templates: [], weeks: [], sessions: [], exercises: [], exercise_logs: [], readiness_logs: [],
    personal_records: [], weight_logs: [], messages: [], video_analyses: [] }
  for (let w = 0; w < 6; w++) {
    const week = { id: id(w+1), athlete_id: ATHLETE, week_number: w+1,
      block_name: w < 3 ? 'Grundlag' : 'Styrke', start_date: date((w-4)*7) }
    tables.weeks.push(week)
    for (let s = 0; s < 3; s++) {
      const session = { id: id(100+w*3+s), week_id: week.id, title: `Dag ${s+1}`,
        session_order: s+1, weekday: s*2 }
      tables.sessions.push(session)
      for (let e = 0; e < 3; e++) {
        const exercise = { id: id(1000+w*9+s*3+e), session_id: session.id,
          name: ['Squat', 'Bænkpres', 'Dødløft'][e], sets: 3, reps: '5', intensity: 'RPE 7',
          recommended_weight: 60+e*20+w*2.5, exercise_order: e+1 }
        tables.exercises.push(exercise)
        if (w < 4) for (let set = 1; set <= 3; set++) tables.exercise_logs.push({
          id: id(10000+w*27+s*9+e*3+set), athlete_id: ATHLETE, exercise_id: exercise.id,
          set_number: set, weight: exercise.recommended_weight, reps_completed: 5,
          rpe_actual: 7, rpe_planned: 7, rpe_source: 'athlete', skipped: false,
          logged_at: date((w-4)*7+s*2)+'T10:00:00Z' })
      }
    }
  }
  for (let d = -28; d <= 0; d++) {
    tables.readiness_logs.push({ id: id(20000+d+28), athlete_id: ATHLETE,
      logged_date: date(d), readiness_score: 72+(d+28)%8, sleep_hours: 7.5, energy: 4,
      motivation: 4, stress: 2, soreness_level: 2, sore_zones: [] })
    tables.weight_logs.push({ id: id(21000+d+28), athlete_id: ATHLETE, weight: 82,
      logged_date: date(d), logged_at: date(d)+'T07:00:00Z' })
  }
  tables.personal_records.push({ id: id(22000), athlete_id: ATHLETE, exercise_name: 'Squat', weight: 100, reps: 1, created_at: date(-7)+'T10:00:00Z' })
  tables.messages.push({ id: id(23000), athlete_id: ATHLETE, sender_role: 'athlete',
    content: 'Syntetisk spørgsmål om næste uge', category: 'besked', read_by_coach: false,
    created_at: date(0)+'T08:00:00Z' })
  tables.video_analyses.push({ id: PREVIEW_ANALYSIS, client_analysis_id: id(24001), athlete_id: ATHLETE,
    lift: 'squat', variation: 'competition', load_kg: 80, reps_count: 3,
    status: 'draft', analysis_state: 'complete', source_mode: 'video',
    created_at: date(0)+'T09:00:00Z', analyzed_at: date(0)+'T09:01:00Z',
    metrics: {}, rep_details: [], bar_path: [], video_path: null,
    athlete_seen_at: date(0)+'T09:02:00Z',
    session_context: { preview_markers: true }, athlete_feedback: { works: [{ text: 'Rolig opstilling' }],
      focus: [{ text: 'Hold en rolig start' }], next_set: [{ text: 'Gentag med samme vægt' }] } })
  return tables
}
