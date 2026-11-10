import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addCalendarDays } from '../../calendarDate.js'
import { heavyWeekSuggestion, heavyWeekFrom } from './heavyWeek.mjs'
import { readHeavyWeekLogs, HEAVY_WEEK_CAP } from './heavyWeekRead.mjs'
import { createDocument } from '../onboarding/firstVisitDom.mjs'

// Kun syntetiske data. day er en tirsdag; sidste afsluttede uge er 27. okt. til 1. nov.
const day = '2026-11-03'
const A = 'atlet-syntetisk-u6'
const readiness = (offset, score) => ({ athlete_id: A, logged_date: addCalendarDays(day, -offset), readiness_score: score, soreness_level: 2 })
const falling = [readiness(1, 55), readiness(2, 56), readiness(3, 54), ...Array.from({ length: 10 }, (_, i) => readiness(4 + i, i % 2 ? 72 : 68))]
const steady = [readiness(1, 70), readiness(2, 70), readiness(3, 70), ...Array.from({ length: 10 }, (_, i) => readiness(4 + i, i % 2 ? 72 : 68))]
// Ét sæt pr. uge med tonnage = vægt × 10 reps. Mandagene: 6., 13., 20. og 27. okt.
const week = (monday, kg, i) => ({ athlete_id: A, exercise_id: `ex-${i}`, set_number: 1, logged_at: `${monday}T10:00:00Z`, weight: kg, reps_completed: 10, skipped: false })
const logs = kgs => ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'].map((m, i) => week(m, kgs[i], i))

test('U6 3/5: readiness falder og sidste uge var tungere end snittet: forslag med tal og kilde', () => {
  const s = heavyWeekSuggestion({ readiness: falling, logs: logs([1000, 900, 1100, 1200]), day })
  assert.ok(s)
  assert.equal(s.text, 'Tung uge. Readiness 55 de sidste 3 dage mod 70 i ugerne før. Tonnage 12,0 t i sidste uge mod 10,0 t i snit de 3 uger før. ' +
    'Forslag: hæv kun vægten efter et konstruktivt sæt, og lad backoff ligge cirka 10 % under topsættet.')
})

test('U6 3/5: intet deload-forslag; Marcs udløsere kan ikke aflæses af readiness og tonnage', () => {
  const s = heavyWeekSuggestion({ readiness: falling, logs: logs([800, 900, 1000, 1200]), day })
  assert.ok(s)
  assert.doesNotMatch(s.text, /deload/)
})

test('U6 3/5: kun ét signal giver intet forslag', () => {
  assert.equal(heavyWeekSuggestion({ readiness: steady, logs: logs([1000, 900, 1100, 1200]), day }), null, 'readiness stabil')
  assert.equal(heavyWeekSuggestion({ readiness: falling, logs: logs([1000, 1000, 1000, 900]), day }), null, 'lettere uge')
  assert.equal(heavyWeekSuggestion({ readiness: falling, logs: logs([1000, 1000, 1000, 1000]), day }), null, 'samme som snittet')
  assert.equal(heavyWeekSuggestion({ readiness: falling, logs: [], day }), null, 'ingen log')
})

