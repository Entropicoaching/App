import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// U9 (Marc 11. nov.): "Program og Fremgang: ingen synlige ændringer. Tjek kun, at data spiller sammen
// (samme tal for e1RM, pas og kost på tværs af Program, Fremgang, Hjem og coachens visninger)."
// Prøven kalder de rene modeller, som de enkelte visninger selv bruger, på ét syntetisk datasæt.
// Ingen visning ændres; prøven læser kun.

import { homeModel } from './entropi2/home/homeModel.mjs'
import { homeWeekOverview } from './entropi2/home/homeWeekOverview.mjs'
import { homeRecordSnapshot } from './entropi2/home/homeRecord.mjs'
import { readHomeRecordHistory } from './entropi2/home/homeRecordRead.mjs'
import { analysisModel } from './entropi2/analysis/analysisModel.mjs'
import { weeklyReportModel as athleteReportModel } from './entropi2/analysis/ugerapport/weeklyReportModel.mjs'
import { weekProgressSentence } from './entropi2/analysis/weekProgressSentence.mjs'
import { athleteWeekCardModel } from './entropi2/u3/athleteWeekModel.mjs'
import { readAthleteU3 } from './entropi2/u3/readAthleteU3.mjs'
import { sessionCounts } from './entropi2/u3/sessionCounts.mjs'
import { fakeU3Client } from './entropi2/u3/fakeU3Client.mjs'
import { weeklyReportModel as coachReportModel } from './entropi2/coach/weeklyReportModel.mjs'
import { coachNutritionLines } from './entropi2/coach/coachNutrition.mjs'
import { adaptCoachState } from './entropi2/coach/coachModel.mjs'
import { nutritionWeek, nutritionBasis } from './entropi2/kostMaal/nutritionWeek.mjs'
import { hovedloeftStatus } from './coachFremgang.js'
import { isSessionDone } from './nextSet.js'
import { estimatedOneRepMax } from './exerciseProgress.js'

// ---------- Syntetisk datasæt (ingen rigtige navne) ----------
const ATLET = 'syntetisk-atlet-1'
const COACH = 'syntetisk-coach-1'
const BLOK = 'Syntetisk styrkeblok'
const NU = '2026-11-11T12:00:00+01:00' // onsdag i programuge 4
const SOENDAG = '2026-11-08T21:00:00+01:00' // sidste dag i den afsluttede programuge 3
const athlete = { id: ATLET, name: 'Syntetisk atlet', kcal_target: 2800, protein_target: 180 }

const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const STARTS = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']

// Tre pas om ugen: A mandag (squat 3 x 3), B onsdag og C fredag (squat 2 x 5). Bænkpres i alle pas.
function makeWeek(start, index) {
  const n = index + 1, weekId = `uge-${n}`
  const session = (key, weekday, order, squatSets, squatReps, benchSets) => ({
    id: `${weekId}-${key}`, week_id: weekId, title: `Pas ${key.toUpperCase()}`, weekday, session_order: order,
    exercises: [
      { id: `${weekId}-${key}-sq`, name: 'Squat', sets: squatSets, reps: String(squatReps), exercise_order: 1 },
      { id: `${weekId}-${key}-bp`, name: 'Bænkpres', sets: benchSets, reps: '5', exercise_order: 2 },
    ],
  })
  return { id: weekId, athlete_id: ATLET, program_id: 'syntetisk-program', week_number: n, block_name: BLOK,
    start_date: start, sessions: [session('a', 0, 1, 3, 3, 3), session('b', 2, 2, 2, 5, 2), session('c', 4, 3, 2, 5, 2)] }
}
const weeks = STARTS.map(makeWeek)
const [, , uge3, uge4] = weeks

