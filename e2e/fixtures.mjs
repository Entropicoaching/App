// ORDRE 153/155 · fiktiv seed til e2e-mocken. "Testatlet" er opdigtet, ingen
// rigtige navne/tal fra en rigtig atlet.
//
// ORDRE 155: alle id'er er nu ægte UUID'er (v4-formede, faste for
// determinisme) — src/videoCoachUpload.js's buildVideoUploadPath() kræver at
// athletes.id og client_analysis_id består `isUuid()`-tjekket, ellers
// afvises uploaden ("Videoformatet kunne ikke gemmes") før den overhovedet
// når mocken.

export const COACH_USER = { id: '11111111-1111-4111-8111-111111111111', email: 'coach@e2e.test', password: 'e2e-pass-coach', role: 'coach' }
export const ATHLETE_USER = { id: '22222222-2222-4222-8222-222222222222', email: 'atlet@e2e.test', password: 'e2e-pass-atlet', role: 'athlete' }

export const ATHLETE_ID = '33333333-3333-4333-8333-333333333333'
export const WEEK_ID = '44444444-4444-4444-8444-444444444444'
export const SESSION_ID = '55555555-5555-4555-8555-555555555555'
export const EXERCISE_ID = '66666666-6666-4666-8666-666666666666'
// Allerede-analyseret video (ordre 155 · commit 2): sætter analysis_state
// forbi 'awaiting_analysis', så review/feedback/del-flowet kan proves med
// rigtige klik uden at genskabe den ægte stangbane-sporing (se docs/E2E.md).
export const ANALYZED_VIDEO_ID = '77777777-7777-4777-8777-777777777777'
export const ANALYZED_VIDEO_CLIENT_ID = '88888888-8888-4888-8888-888888888888'

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
 * atlet-spec-kørsel i samme proces. `withAnalyzedVideo: true` (ordre 155)
 * tilføjer en færdig-sporet video, så video-review.spec.mjs kan køres alene.
 */
export function buildSeed({ withLogs = false, withAnalyzedVideo = false } = {}) {
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
        // sets: 4, ikke 3 — atlet.spec.mjs logger kun de tre første ("log tre
        // sæt"); det fjerde sæt står bevidst ulogget til fejl.spec.mjs (ordre
        // 155 · commit 3), som skal bruge et FRISK, ulogget sæt (en INSERT,
        // ikke en UPDATE) for reelt at kunne bevise "aldrig dobbelt-rækker".
        id: EXERCISE_ID, session_id: SESSION_ID, name: 'Squat',
        sets: 4, reps: '4-6', intensity: 'RPE 8', note: null,
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
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i + 1}`,
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
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
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

  if (withAnalyzedVideo) {
    tables.video_analyses = [{
      id: ANALYZED_VIDEO_ID,
      client_analysis_id: ANALYZED_VIDEO_CLIENT_ID,
      athlete_id: ATHLETE_ID,
      athlete_name: 'Testatlet',
      source_mode: 'athlete_submission',
      status: 'draft',
      schema_version: 3,
      schema_v: 3,
      lift: 'squat',
      variation: 'high-bar',
      load_kg: 80,
      rpe: 8,
      reps_count: 3,
      video_path: `${ATHLETE_ID}/${ANALYZED_VIDEO_CLIENT_ID}.mp4`,
      // Alt andet end 'awaiting_analysis' ruter AnalyseTab.jsx til den
      // færdig-analyserede visning (Dashboard.jsx/AnalyseTab.jsx tjekker kun
      // === 'awaiting_analysis', se docs/E2E.md).
      analysis_state: 'analyzed',
      coach_note: null,
      bias_note: null,
      metrics: {},
      findings: [],
      bar_path: null,
      athlete_feedback: null,
      analyzed_at: isoNow(),
      created_at: isoNow(),
      session_context: {
        training_session_id: null, program_item_id: null, coach_note_snapshot: null,
        baseline_snapshot: [], athlete_note: null, feedback_evidence: null, plate_calibration: null,
      },
    }]
  }

  return { users: [COACH_USER, ATHLETE_USER], tables }
}
