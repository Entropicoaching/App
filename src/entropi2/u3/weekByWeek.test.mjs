// U3 commit 7: K3 "Uge for uge" i coachens arbejdsrum. Fejler på commit 6, fordi modulerne mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { weekByWeek, DOT } from './weekByWeek.mjs'
import { WeekByWeekTable } from './WeekByWeekView.mjs'
import { readBlocks } from '../analysis/blokforblok/readBlocks.mjs'
import { fakeU3Client } from './fakeU3Client.mjs'
import { CoachView } from '../coach/CoachScreen.mjs'
import { productionFixture, day as coachDay } from '../coach/coachProductionFixture.mjs'

const today = '2026-11-10'
const athlete = { id: 'atlet-a', kcal_target: 3000, protein_target: 170 }
// Fire afsluttede uger: 12. okt. til 8. nov. Uge 2 (19. til 25. okt.) har ingen kostdage.
const meals = ['2026-10-13', '2026-10-14', '2026-10-27', '2026-11-03', '2026-11-04']
  .map((date, i) => ({ id: `m${i}`, athlete_id: athlete.id, date, meal: 'Frokost', kcal: 2950, protein: 168, carb: 300, fat: 90 }))
const logs = ['2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'].map((d, i) => ({ athlete_id: athlete.id, exercise_id: `e${i}`, set_number: 1,
  logged_at: `${d}T10:00:00Z`, weight: 150 + i, reps_completed: 3, skipped: false, exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }))
const tables = { weeks: [], exercise_logs: logs, meal_logs: meals, weight_logs: [], readiness_logs: [] }

async function model() {
  const data = await readBlocks(fakeU3Client({ ...tables, weeks: [{ id: 'w1', week_number: 1, start_date: '2026-10-12', block_name: 'Styrke', athlete_id: athlete.id, sessions: [] }] }), athlete.id, today, { withMeals: true })
  assert.equal(data.meals.state, 'ready')
  return weekByWeek({ data, athlete, today })
}

test('en uge uden kostdage viser "·", ikke 0', async () => {
  const m = await model()
  assert.deepEqual(m.weeks.map(w => w.label), ['uge 42', 'uge 43', 'uge 44', 'uge 45'])
  const row = label => m.rows.find(r => r[0] === label)[1]
  assert.deepEqual(row('Kostdage'), ['2/7', DOT, '1/7', '2/7'])
  assert.deepEqual(row('Protein g'), ['168', DOT, '168', '168'])
  assert.deepEqual(row('Vægt kg'), [DOT, DOT, DOT, DOT])
  assert.deepEqual(row('Squat e1RM'), ['165', '166', '167', '168'])
  const html = render(h(WeekByWeekTable, { model: m }))
  assert.doesNotMatch(html, /<td[^>]*>0<\/td>/)
})

test('der er ingen pile og ingen årsagstekst, og coachen ser "mod nuværende mål"', async () => {
  const html = render(h(WeekByWeekTable, { model: await model() }))
  assert.doesNotMatch(html, /[↑↓→]|fordi|skyldes|på grund af|derfor/i)
  assert.match(html, /mod nuværende mål: 170 g protein og 3\.000 kcal/)
})

test('arbejdsrummet viser ingen af de to folde uden klient eller med u3 falsk, og der sker ingen L3-læsning', () => {
  const client = fakeU3Client({})
  const p = { ...productionFixture(), today: coachDay, athletesOpen: true }
  for (const extra of [{ u3Data: false }, { notesClient: client, u3Data: false }, { u3Data: true }, {}]) {
    const html = render(h(CoachView, { ...p, ...extra }))
    assert.doesNotMatch(html, /Uge for uge|Blok for blok/)
  }
  const on = render(h(CoachView, { ...p, notesClient: client, u3Data: true }))
  assert.match(on, /Blok for blok[\s\S]*Uge for uge/)
  assert.equal(client.calls.length, 0)
  assert.ok(addCalendarDays(today, 0))
})