// Hvilke pas er logget. Uge 3: A og B helt, C helt uden logs. Uge 4 (nu): A helt (mandag), B (i dag) og C tomme.
const LOGGET = { 'uge-1': ['a', 'b', 'c'], 'uge-2': ['a', 'b', 'c'], 'uge-3': ['a', 'b'], 'uge-4': ['a'] }
// Vægte pr. uge. Squat i pas A stiger, så mandagens 150 kg x 3 i uge 4 er ny rekord (e1RM 165).
const SQUAT_A = [135, 140, 145, 150], SQUAT_BC = [120, 122.5, 125, 127.5]
const BENCH_A = [90, 92.5, 95, 97.5], BENCH_BC = [85, 87.5, 90, 92.5]

const logs = []
weeks.forEach((week, wi) => {
  for (const session of week.sessions) {
    if (!LOGGET[week.id].includes(session.id.split('-').at(-1))) continue
    const day = addDays(week.start_date, session.weekday)
    let minute = 10
    for (const ex of session.exercises) {
      const isA = session.id.endsWith('-a')
      const weight = ex.name === 'Squat' ? (isA ? SQUAT_A : SQUAT_BC)[wi] : (isA ? BENCH_A : BENCH_BC)[wi]
      for (let set = 1; set <= ex.sets; set++) {
        // Midt på dagen, så kalenderdagen er den samme i alle tidszoner, prøven kan køre i.
        logs.push({ id: `log-${ex.id}-${set}`, athlete_id: ATLET, exercise_id: ex.id, set_number: set,
          weight, reps_completed: Number(ex.reps), rpe_actual: 8, skipped: false,
          logged_at: `${day}T17:${String(minute++).padStart(2, '0')}:00+01:00`,
          exercises: { id: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, recommended_weight: null,
            session_id: session.id, sessions: { id: session.id, title: session.title, session_order: session.session_order,
              weeks: { week_number: week.week_number, block_name: BLOK } } } })
      }
    }
  }
})

// Kost: fem dage i uge 3 (mandag til fredag, weekenden uden kost) og tre dage i uge 4.
const DAGSKOST = { '2026-11-02': [2750, 171], '2026-11-03': [2900, 185], '2026-11-04': [2800, 180],
  '2026-11-05': [2600, 160], '2026-11-06': [3000, 190], '2026-11-09': [2850, 182], '2026-11-10': [2700, 175],
  '2026-11-11': [1400, 90] }
const meals = Object.entries(DAGSKOST).flatMap(([date, [kcal, protein]]) => [
  { id: `maal-${date}-1`, athlete_id: ATLET, date, meal: 'Syntetisk morgenmad', kcal: kcal * 0.4, protein: protein * 0.4, carb: 50, fat: 20 },
  { id: `maal-${date}-2`, athlete_id: ATLET, date, meal: 'Syntetisk aftensmad', kcal: kcal * 0.6, protein: protein * 0.6, carb: 80, fat: 30 },
])

// ---------- Hver visnings input, projiceret som appens egne læsninger ----------
const at = iso => Date.parse(iso)
const logsUntil = iso => logs.filter(r => at(r.logged_at) <= at(iso))
const weekLogs = week => logs.filter(r => week.sessions.some(s => s.exercises.some(e => e.id === r.exercise_id)))
  .map(({ exercises, id, ...row }) => ({ id, ...row }))

// AthleteView: allWeeks/currentWeek/exerciseLogs (kun den viste uge) og fremgangLogs (fremgangLogsQuery).
function athleteProps(week, now) {
  return { enabled: true, entropi2: true, athlete, allWeeks: weeks, currentWeek: week, now: new Date(now),
    exerciseLogs: weekLogs(week).filter(r => at(r.logged_at) <= at(now)),
    fremgangLogs: logsUntil(now).map(r => ({ exercise_id: r.exercise_id, weight: r.weight, reps_completed: r.reps_completed,
      logged_at: r.logged_at, exercises: { name: r.exercises.name, sessions: { weeks: { block_name: BLOK } } } })),
    historicalMealLogs: meals.filter(m => m.date <= now.slice(0, 10)) }
}

