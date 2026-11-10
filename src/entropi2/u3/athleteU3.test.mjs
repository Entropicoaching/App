// U3 commit 3: atletens ugekort (A1 til A3) og L4. Fejler på commit 2, fordi modulerne mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { dayReceipt, confirmedMealDays } from '../../mealEvidence.mjs'
import { readAthleteU3, L4_CAPS } from './readAthleteU3.mjs'
import { athleteWeekCardModel, NO_STRENGTH } from './athleteWeekModel.mjs'
import { AthleteWeekCardView } from './AthleteWeekCard.mjs'
import { fakeU3Client } from './fakeU3Client.mjs'
import Analysis from '../analysis/Analysis.mjs'
import renderAnalysis from '../analysis/testRender.mjs'

const today = '2026-11-10'
const now = new Date(`${today}T12:00:00Z`)
const ATHLETE = { id: 'atlet-a', name: 'Atlet A', goal: 'cut', kcal_target: 3000, protein_target: 170 }
const lastWeek = Array.from({ length: 7 }, (_, i) => addCalendarDays('2026-11-02', i))

function tables({ readinessDays = 7, mealDays = 5, extraReadiness = 0 } = {}) {
  const readiness = lastWeek.slice(0, readinessDays).map((d, i) => ({ athlete_id: ATHLETE.id, logged_date: d, readiness_score: 70 + i, soreness_level: 2 }))
  for (let i = 0; i < extraReadiness; i++) readiness.push({ athlete_id: ATHLETE.id, logged_date: addCalendarDays('2026-10-06', i % 28), readiness_score: 60, soreness_level: 2 })
  const meal_logs = lastWeek.slice(0, mealDays).map((d, i) => ({ id: `m${i}`, athlete_id: ATHLETE.id, date: d, meal: 'Frokost', kcal: 2900, protein: 160, carb: 300, fat: 90, created_at: `${d}T12:00:00Z` }))
  const weeks = [{ id: 'w1', week_number: 7, start_date: '2026-11-02', block_name: 'Styrke 2', athlete_id: ATHLETE.id,
    sessions: [{ id: 's1', exercises: [{ id: 'e1', name: 'Squat', sets: 2 }] }, { id: 's2', exercises: [{ id: 'e2', name: 'Bænkpres', sets: 1 }] }] }]
  const exercise_logs = [
    { athlete_id: ATHLETE.id, exercise_id: 'e1', set_number: 1, logged_at: '2026-11-03T10:00:00Z', weight: 150, reps_completed: 5, skipped: false },
    { athlete_id: ATHLETE.id, exercise_id: 'e1', set_number: 2, logged_at: '2026-11-03T10:05:00Z', weight: 150, reps_completed: 5, skipped: false },
  ]
  return { readiness_logs: readiness, meal_logs, weeks, exercise_logs }
}
const weights = (extra = []) => [
  ...['2026-10-27', '2026-10-28', '2026-10-29'].map(d => ({ athlete_id: ATHLETE.id, logged_at: d, weight: 82.8, created_at: `${d}T07:00:00Z` })),
  ...['2026-11-03', '2026-11-05', '2026-11-08'].map(d => ({ athlete_id: ATHLETE.id, logged_at: d, weight: 82.4, created_at: `${d}T07:00:00Z` })),
  ...extra,
]
async function model(options = {}, extra = {}) {
  const client = fakeU3Client(tables(options))
  const data = await readAthleteU3(client, ATHLETE.id, today)
  return athleteWeekCardModel({ today, athlete: ATHLETE, data, weightLogs: weights(), now, ...extra })
}
const keys = m => m.lines.map(l => l.key)

test('ugekortet viser ikke en linje, der er under minimum', async () => {
  const full = await model()
  assert.deepEqual(keys(full), ['training', 'nutrition', 'weight', 'readiness'])
  assert.equal(full.label, 'Min uge · 2. til 8. nov.')
  assert.equal(full.lines[0].text, '1 af 2 pas · 1,5 t')
  assert.equal(full.lines[1].text, '5 af 7 dage · 160 g protein (mål 170 g)')
  assert.equal(full.lines[3].text, '73 i snit')
  const thin = await model({ readinessDays: 3, mealDays: 3 })
  assert.deepEqual(keys(thin), ['training', 'weight'])
})

test('er alle fire linjer under minimum, renderes intet', async () => {
  const client = fakeU3Client({ ...tables({ readinessDays: 3, mealDays: 3 }), weeks: [], exercise_logs: [] })
  const data = await readAthleteU3(client, ATHLETE.id, today)
  const m = athleteWeekCardModel({ today, athlete: ATHLETE, data, weightLogs: weights().slice(0, 2), now })
  assert.equal(m.lines.length, 0)
  assert.equal(m.showCard, false)
  const html = render(h(AthleteWeekCardView, { model: m }))
  assert.doesNotMatch(html, /Min uge|data-u3-week-card|sammenhæng/)
})

