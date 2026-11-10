// U3 commit 5: blok for blok og L3. Fejler på commit 4, fordi modulerne mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../../calendarDate.js'
import { blocksModel, AMBIGUOUS } from './blocksModel.mjs'
import { BlocksTable, blocksFromRead } from './BlocksView.mjs'
import { readBlocks, L3_CAPS } from './readBlocks.mjs'
import { fakeU3Client } from '../../u3/fakeU3Client.mjs'
import { productionFixture, day as coachDay, athleteId } from '../../coach/coachProductionFixture.mjs'
import { CoachView } from '../../coach/CoachScreen.mjs'
import Analysis from '../Analysis.mjs'

const today = '2026-11-17'
const now = new Date(`${today}T12:00:00Z`)
const week = (n, start, block, sq) => ({ id: `w${n}`, week_number: n, start_date: start, block_name: block, athlete_id: 'atlet-a',
  sessions: [{ id: `s${n}`, exercises: [{ id: sq, name: 'Squat', sets: 1 }] }] })
const twoBlocks = (second = 'Styrke 3') => [
  week(1, '2026-10-12', 'Styrke 2', 'a-sq1'), week(2, '2026-10-19', 'Styrke 2', 'a-sq2'), week(3, '2026-10-26', 'Styrke 2', 'a-sq3'),
  week(4, '2026-11-02', second, 'b-sq1'), week(5, '2026-11-09', second, 'b-sq2')]
const set = (exercise_id, day, weight, reps) => ({ exercise_id, set_number: 1, logged_at: `${day}T10:00:00Z`, weight, reps_completed: reps, skipped: false })

test('et hul på 14 dage mellem uger giver "ikke entydig"', () => {
  const m = blocksModel({ weeks: [week(1, '2026-10-12', 'Styrke 2', 'x1'), week(2, '2026-10-26', 'Styrke 2', 'x2')], logs: [], today, now })
  assert.equal(m.status, 'ambiguous')
  assert.equal(m.message, AMBIGUOUS)
  assert.match(render(h(BlocksTable, { model: m })), /Blokkenes rækkefølge er ikke entydig/)
  assert.doesNotMatch(render(h(BlocksTable, { model: m })), /<table/)
})

test('et sæt tilskrives blokken via exercise_id, ikke via dato', () => {
  const logs = [set('a-sq1', '2026-10-13', 100, 5), set('a-sq3', '2026-11-04', 120, 3), // logget sent, men hører til Styrke 2
    set('b-sq1', '2026-10-14', 110, 3), set('b-sq2', '2026-11-10', 110, 3)]
  const m = blocksModel({ weeks: twoBlocks(), logs, today, now })
  const [a, b] = m.blocks
  assert.equal(Math.round(a.lifts.squat), 132)
  assert.equal(Math.round(b.lifts.squat), 121)
  assert.equal(Math.round(b.changes.squat), -11)
  assert.match(render(h(BlocksTable, { model: m })), /121 ↓11/)
})

test('en deloadblok giver ingen styrketal', () => {
  const logs = [set('b-sq1', '2026-11-03', 100, 3), set('b-sq2', '2026-11-10', 100, 3)]
  const m = blocksModel({ weeks: twoBlocks('Deload'), logs, today, now })
  const deload = m.blocks.at(-1)
  assert.equal(deload.light, true)
  assert.deepEqual(deload.lifts, {})
  assert.match(render(h(BlocksTable, { model: m })), /let blok/)
})

test('en blok med 1 afsluttet uge får ingen tal', () => {
  const weeks = [week(1, '2026-11-02', 'Styrke 3', 'x1'), week(2, '2026-11-09', 'Styrke 3', 'x2'), week(3, '2026-11-16', 'Styrke 4', 'x3')]
  const m = blocksModel({ weeks, logs: [set('x3', '2026-11-16', 100, 3)], today, now, weights: [], readiness: [] })
  const current = m.blocks.at(-1)
  assert.equal(current.completedWeeks, 0)
  assert.equal(current.enough, false)
  const one = blocksModel({ weeks: weeks.slice(0, 2), logs: [], today: '2026-11-12', now })
  assert.equal(one.blocks[0].completedWeeks, 1)
  assert.equal(one.blocks[0].enough, false)
  assert.match(render(h(BlocksTable, { model: one })), /ikke nok data/)
  assert.doesNotMatch(render(h(BlocksTable, { model: one })), />0</)
})