// Dashboard: læsekontekst, kalenderuger (session_count), aktivitetslog og kostkvittering for coachens dag.
function coachProps(now) {
  const day = now.slice(0, 10), from = addDays(day, -6)
  return {
    session: { user: { id: COACH } },
    readContext: { coachId: COACH, day, athleteIds: [ATLET] },
    athletes: [{ id: ATLET, name: athlete.name, kcal_target: 2800, protein_target: 180 }],
    calendarWeeks: { [ATLET]: weeks.map(w => ({ id: w.id, athlete_id: ATLET, week_number: w.week_number,
      block_name: w.block_name, start_date: w.start_date, session_count: w.sessions.length,
      exercise_count: w.sessions.flatMap(s => s.exercises).length })) },
    coachActionsStatus: { calendar: 'ready', activity: { day, state: 'ready', ids: [ATLET],
      rows: logsUntil(now).map(r => ({ athlete_id: r.athlete_id, exercise_id: r.exercise_id, set_number: r.set_number,
        logged_at: r.logged_at, weight: r.weight, reps_completed: r.reps_completed, skipped: r.skipped,
        rpe_actual: r.rpe_actual, exercises: { reps: r.exercises.reps, recommended_weight: null,
          sessions: { id: r.exercises.sessions.id, session_order: r.exercises.sessions.session_order,
            weeks: { week_number: r.exercises.sessions.weeks.week_number } } } })) } },
    coachNutrition: { coachId: COACH, day, athleteIds: [ATLET], state: 'ready', complete: true, from, through: day,
      rows: meals.filter(m => m.date >= from && m.date <= day), targets: [{ athlete_id: ATLET, kcal_target: 2800, protein_target: 180 }] },
  }
}

// Supabase-tabeller til de læsere, som Hjem (rekord) og Fremgang (Min uge) selv kalder.
const client = () => fakeU3Client({
  exercise_logs: logs, meal_logs: meals, readiness_logs: [],
  weeks: weeks.map(w => ({ id: w.id, week_number: w.week_number, start_date: w.start_date, block_name: w.block_name,
    athlete_id: ATLET, sessions: w.sessions.map(s => ({ id: s.id, exercises: s.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets })) })) })),
})

// Programfanens grønne "Gennemført": ProgramTab.jsx kan ikke importeres i node (JSX). Den bruger isDone
// (alle sæt har en logrække); nextSet.js's isSessionDone er dokumenteret som samme regel og kaldes her.
const programDone = (week, now) => {
  const rows = weekLogs(week).filter(r => at(r.logged_at) <= at(now))
  return week.sessions.filter(s => isSessionDone(s, rows.filter(r => s.exercises.some(e => e.id === r.exercise_id)))).length
}
const r1 = n => Math.round(n * 10) / 10

test('U9 data: ProgramTab tæller stadig et pas som gennemført, når alle sæt har en logrække', () => {
  const source = readFileSync(new URL('./athlete/ProgramTab.jsx', import.meta.url), 'utf8')
  assert.match(source, /const isDone = totalSets > 0 && new Set\(sessionLogs\.map\(l => `\$\{l\.exercise_id\}\|\$\{l\.set_number\}`\)\)\.size >= totalSets/)
})

