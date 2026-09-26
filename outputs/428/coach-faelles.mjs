// ORDRE 428: faelles opsaetning til "en uge som coach paa computeren".
// Syntetisk coach (e2e/fixtures.mjs' COACH_USER) og 6 syntetiske atleter
// ("Alfa Testsen" .. "Foxtrot Testsen", opdigtede) med realistiske uger: sidste
// uge fuldt logget, denne uge blandet (logget, sprunget over, RPE, noter,
// vurderinger 1-5, en video). Genbruger byg/server/Chromium fra 419.
// Ingen prod, ingen rigtige navne eller tal.
export { ROOT, MOCK_PORT, startStaticServer, byg, hentChromium } from '../419/uge-faelles.mjs'

const uid = (pre, n) => `${pre}-0000-4000-8000-${String(n).padStart(12, '0')}`
function mandagIUge(offsetUger = 0) {
  const d = new Date()
  const js = d.getDay()
  d.setDate(d.getDate() - (js === 0 ? 6 : js - 1) + offsetUger * 7)
  d.setHours(12, 0, 0, 0)
  return d
}
const datoStr = (d) => d.toISOString().slice(0, 10)

const PAS = [
  { titel: 'Dag 1 — Squat', ugedag: 0, oevelser: [
    { navn: 'Squat', saet: 4, reps: '5', int: 'RPE 7', kg: 100 },
    { navn: 'Bænkpres', saet: 3, reps: '8', int: 'RPE 7', kg: 70 },
    { navn: 'Bulgarsk split squat', saet: 3, reps: '8-10', int: 'RPE 8', kg: null },
  ] },
  { titel: 'Dag 2 — Bænk', ugedag: 1, oevelser: [
    { navn: 'Bænkpres', saet: 4, reps: '4-6', int: 'RPE 8', kg: 80 },
    { navn: 'Rows', saet: 3, reps: '10', int: 'RPE 8', kg: null },
  ] },
  { titel: 'Dag 3 — Dødløft', ugedag: 3, oevelser: [
    { navn: 'Dødløft', saet: 3, reps: '3', int: 'RPE 8', kg: 140 },
    { navn: 'Pause squat', saet: 3, reps: '4', int: 'RPE 7', kg: 85 },
  ] },
  { titel: 'Dag 4 — Volumen', ugedag: 4, oevelser: [
    { navn: 'Squat', saet: 3, reps: '6', int: 'RPE 7', kg: 95 },
    { navn: 'Bænkpres', saet: 4, reps: '6', int: 'RPE 7', kg: 72.5 },
  ] },
]

// Profiler for denne uge. pas: hvilke af de 4 pas der er logget; rpeTillaeg:
// hvor meget over den planlagte RPE atleten landede; spring: pas-index hvor
// et saet er sprunget over; vurdering/kommentar pr. pas; note paa et saet.
export const ATLETER = [
  { navn: 'Alfa Testsen', pas: [0, 1, 2, 3], rpeTillaeg: 0, vurdering: [4, 4, 5, 4], kommentar: { 2: 'Dødløft føltes let i dag' }, note: { pas: 0, tekst: 'Lidt stiv i hoften på første sæt' }, video: true, parathed: 80 },
  { navn: 'Bravo Testsen', pas: [0, 1], rpeTillaeg: 0.5, spring: 1, vurdering: [2, 1], kommentar: { 1: 'Knæet gør ondt, stoppede rows' }, note: { pas: 1, tekst: 'Smerte i venstre knæ' }, parathed: 45 },
  { navn: 'Charlie Testsen', pas: [], parathed: null },
  { navn: 'Delta Testsen', pas: [0, 1, 2, 3], rpeTillaeg: 2, vurdering: [3, 3, 2, 3], kommentar: { 0: 'Alt var tungt, sov dårligt', 3: 'Træt hele ugen' }, note: { pas: 0, tekst: 'Squat gik langsomt op' }, parathed: 55 },
  { navn: 'Echo Testsen', pas: [0, 1, 2], rpeTillaeg: -0.5, vurdering: [5, 4, 5], kommentar: { 0: 'Ny rekord-følelse!' }, parathed: 85 },
  { navn: 'Foxtrot Testsen', pas: [0], rpeTillaeg: 1, vurdering: [3], kommentar: {}, parathed: 60 },
]

export const VIDEO_CLIENT_ID = 'dddddddd-4280-4000-8000-000000000001'
export const VIDEO_ID = 'dddddddd-4280-4000-8000-000000000002'