const analysisProps = extra => ({ entropi2: true, now, athlete: ATHLETE, currentWeek: { start_date: '2026-11-09', block_name: 'Styrke 2', sessions: [] },
  exerciseLogs: [], fremgangLogs: [], weightLogs: [], ...extra })

test('med flaget slukket er Analysis uændret, og der sker ingen L4-læsning', () => {
  const client = fakeU3Client(tables())
  const before = renderAnalysis(analysisProps()).textContent
  const after = renderAnalysis(analysisProps({ u3Client: client })).textContent
  assert.equal(after, before)
  assert.equal(render(h(Analysis, analysisProps({ u3Client: client }))), render(h(Analysis, analysisProps())))
  assert.equal(client.calls.length, 0)
  // Med flaget tændt monteres ugekortet øverst, lige under overskriften.
  const on = render(h(Analysis, analysisProps({ u3Client: client, u3Data: true })))
  assert.match(on, /<h1[^>]*>Din analyse<\/h1><div data-u3-athlete-top="true">/)
  assert.doesNotMatch(render(h(Analysis, analysisProps({ u3Data: true }))), /data-u3-athlete-top/)
})

test('L4 med 101 readinessrækker gør readinesslinjen ukendt, ikke nul', async () => {
  const over = fakeU3Client(tables({ extraReadiness: L4_CAPS.readiness + 1 - 7 }))
  const data = await readAthleteU3(over, ATHLETE.id, today)
  assert.equal(data.readiness.state, 'unknown')
  const m = athleteWeekCardModel({ today, athlete: ATHLETE, data, weightLogs: weights(), now })
  assert.ok(!keys(m).includes('readiness'))
  assert.doesNotMatch(JSON.stringify(m.lines), /Readiness/)
  const call = over.calls.find(c => c.table === 'readiness_logs')
  assert.equal(call.limit, L4_CAPS.readiness + 1)
  const atCap = fakeU3Client(tables({ extraReadiness: L4_CAPS.readiness - 7 }))
  assert.equal((await readAthleteU3(atCap, ATHLETE.id, today)).readiness.state, 'ready')
})

test('L4 vælger alle kolonner, som kvitteringens signatur kræver', async () => {
  const t = tables()
  const day = lastWeek[0]
  const rows = t.meal_logs.filter(r => r.date === day)
  // Kvitteringen laves af de rækker, som gemmes, med alle syv felter.
  const receipt = { ...dayReceipt(rows.map(({ id, date, meal, kcal, protein, carb, fat }) => ({ id, date, meal, kcal, protein, carb, fat })), day, today), athlete_id: ATHLETE.id, id: 'kvit' }
  t.meal_logs.push(receipt)
  const client = fakeU3Client(t)
  const data = await readAthleteU3(client, ATHLETE.id, today)
  assert.deepEqual(Object.keys(data.meals.rows[0]).sort(), ['carb', 'date', 'fat', 'id', 'kcal', 'meal', 'protein'])
  assert.deepEqual(confirmedMealDays(data.meals.rows).map(r => r.date), [day])
})

test('vægt med et mål i fritekst står uden "mod dit mål"', async () => {
  const free = await model({}, { athlete: { ...ATHLETE, goal: 'Stævne i marts' } })
  const line = free.lines.find(l => l.key === 'weight')
  assert.ok(line)
  assert.doesNotMatch(line.text, /mod dit mål/)
  const cut = (await model()).lines.find(l => l.key === 'weight')
  assert.match(cut.text, /på vej mod dit mål/)
  assert.match(cut.text, /−0,4 kg\/uge/)
})

test('weightTrend kaldes med i går: en vejning i dag ændrer ikke tallet', async () => {
  const base = (await model()).lines.find(l => l.key === 'weight').text
  const client = fakeU3Client(tables())
  const data = await readAthleteU3(client, ATHLETE.id, today)
  const withToday = athleteWeekCardModel({ today, athlete: ATHLETE, data, now,
    weightLogs: weights([{ athlete_id: ATHLETE.id, logged_at: today, weight: 79, created_at: `${today}T07:00:00Z` }]) })
  assert.equal(withToday.lines.find(l => l.key === 'weight').text, base)
})

test('uden fire ugers tunge sæt vises kun én besked om styrke', async () => {
  const m = await model({}, { fremgangLogs: [] })
  assert.deepEqual(m.strength, { lifts: [], message: NO_STRENGTH })
  assert.equal((await model()).strength, null)
})
