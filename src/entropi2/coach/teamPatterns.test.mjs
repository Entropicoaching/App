// U3 commit 6: gruppen og L2. Fejler på commit 5, fordi modulerne mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { groupCount, teamPatterns, teamAthletes } from './teamPatterns.mjs'
import { readTeamPatterns, L2_CAPS } from './teamPatternsRead.mjs'
import { TeamPatternsBody } from './TeamPatternsView.mjs'
import { CoachView } from './CoachScreen.mjs'
import { productionFixture, day as coachDay } from './coachProductionFixture.mjs'
import { fakeU3Client } from '../u3/fakeU3Client.mjs'

const today = '2026-11-10'
const athletes = n => Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, name: `Atlet ${String.fromCharCode(65 + i)}`, protein_target: 150 }))
const targets = list => new Map(list.map(a => [a.id, a.protein_target]))
const meals = (id, days, protein = 150) => Array.from({ length: days }, (_, i) => ({ id: `${id}-m${i}`, athlete_id: id, date: addCalendarDays(today, -1 - i), meal: 'Frokost', kcal: 2500, protein, carb: 300, fat: 80 }))
const squat = (id, weights) => weights.map((w, i) => ({ athlete_id: id, exercise_id: `${id}-sq${i}`, set_number: 1,
  logged_at: `${addCalendarDays('2026-10-13', i * 7)}T10:00:00Z`, weight: w, reps_completed: 3, skipped: false,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }))

test('groupCount: under 5 i grundlag vises ikke; 1 til 4 skrives "under 5"', () => {
  assert.equal(groupCount(2, 4), null)
  assert.equal(groupCount(3, 11), 'under 5 af 11')
  assert.equal(groupCount(13, 14), 'alle på nær under 5 af 14')
  assert.equal(groupCount(14, 14), '14 af 14')
  assert.equal(groupCount(0, 6), '0 af 6')
  assert.equal(groupCount(9, 14), '9 af 14')
})

test('en nævner på 4 atleter viser ikke spørgsmålet', () => {
  const list = athletes(4)
  const r = teamPatterns({ athletes: list, meals: list.flatMap(a => meals(a.id, 5)), logs: [], targets: targets(list), today })
  assert.equal(r.g1, null)
  assert.equal(r.g2, null)
})

test('13 af 14 og 14 af 14 og median i procent', () => {
  const list = athletes(14)
  const rows = list.flatMap((a, i) => meals(a.id, i === 0 ? 2 : 5, i < 7 ? 150 : 120))
  const r = teamPatterns({ athletes: list, meals: rows, logs: [], targets: targets(list), today })
  assert.equal(r.g1.text, 'alle på nær under 5 af 14 logger kost mindst 4 af 7 dage')
  assert.equal(r.g2.text, '6 af 13 rammer protein, median 80 % af målet')
  const all = teamPatterns({ athletes: list, meals: list.flatMap(a => meals(a.id, 5)), logs: [], targets: targets(list), today })
  assert.equal(all.g1.text, '14 af 14 logger kost mindst 4 af 7 dage')
})

test('G1 tæller ikke dagen i dag', () => {
  const list = athletes(6)
  const rows = list.flatMap(a => [...meals(a.id, 3), { id: `${a.id}-idag`, athlete_id: a.id, date: today, meal: 'Morgenmad', kcal: 800, protein: 40, carb: 90, fat: 20 }])
  assert.equal(teamPatterns({ athletes: list, meals: rows, logs: [], targets: targets(list), today }).g1.text, '0 af 6 logger kost mindst 4 af 7 dage')
})

test('G3 tæller plateau og fald og skriver "står stille eller falder"', () => {
  const list = athletes(14)
  const logs = list.flatMap((a, i) => squat(a.id, i < 2 ? [150, 150, 150, 150] : i < 3 ? [160, 160, 160, 140] : [140, 145, 150, 155]))
  const r = teamPatterns({ athletes: list, meals: [], logs, targets: targets(list), today })
  const sq = r.g3.find(l => l.key === 'squat')
  assert.equal(sq.n, 3)
  assert.equal(sq.total, 14)
  assert.equal(sq.text, 'under 5 af 14 står stille eller falder')
  assert.equal(r.g3.find(l => l.key === 'baenkpres').text, null)
})