export function bygCoachSeed(buildSeed, fx) {
  const seed = buildSeed()
  const t = seed.tables
  t.athletes = []; t.weeks = []; t.sessions = []; t.exercises = []; t.exercise_logs = []
  t.readiness_logs = []; t.video_analyses = []; t.messages = []
  let n = 1
  const idx = {}
  ATLETER.forEach((p, ai) => {
    const athleteId = uid('a4280000', ai + 1)
    const userId = uid('b4280000', ai + 1)
    idx[p.navn] = athleteId
    t.profiles.push({ id: userId, role: 'athlete', email: `coachuge${ai + 1}@e2e.test`, last_seen: new Date(Date.now() - (ai + 1) * 3600e3).toISOString() })
    t.athletes.push({ id: athleteId, user_id: userId, name: p.navn, email: `coachuge${ai + 1}@e2e.test`, status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: new Date(Date.now() - 60 * 86400e3).toISOString() })
    for (let u = -1; u <= 0; u++) {
      const mandag = mandagIUge(u)
      const weekId = uid('c4280000', n++)
      t.weeks.push({ id: weekId, athlete_id: athleteId, week_number: u + 5, block_name: 'Styrke', start_date: datoStr(mandag) })
      PAS.forEach((pas, pi) => {
        const logget = u < 0 || (p.pas || []).includes(pi)
        const sessId = uid('d4280000', n++)
        t.sessions.push({ id: sessId, week_id: weekId, title: pas.titel, session_order: pi + 1, weekday: pas.ugedag,
          athlete_rating: u === 0 && logget ? (p.vurdering?.[p.pas.indexOf(pi)] ?? null) : (u < 0 ? 4 : null),
          athlete_comment: u === 0 && logget ? (p.kommentar?.[pi] ?? null) : null })
        pas.oevelser.forEach((o, oi) => {
          const exId = uid('e4280000', n++)
          const kg = o.kg == null ? null : o.kg + u * 2.5
          t.exercises.push({ id: exId, session_id: sessId, name: o.navn, sets: o.saet, reps: o.reps, intensity: o.int, note: null, exercise_order: oi + 1, recommended_weight: kg })
          if (!logget) return
          const dag = new Date(mandag); dag.setDate(dag.getDate() + pas.ugedag)
          const plan = parseFloat(String(o.int).replace('RPE ', '')) || 7
          for (let s = 1; s <= o.saet; s++) {
            const spring = u === 0 && p.spring === pi && oi === pas.oevelser.length - 1
            const note = u === 0 && p.note?.pas === pi && oi === 0 && s === 1 ? p.note.tekst : null
            t.exercise_logs.push({ id: uid('f4280000', n++), exercise_id: exId, athlete_id: athleteId, set_number: s,
              weight: spring ? null : (kg ?? 20 + oi * 5), reps_completed: spring ? null : (parseInt(o.reps, 10) || 8),
              note, rpe_actual: spring ? null : Math.min(10, plan + (u === 0 ? p.rpeTillaeg : 0) + (s === o.saet ? 0.5 : 0)),
              rpe_planned: plan, skipped: spring, logged_at: new Date(dag.getTime() + s * 180000 + oi * 900000).toISOString() })
          }
        })
      })
    }
    if (p.parathed != null) {
      const d = new Date(); d.setDate(d.getDate() - 1)
      t.readiness_logs.push({ id: uid('a4281111', ai + 1), athlete_id: athleteId, logged_date: datoStr(d), sleep_hours: p.parathed > 60 ? 8 : 5.5,
        energy: p.parathed > 60 ? 4 : 2, motivation: p.parathed > 60 ? 4 : 2, stress: p.parathed > 60 ? 2 : 4, soreness_level: p.parathed > 60 ? 2 : 4,
        sore_zones: p.parathed < 50 ? ['knee'] : null, readiness_score: p.parathed, created_at: d.toISOString() })
    }
    if (p.video) {
      t.video_analyses.push({ id: VIDEO_ID, client_analysis_id: VIDEO_CLIENT_ID, athlete_id: athleteId, athlete_name: p.navn,
        source_mode: 'athlete_submission', status: 'draft', schema_version: 3, schema_v: 3, lift: 'squat', variation: 'high-bar',
        load_kg: 100, rpe: 8, reps_count: 5, video_path: `${athleteId}/${VIDEO_CLIENT_ID}.mp4`, analysis_state: 'awaiting_analysis',
        coach_note: null, bias_note: null, metrics: {}, findings: [], bar_path: null, athlete_feedback: null, analyzed_at: null,
        created_at: new Date(Date.now() - 20 * 3600e3).toISOString(),
        session_context: { training_session_id: null, program_item_id: null, coach_note_snapshot: null, baseline_snapshot: [], athlete_note: 'Kan du se om knæene falder ind?', feedback_evidence: null, plate_calibration: null } })
    }
  })
  return { seed, idx }
}

// Mocken svarer [] paa entropi_training_signals_v1. I produktion regner SQL'en
// signalerne; her regnes de med appens eget JS-spejl af samme regler
// (detectSignalsV2 i src/coachBriefingRules.js) paa den syntetiske seed og
// returneres i RPC'ens form (o_*). Bruges via page.route.
export async function signalerFraSeed(seed) {
  const { detectSignalsV2 } = await import('../../src/coachBriefingRules.js')
  const t = seed.tables
  const today = new Date().toISOString().slice(0, 10)
  const rows = []
  for (const athlete of t.athletes) {
    const weeks = t.weeks.filter(w => w.athlete_id === athlete.id).map(w => ({ ...w, sessions: t.sessions.filter(s => s.week_id === w.id) }))
    const logs = t.exercise_logs.filter(l => l.athlete_id === athlete.id).map(l => {
      const ex = t.exercises.find(e => e.id === l.exercise_id)
      return { ...l, name: ex?.name, session_id: ex?.session_id }
    })
    const readiness = t.readiness_logs.filter(r => r.athlete_id === athlete.id)
    for (const s of detectSignalsV2({ athlete, logs, weeks, readiness, personal_records: [], today })) {
      rows.push({ o_athlete_id: s.athlete_id, o_athlete_name: s.athlete_name, o_detector: s.detector, o_severity: s.severity, o_headline: s.headline, o_detail: s.detail, o_metrics: s.metrics })
    }
  }
  return rows
}
