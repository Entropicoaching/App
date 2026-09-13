// ORDRE 153 · commit 1 — fiktiv seed til e2e-mocken. "Testatlet" er opdigtet,
// ingen rigtige navne/tal fra en rigtig atlet.

export const COACH_USER = { id: 'e2e-coach-0001', email: 'coach@e2e.test', password: 'e2e-pass-coach', role: 'coach' }
export const ATHLETE_USER = { id: 'e2e-athlete-0001', email: 'atlet@e2e.test', password: 'e2e-pass-atlet', role: 'athlete' }

export const ATHLETE_ID = 'e2e-athlete-row-0001'
export const WEEK_ID = 'e2e-week-0001'
export const SESSION_ID = 'e2e-session-0001'
export const EXERCISE_ID = 'e2e-exercise-0001'

function isoNow() { return new Date().toISOString() }
function todayStr() { return new Date().toISOString().slice(0, 10) }

// weekday: 0=mandag..6=søndag i appens egen skala (se WEEKDAYS_LONG i
// AthleteView.jsx) — sat til i dag, så sessionen fremstår som "Næste".
function todayWeekdayIdx() {
  const jsDay = new Date().getDay() // 0=søndag..6=lørdag
  return jsDay === 0 ? 6 : jsDay - 1
}

/**
 * Bygger et frisk sæt tabeller. `withLogs: true` seeder programmet som om
 * atleten allerede har logget dagens tre sæt + dagens parathed — bruges når
 * coach.spec.mjs køres alene (npm run e2e:coach), uden en forudgående
 * atlet-spec-kørsel i samme proces.
 */
export function buildSeed({ withLogs = false } = {}) {
  const tables = {
    profiles: [
      { id: COACH_USER.id, role: 'coach', email: COACH_USER.email, last_seen: null },
      { id: ATHLETE_USER.id, role: 'athlete', email: ATHLETE_USER.email, last_seen: null },
    ],
    athletes: [
      {
        id: ATHLETE_ID,
        user_id: ATHLETE_USER.id,
        name: 'Testatlet',
        email: ATHLETE_USER.email,
        status: 'active',
        hidden: false,
        snooze_until: null,
        competition_date: null,
        onboarding_completed_at: isoNow(),
      },
    ],
    weeks: [
      { id: WEEK_ID, athlete_id: ATHLETE_ID, week_number: 1, block_name: 'Base' },
    ],
    sessions: [
      {
        id: SESSION_ID, week_id: WEEK_ID, title: 'Dag 1 — Squat',
        session_order: 1, weekday: todayWeekdayIdx(),
        athlete_rating: null, athlete_comment: null,
      },
    ],
    exercises: [
      {
        id: EXERCISE_ID, session_id: SESSION_ID, name: 'Squat',
        sets: 3, reps: '4-6', intensity: 'RPE 8', note: null,
        exercise_order: 1, recommended_weight: 80,
      },
    ],
    exercise_logs: [],
    readiness_logs: [],
    personal_records: [],
    messages: [],
    video_analyses: [],
  }

  if (withLogs) {
    const reps = [4, 5, 6]
    tables.exercise_logs = reps.map((r, i) => ({
      id: `e2e-log-000${i + 1}`,
      exercise_id: EXERCISE_ID,
      athlete_id: ATHLETE_ID,
      set_number: i + 1,
      weight: 80,
      reps_completed: r,
      note: null,
      rpe_actual: 8,
      rpe_planned: 8,
      skipped: false,
      logged_at: isoNow(),
    }))
    tables.readiness_logs = [{
      id: 'e2e-readiness-0001',
      athlete_id: ATHLETE_ID,
      logged_date: todayStr(),
      sleep_hours: 8,
      energy: 4,
      motivation: 4,
      stress: 2,
      soreness_level: 2,
      sore_zones: null,
      readiness_score: 78,
    }]
  }

  return { users: [COACH_USER, ATHLETE_USER], tables }
}