test('U9 data: bedste squat e1RM er det samme i Fremgang, Hjem og coachens profil', async () => {
  const props = athleteProps(uge4, NU)
  // Fremgang, "Dine rekorder": analysisModel -> personalRecords (hele den indlæste historik).
  const records = analysisModel(props, props.now).personalRecords
  const squat = records.lifts.find(l => l.lift === 'Squat')
  assert.ok(squat, 'Fremgang viser en squatrekord')
  assert.equal(squat.bestEstimate.date, '2026-11-09')
  assert.equal(r1(squat.bestEstimate.value), 165)

  // Fremgang, ugerapporten: bedste squat e1RM i den aktuelle uge (samme dag, mandag 9. nov.).
  const report = athleteReportModel(props, props.now)
  assert.equal(r1(report.lifts.find(l => l.lift === 'Squat').value), r1(squat.bestEstimate.value))

  // Hjem, "Ny rekord": den faktiske historiklæser og homeRecordSnapshot. Hjem viser vægt x reps;
  // e1RM regnes med den fælles formel, så tallet skal være Fremgangs bedste e1RM.
  const history = await readHomeRecordHistory({ athleteId: ATLET, client: client() })
  assert.equal(history.status, 'ready')
  const snap = homeRecordSnapshot({ ...props, readOnly: false }, history, props.now)
  assert.ok(snap?.record, 'Hjem viser en ny rekord')
  assert.deepEqual(snap.record, { lift: 'Squat', weight: squat.bestEstimate.weight, reps: squat.bestEstimate.reps, date: squat.bestEstimate.date })
  assert.equal(r1(estimatedOneRepMax(snap.record.weight, snap.record.reps)), r1(squat.bestEstimate.value))

  // Coachens atletprofil (ProfilHoved -> styrkeLinje -> hovedloeftStatus): højeste e1RM seneste 28 dage,
  // afrundet til hele kg. Rekorden ligger inden for de 28 dage, så tallet skal være det samme.
  const coach = hovedloeftStatus(logsUntil(NU), '2026-11-11').find(s => s.navn === 'Squat')
  assert.equal(coach.nu, Math.round(squat.bestEstimate.value))
  assert.equal(coach.punkter.at(-1).dag, squat.bestEstimate.date)
})

test('U9 data: pas i den aktuelle uge er ens på Hjem, Program, Fremgang og i coachens ugerapport', () => {
  const props = athleteProps(uge4, NU)
  // Hjem: ugelinjen "Ugen: x af y pas" (homeWeekOverview -> weekSummary -> weekSessions).
  assert.equal(homeWeekOverview(props).line, 'Ugen: 1 af 3 pas')
  // Hjem: dagens pas (onsdag) er pas B uden logs.
  const home = homeModel(props)
  assert.equal(home.kind, 'today')
  assert.equal(home.target.session.id, 'uge-4-b')
  assert.equal(home.logged, 0)
  // Program: grøn markering pr. pas.
  assert.equal(programDone(uge4, NU), 1)
  // Fremgang: ugerapporten (weekOverview.counts) og ugesætningen.
  const report = athleteReportModel(props, props.now)
  assert.equal(report.sessionCounts.done, 1)
  assert.equal(report.sessionCounts.planned, 3)
  assert.equal(analysisModel(props, props.now).weekOverview.counts.done, 1)
  assert.equal(weekProgressSentence(props, props.now), 'Denne uge: 1 afsluttet pas og 6 bekræftede sæt.')
  // Coach: "mindst ét sæt" er nok til et pas, Program kræver alle sæt. Pas A er fuldt logget og B, C
  // er helt tomme, så begge definitioner skal give 1 af 3.
  const coach = coachReportModel(coachProps(NU), new Date(NU)).rows[0].training
  assert.equal(coach.start, uge4.start_date)
  assert.equal(coach.completed, 1)
  assert.equal(coach.planned, 3)
})

test('U9 data: pas i den afsluttede uge er ens i Fremgang (Min uge), Hjem, Program og coachens ugerapport', async () => {
  // Fremgang "Min uge" viser den seneste AFSLUTTEDE uge (mandag 2. til søndag 8. nov.). Hjem og coachen
  // viser den uge, der indeholder dagen; derfor kaldes de med søndag 8. nov. som deres dag.
  const data = await readAthleteU3(client(), ATLET, '2026-11-11')
  const card = athleteWeekCardModel({ today: '2026-11-11', athlete, data, now: new Date(NU) })
  assert.equal(card.start, uge3.start_date)
  const training = card.lines.find(l => l.key === 'training')
  assert.ok(training, 'Min uge viser træning')
  assert.equal(training.done, 2)
  assert.equal(training.planned, 3)

  const sunday = athleteProps(uge3, SOENDAG)
  assert.equal(homeWeekOverview(sunday).line, `Ugen: ${training.done} af ${training.planned} pas`)
  assert.equal(programDone(uge3, SOENDAG), training.done)
  assert.equal(sessionCounts(uge3, weekLogs(uge3), { today: '2026-11-08', now: new Date(SOENDAG) }).done, training.done)
  assert.equal(athleteReportModel(sunday, sunday.now).sessionCounts.done, training.done)
  const coach = coachReportModel(coachProps(SOENDAG), new Date(SOENDAG)).rows[0].training
  assert.equal(coach.start, uge3.start_date)
  assert.equal(coach.completed, training.done)
  assert.equal(coach.planned, training.planned)
})