test('med kun én blok vises kun den aktuelle blok uden pile', () => {
  const weeks = [week(1, '2026-10-26', 'Styrke 3', 'x1'), week(2, '2026-11-02', 'Styrke 3', 'x2'), week(3, '2026-11-09', 'Styrke 3', 'x3')]
  const m = blocksModel({ weeks, logs: [set('x1', '2026-10-27', 100, 3), set('x2', '2026-11-03', 105, 3)], today, now })
  assert.equal(m.blocks.length, 1)
  assert.equal(m.single, true)
  const html = render(h(BlocksTable, { model: m }))
  assert.match(html, />Nu</)
  assert.doesNotMatch(html, /[↑↓→]/)
})

test('L3 læser sider af 1000 og gør logs ukendte over 5000 rækker', async () => {
  const weeks = twoBlocks()
  const rows = Array.from({ length: L3_CAPS.logs + 1 }, (_, i) => ({ ...set('a-sq1', '2026-10-13', 100, 3), set_number: i + 1, athlete_id: 'atlet-a' }))
  const client = fakeU3Client({ weeks, exercise_logs: rows, weight_logs: [], readiness_logs: [] })
  const over = await readBlocks(client, 'atlet-a', today)
  assert.equal(over.logs.state, 'unknown')
  assert.equal(over.meals, null)
  assert.ok(client.calls.filter(c => c.table === 'exercise_logs').every(c => c.range && c.range[1] - c.range[0] < L3_CAPS.logPage))
  const ok = await readBlocks(fakeU3Client({ weeks, exercise_logs: rows.slice(1), weight_logs: [], readiness_logs: [] }), 'atlet-a', today)
  assert.equal(ok.logs.state, 'ready')
  assert.equal(ok.logs.rows.length, L3_CAPS.logs)
  const model = blocksFromRead(over, now)
  assert.equal(model.blocks.every(b => Object.values(b.lifts).every(v => v === null)), true)
})

const coachProps = extra => ({ ...productionFixture(), today: coachDay, athletesOpen: true, u3Data: false, ...extra })
test('arbejdsrummet viser ikke folden uden klient eller med u3 falsk, og der sker ingen L3-læsning', () => {
  const client = fakeU3Client({})
  assert.doesNotMatch(render(h(CoachView, coachProps())), /Blok for blok/)
  assert.doesNotMatch(render(h(CoachView, coachProps({ notesClient: client }))), /Blok for blok/)
  assert.doesNotMatch(render(h(CoachView, coachProps({ u3Data: true }))), /Blok for blok/)
  const html = render(h(CoachView, coachProps({ u3Data: true, notesClient: client })))
  assert.match(html, new RegExp(`data-coach-athlete-workspace="${athleteId}"[\\s\\S]*Blok for blok`))
  assert.equal(client.calls.length, 0)
})

test('Fremgang har blok for blok nederst, kun med flaget og en klient', () => {
  const props = { entropi2: true, now, athlete: { id: 'atlet-a' }, currentWeek: { start_date: '2026-11-16', sessions: [] }, exerciseLogs: [], fremgangLogs: [] }
  const client = fakeU3Client({})
  assert.doesNotMatch(render(h(Analysis, { ...props, u3Client: client, u3Data: false })), /Blok for blok/)
  const html = render(h(Analysis, { ...props, u3Client: client, u3Data: true }))
  assert.match(html, /data-u3-blocks-fold="athlete"[\s\S]*Om datagrundlaget/)
  assert.equal(client.calls.length, 0)
})
