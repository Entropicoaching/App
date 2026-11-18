// Ordre 1625: atletens ugekort viser væske og kostvane de seneste 7 dage med samme regnestykke som coachens dagslinje.
// Fejler før ændringen, fordi dayWaterKostLine og dayLine mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { dayWaterKostLine, athleteWeekCardModel } from './athleteWeekModel.mjs'
import { AthleteWeekCardView } from './AthleteWeekCard.mjs'
import { readDaily } from '../u7/dayData.mjs'
import { dayNumbersLine } from '../u7/coachData.mjs'
import { fakeBackend } from '../u7/fakeBackend.fixture.mjs'

const A = 'synthetic-atlet-t'
const today = '2026-11-18'
const d = n => addCalendarDays(today, n)
const water = (n, ml) => ({ athlete_id: A, logged_date: d(n), water_ml: ml })
const done = n => ({ athlete_id: A, logged_date: d(n), kost_done_at: `${d(n)}T18:00:00Z` })
const ready = rows => ({ state: 'ready', rows })
const fiveWater = [0, -1, -2, -3, -4].map((n, i) => water(n, [2000, 2000, 2100, 2200, 2200][i]))
const fourKost = [0, -1, -3, -5].map(done)

test('begge dele: væske i snit og kostvane i én linje', () => {
  assert.equal(dayWaterKostLine(ready([...fiveWater, ...fourKost]), today), 'Væske 2,1 l i snit (5 dage) · Kostvane 4 af 7 dage · sidste 7 dage')
})

test('kun væske og kun kostvane', () => {
  assert.equal(dayWaterKostLine(ready(fiveWater), today), 'Væske 2,1 l i snit (5 dage) · sidste 7 dage')
  assert.equal(dayWaterKostLine(ready(fourKost), today), 'Kostvane 4 af 7 dage · sidste 7 dage')
})

test('ingen data, tabel missing og fejl giver ingen linje', () => {
  assert.equal(dayWaterKostLine(ready([]), today), null)
  assert.equal(dayWaterKostLine(ready([water(0, 0), { athlete_id: A, logged_date: today, kost_done_at: '' }, water(-9, 2000)]), today), null)
  assert.equal(dayWaterKostLine({ state: 'missing', rows: [] }, today), null)
  assert.equal(dayWaterKostLine({ state: 'error', rows: [] }, today), null)
  assert.equal(dayWaterKostLine(null, today), null)
  assert.equal(dayWaterKostLine(undefined, today), null)
})

test('samme tal som coachens linje for samme rækker', () => {
  const rows = [...fiveWater, ...fourKost, { athlete_id: A, logged_date: d(-2), sleep_quality: 4, pain: 2 }]
  const coach = dayNumbersLine(rows, today)
  const own = dayWaterKostLine(ready(rows), today)
  assert.match(coach, /Væske 2,1 l i snit \(5 dage\) · Kostvane 4 af 7 dage · sidste 7 dage$/)
  assert.ok(coach.endsWith(own), `${coach} slutter ikke med ${own}`)
  assert.doesNotMatch(own, /Søvn|Smerte/)
})

test('7 dage i Europe/Copenhagen omkring midnat', () => {
  // 23:30 UTC den 17. nov. er 00:30 den 18. nov. i København.
  const day = calendarDay('2026-11-17T23:30:00Z')
  assert.equal(day, '2026-11-18')
  const rows = [water(-6, 3000), water(-7, 1000)]
  assert.equal(dayWaterKostLine(ready(rows), day), 'Væske 3,0 l i snit (1 dag) · sidste 7 dage', 'dag -6 tæller, dag -7 gør ikke')
  assert.equal(dayWaterKostLine(ready([water(1, 2000)]), day), null, 'i morgen tæller ikke')
})

test('læsning fra readDaily: klar, missing og fejl', async () => {
  const from = d(-6)
  const ok = fakeBackend({ tables: { tracking_daily_v1: [...fiveWater, ...fourKost, { athlete_id: 'andre', logged_date: today, water_ml: 9000 }] } })
  const got = await readDaily({ client: ok.client, athleteId: A, from, to: today })
  assert.equal(dayWaterKostLine(got, today), 'Væske 2,1 l i snit (5 dage) · Kostvane 4 af 7 dage · sidste 7 dage')
  const missing = fakeBackend({ missing: ['tracking_daily_v1'] })
  assert.equal(dayWaterKostLine(await readDaily({ client: missing.client, athleteId: A, from, to: today }), today), null)
  const broken = { from: () => { throw new Error('syntetisk') } }
  assert.equal(dayWaterKostLine(await readDaily({ client: broken, athleteId: A, from, to: today }), today), null)
})

const base = { today, athlete: { id: A }, data: { weeks: { state: 'ready', rows: [] }, logs: { state: 'ready', rows: [] }, meals: { state: 'ready', rows: [] }, readiness: { state: 'ready', rows: [] } } }

test('modellen bærer dayLine uden at røre linjer og fokus', () => {
  const without = athleteWeekCardModel(base)
  const withDaily = athleteWeekCardModel({ ...base, daily: ready([...fiveWater, ...fourKost]) })
  assert.equal(without.dayLine, null)
  assert.match(withDaily.dayLine, /^Væske 2,1 l/)
  assert.deepEqual({ ...withDaily, dayLine: null }, without)
  assert.equal(athleteWeekCardModel({ ...base, daily: { state: 'missing', rows: [] } }).dayLine, null)
})

test('visningen viser linjen kun med dayLine og ellers som før', () => {
  const model = { label: 'Min uge · 9. til 15. nov.', showCard: true, sentence: null, focus: null, strength: null,
    lines: [{ key: 'training', label: 'Træning', text: '2 af 2 pas', done: 2, planned: 2 }] }
  const before = render(h(AthleteWeekCardView, { model }))
  const html = render(h(AthleteWeekCardView, { model: { ...model, dayLine: 'Væske 2,1 l i snit (5 dage) · Kostvane 4 af 7 dage · sidste 7 dage' } }))
  assert.match(html, /data-u3-day-line="true"[^>]*>Væske 2,1 l i snit \(5 dage\) · Kostvane 4 af 7 dage · sidste 7 dage</)
  assert.doesNotMatch(before, /data-u3-day-line/)
  assert.equal(render(h(AthleteWeekCardView, { model: { ...model, dayLine: null } })), before)
})