test('U9 data: kost for samme syv dage er ens i Fremgang (Min uge og ugerapport) og hos coachen', async () => {
  // Fremgang "Min uge": kostdage og gennemsnitligt protein pr. kostdag i uge 3 (2. til 8. nov.).
  const data = await readAthleteU3(client(), ATLET, '2026-11-11')
  const card = athleteWeekCardModel({ today: '2026-11-11', athlete, data, now: new Date(NU) })
  const kost = card.lines.find(l => l.key === 'nutrition')
  assert.ok(kost, 'Min uge viser kost')
  assert.equal(kost.days, 5)
  assert.equal(r1(kost.proteinAverage), 177.2)
  assert.equal(kost.proteinTarget, 180)

  // Coachen ser altid de seneste syv dage til og med sin dag. Med søndag 8. nov. er det præcis uge 3.
  const props = coachProps(SOENDAG)
  const day = '2026-11-08'
  const data2 = adaptCoachState(props, new Date(SOENDAG))
  const line = coachNutritionLines(props, day, data2.athletes, data2.rosterReady).get(ATLET)
  assert.ok(line, 'coachens kostoverblik viser atleten')
  assert.equal(line.days, kost.days)
  assert.equal(r1(line.protein), r1(kost.proteinAverage))
  assert.equal(r1(line.kcal), 2810)
  // Coachens kostmål-visning (KostMaal -> nutritionWeek) over samme kvittering.
  const week = nutritionWeek({ athlete: { ...athlete }, today: day, coachNutrition: props.coachNutrition,
    readContext: props.readContext, session: props.session },
  nutritionBasis({ athlete, today: day, coachNutrition: props.coachNutrition, readContext: props.readContext, session: props.session }))
  assert.equal(week.days, kost.days)
  assert.equal(r1(week.protein), r1(kost.proteinAverage))
  assert.equal(r1(week.kcal), r1(line.kcal))
  // Coachens ugerapport: loggede kostdage og dage med proteinmålet nået.
  const coachKost = coachReportModel(props, new Date(SOENDAG)).rows[0].nutrition
  assert.equal(coachKost.logged, kost.days)
  assert.equal(coachKost.proteinGoal, kost.proteinTarget)
  const hit = Object.entries(DAGSKOST).filter(([d, [, p]]) => d >= '2026-11-02' && d <= day && p >= 180).length
  assert.equal(coachKost.reached, hit)
  // Atletens ugerapport i Fremgang tæller kostdage i den aktuelle uge; søndag er det samme uge.
  const sunday = athleteProps(uge3, SOENDAG)
  assert.equal(athleteReportModel(sunday, sunday.now).mealDays, kost.days)
  // Onsdag 11. nov. bruger visningerne bevidst forskellige vinduer: coachen 5. til 11. nov. (fem dage),
  // atletens ugerapport kun den aktuelle uge 9. til 11. nov. (tre dage). Det er ikke et misforhold.
  const wednesday = coachProps(NU)
  const wData = adaptCoachState(wednesday, new Date(NU))
  assert.equal(coachNutritionLines(wednesday, '2026-11-11', wData.athletes, wData.rosterReady).get(ATLET).days, 5)
  assert.equal(athleteReportModel(athleteProps(uge4, NU), new Date(NU)).mealDays, 3)
})