test('DOM indeholder intet navn, intet id og ingen data-athlete', () => {
  const list = athletes(14)
  const logs = list.flatMap(a => squat(a.id, [140, 145, 150, 155]))
  const r = teamPatterns({ athletes: list, meals: list.flatMap(a => meals(a.id, 5)), logs, targets: targets(list), today })
  const html = render(h(TeamPatternsBody, { result: r }))
  assert.match(html, /14 af 14 logger kost/)
  assert.doesNotMatch(html, /Atlet [A-Z]|id-\d|data-athlete|data-coach-nutrition/)
})

test('en skjult atlet og en atlet på ferie tæller ikke og læses ikke', async () => {
  const list = [...athletes(6), { id: 'skjult', name: 'Atlet S', hidden: true }, { id: 'ferie', name: 'Atlet F', status: 'ferie' },
    { id: 'ferie2', name: 'Atlet G', vacation_until: '2026-11-20' }]
  const eligible = teamAthletes(list, today)
  assert.deepEqual(eligible.map(a => a.id), list.slice(0, 6).map(a => a.id))
  const client = fakeU3Client({ meal_logs: list.flatMap(a => meals(a.id, 5)), exercise_logs: [] })
  const read = await readTeamPatterns(client, eligible.map(a => a.id), today)
  for (const call of client.calls) {
    const ids = call.args.find(a => a[0] === 'in' && a[1] === 'athlete_id')[2]
    assert.ok(!ids.includes('skjult') && !ids.includes('ferie') && !ids.includes('ferie2'))
  }
  assert.ok(read.meals.every(r => !['skjult', 'ferie', 'ferie2'].includes(r.athlete_id)))
})

test('loft på exercise_logs skjuler kun G3, loft på meal_logs kun G1 og G2', async () => {
  const list = athletes(6)
  const ids = list.map(a => a.id)
  const manyLogs = Array.from({ length: L2_CAPS.logs + 1 }, (_, i) => ({ ...squat('id-0', [100])[0], set_number: i + 1 }))
  const capLogs = await readTeamPatterns(fakeU3Client({ meal_logs: list.flatMap(a => meals(a.id, 5)), exercise_logs: manyLogs }), ids, today)
  assert.equal(capLogs.logs, null)
  const a = teamPatterns({ athletes: list, meals: capLogs.meals, logs: capLogs.logs, targets: targets(list), today })
  assert.ok(a.g1 && a.g2)
  assert.equal(a.g3, null)
  const manyMeals = Array.from({ length: L2_CAPS.meals + 1 }, (_, i) => ({ ...meals('id-0', 1)[0], id: `x${i}` }))
  const capMeals = await readTeamPatterns(fakeU3Client({ meal_logs: manyMeals, exercise_logs: [] }), ids, today)
  assert.equal(capMeals.meals, null)
  const b = teamPatterns({ athletes: list, meals: capMeals.meals, logs: capMeals.logs, targets: targets(list), today })
  assert.equal(b.g1, null)
  assert.equal(b.g2, null)
  assert.ok(Array.isArray(b.g3))
})

test('"Holdet samlet" er en lukket fold under Holdoverblik, kun med flaget, og læser ikke før den åbnes', () => {
  const client = fakeU3Client({})
  const p = { ...productionFixture(), today: coachDay, notesClient: client }
  assert.doesNotMatch(render(h(CoachView, p)), /Holdet samlet/)
  const html = render(h(CoachView, { ...p, u3Data: true }))
  assert.match(html, /data-coach-fold="hold"[\s\S]*data-coach-fold="holdet-samlet"[\s\S]*Holdet samlet/)
  assert.doesNotMatch(html, /data-coach-fold="holdet-samlet"[^>]*open/)
  assert.equal(client.calls.length, 0)
})