test('U6 3/5: kilderne til reglerne står i koden', () => {
  const source = readFileSync(new URL('./heavyWeek.mjs', import.meta.url), 'utf8')
  assert.match(source, /Marcs svar 10\. nov\. 2026 kl\. 16:41/)
  assert.match(source, /"hoved udgangspunkt er 10%"/)
  assert.match(source, /"ved et konstruktivt sæt hæves vægten næste uge, indtil deload"/)
  assert.match(source, /programregel 3 \(ja 3\. okt\. 2026/)
})

test('U6 3/5: læsningen er én atlet, fire uger tilbage, med loft', async () => {
  assert.equal(heavyWeekFrom(day), '2026-10-05')
  const calls = []
  const client = { from(name) { const q = { select(c) { calls.push(['select', name, c]); return q }, eq(k, v) { calls.push(['eq', k, v]); return q },
    gte(k, v) { calls.push(['gte', k, v]); return q }, order() { return q }, limit(n) { calls.push(['limit', n]); return Promise.resolve({ data: [], error: null }) } }; return q } }
  assert.deepEqual(await readHeavyWeekLogs({ client, athleteId: A, day }), [])
  assert.match(calls.find(c => c[0] === 'select')[2], /^id, /)
  assert.deepEqual(calls.filter(c => c[0] !== 'select'), [['eq', 'athlete_id', A], ['gte', 'logged_at', '2026-10-05T00:00:00Z'], ['limit', HEAVY_WEEK_CAP + 1]])
  const full = { from() { const q = { select: () => q, eq: () => q, gte: () => q, order: () => q, limit: () => Promise.resolve({ data: Array(HEAVY_WEEK_CAP + 1).fill({}), error: null }) }; return q } }
  assert.equal(await readHeavyWeekLogs({ client: full, athleteId: A, day }), null)
})

let React, act, createRoot, HeavyWeekLine, missing = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) ({ default: HeavyWeekLine } = await import('./HeavyWeekLine.mjs'))
const gate = { skip: missing ? 'Kræver ægte React.' : false }

test('U6 3/5: linjen læser kun, når readiness falder, og viser forslaget', gate, async () => {
  const doc = createDocument(), host = doc.createElement('div')
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(host), reads = []
  const read = async args => { reads.push(args.athleteId); return logs([1000, 900, 1100, 1200]) }
  try {
    await act(async () => root.render(React.createElement(HeavyWeekLine, { client: {}, athleteId: A, day, readiness: steady, read })))
    assert.deepEqual(reads, [])
    assert.equal(host.textContent, '')
    await act(async () => root.render(React.createElement(HeavyWeekLine, { client: {}, athleteId: A, day, readiness: falling, read })))
    await act(async () => new Promise(r => setTimeout(r, 0)))
    assert.deepEqual(reads, [A])
    assert.match(host.textContent, /^Tung uge\. Readiness 55/)
  } finally {
    await act(async () => root.unmount())
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete globalThis.window
  }
})

test('U6 3/5: coachens forside sætter linjen under rækken kun med flaget', gate, async () => {
  const { productionFixture, day: fixtureDay, athleteId } = await import('../coach/coachProductionFixture.mjs')
  const { CoachView } = await import('../coach/CoachScreen.mjs')
  const p = productionFixture()
  p.coachNutrition.rows = p.coachNutrition.rows.map(r => ({ ...r, protein: 120 }))
  p.calendarWeeks[athleteId] = ['2026-11-02', '2026-11-09', '2026-11-16'].map((start_date, i) => ({ start_date, week_number: 45 + i, session_count: 1, exercise_count: 1 }))
  const rows = falling.map(r => ({ ...r, athlete_id: athleteId, logged_date: addCalendarDays(fixtureDay, Math.round((Date.parse(r.logged_date) - Date.parse(day)) / 864e5)) }))
  Object.assign(p, { u3Data: true, u3Attention: { day: fixtureDay, ids: [athleteId], complete: true, readiness: rows, notes: [] },
    openProfile() {}, openCoachPriorityItem() {}, notesClient: {} })
  const find = (node, type) => !node || typeof node !== 'object' ? null : Array.isArray(node)
    ? node.map(n => find(n, type)).find(Boolean) ?? null : node.type === type ? node : find(node.props?.children, type)
  const props = { ...p, enabled: true, today: new Date(`${fixtureDay}T12:00:00Z`) }
  const line = find(CoachView({ ...props, u6HeavyWeek: true }), HeavyWeekLine)
  assert.ok(line)
  assert.equal(line.props.athleteId, athleteId)
  assert.equal(line.props.readiness.length, rows.length)
  assert.equal(find(CoachView({ ...props, u6HeavyWeek: false }), HeavyWeekLine), null)
})
