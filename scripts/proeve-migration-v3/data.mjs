// Ordre 1508: syntetiske atleter til migrationsproeven. INGEN rigtige data: navne, id'er og
// vaegte er opdigtede. Datoerne er relative til `today` (SQL bruger current_date), saa de
// samme raekker kan koeres i Postgres og i appens JS-regel (detectSignalsV2) med samme "i dag".
// Uge 0..6 er fuldt forloebne (man/ons/fre); uge 7 er indevaerende uge uden logs.

const DAY = 86400000
const iso = ms => new Date(ms).toISOString().slice(0, 10)
const mondayOf = todayIso => { const ms = Date.parse(`${todayIso}T00:00:00Z`); return ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY }
const uuid = (kind, n) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const r25 = kg => Math.round(kg / 2.5) * 2.5

export const COACH_ID = uuid('c', 1)

// Et topsaet + to backoff (90 %, 5 reps, RPE-1), som i programlaegningen.
const top = (base, kg, reps, rpe, actual = rpe) => [
  { name: `${base} - topsæt`, weight: kg, reps, rpe_planned: rpe, rpe_actual: actual },
  { name: `${base} - backoff`, weight: r25(kg * 0.9), reps: 5, rpe_planned: rpe - 1, rpe_actual: actual - 1 },
  { name: `${base} - backoff`, weight: r25(kg * 0.9), reps: 5, rpe_planned: rpe - 1, rpe_actual: actual - 1 },
]
const lett = (name, kg, reps, rpe = 7) => [1, 2, 3].map(() => ({ name, weight: kg, reps, rpe_planned: rpe, rpe_actual: rpe }))

const ATLETER = [
  { // A: squat staar stille med stigende RPE (alert), KONVENTIONEL staar stille, SUMO stiger og er staerkere end konventionel
    navn: 'Syn Alfa',
    pas: w => [
      [...top('Squat', [120, 125, 130, 135, 135, 135, 135][w], 5, 8, [8, 8, 8, 8, 8, 8.5, 9][w]), ...top('Bænkpres', 80 + 2.5 * w, 5, 8)],
      [...top('Dødløft', [150, 155, 160, 165, 165, 165, 165][w], 3, 8), ...top('Sumo dødløft', 160 + 5 * w, 3, 8)],
      [...lett('Front squat', 90, 6), ...lett('Squat - backoff', 100, 8)],
    ] },
  { // B: omvendt. Konventionel stiger, SUMO (skrevet "Dødløft (sumo)") staar stille. Tester ogsaa sumo-aliaset
    navn: 'Syn Beta',
    pas: w => [
      [...top('Squat', 120 + 5 * w, 5, 8), ...top('Bænkpres', 80 + 2.5 * w, 5, 8)],
      [...top('Dødløft', 150 + 5 * w, 3, 8), ...top('Dødløft (sumo)', [160, 165, 170, 175, 175, 175, 175][w], 3, 8)],
      lett('Pause bænkpres', 70, 6),
    ] },
  { // C: tunge saet staar stille, men et 12-reps volumensaet og et backoff paa 8 stiger. v2 laeser det som fremgang, v3 ikke
    navn: 'Syn Gamma',
    pas: w => [
      [...top('Bænkpres', 90, 3, 8), ...lett('Bænkpres volumen', 70 + 2.5 * w, 12, 8)],
      [...top('Squat', 120 + 5 * w, 5, 8), { name: 'Bænkpres - backoff', weight: 80 + 2.5 * w, reps: 8, rpe_planned: 7, rpe_actual: 7 }],
      lett('Close-grip bænkpres', 70, 8),
    ] },
  { // D: deload-uge (uge 5) mellem to ens uger. SQL udelader deload, JS-reglen kender ikke blokken
    navn: 'Syn Delta',
    blok: w => (w === 5 ? 'Deload' : 'Opbygning'),
    pas: w => [
      top('Squat', [120, 125, 130, 135, 135, 100, 135][w], 5, 8),
      top('Bænkpres', 80 + 2.5 * w, 5, 8),
      lett('Frontsquat', 90, 6),
    ] },
  { // E: kontrol, alt stiger, alle fire hovedloeft
    navn: 'Syn Echo',
    pas: w => [
      [...top('Squat', 120 + 5 * w, 5, 8), ...top('Bænkpres', 80 + 2.5 * w, 5, 8)],
      [...top('Dødløft', 150 + 5 * w, 3, 8), ...top('Sumo dødløft', 160 + 5 * w, 3, 8)],
      lett('Goblet squat', 30, 10),
    ] },
]

export function byggDatasaet(todayIso) {
  const first = mondayOf(todayIso) - 7 * DAY * 7 // uge 0 = 7 uger foer indevaerende uge
  const atleter = ATLETER.map((spec, i) => {
    const id = uuid('a', i + 1)
    const weeks = []
    const logs = []
    for (let w = 0; w < 8; w += 1) {
      const start = iso(first + 7 * DAY * w)
      const week = { id: uuid('b', (i + 1) * 100 + w), athlete_id: id, week_number: w + 1, start_date: start,
        block_name: spec.blok ? spec.blok(w) : 'Opbygning', sessions: [] }
      const pas = w <= 6 ? spec.pas(w) : []
      pas.forEach((sets, p) => {
        const sessionId = uuid('d', (i + 1) * 1000 + w * 10 + p)
        week.sessions.push({ id: sessionId, title: `Pas ${p + 1}`, session_order: p + 1, athlete_comment: null })
        const date = iso(first + 7 * DAY * w + 2 * DAY * p)
        sets.forEach((set, index) => logs.push({
          athlete_id: id, session_id: sessionId, exercise_key: `${sessionId}|${set.name}`,
          logged_at: `${date}T17:${String(index).padStart(2, '0')}:00Z`, skipped: false,
          ...set, reps_completed: set.reps }))
      })
      weeks.push(week)
    }
    return { about: spec.navn, today: todayIso,
      athlete: { id, name: spec.navn, status: 'aktiv', vacation_until: null, coach_id: COACH_ID, hidden: false },
      weeks, logs, readiness: [], personal_records: [] }
  })
  return atleter
}
