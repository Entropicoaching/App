// Ordre 2417: "Kræver dig i dag". Syntetiske atleter; sortering og hver regel.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { productionFixture, day } from './coachProductionFixture.mjs'
import { coachHomeModel, openCoachRow } from './coachModel.mjs'
import { CoachView } from './CoachScreen.mjs'
import { idagCandidates, idagRow, idagVisible, IDAG_MAX } from './coachIDag.mjs'

const NOTE = 'Syntetisk: det gjorde ondt i knæet på sidste sæt'
// Ro-uge: slutter om 5 dage. Uge der slutter inden for 2 dage starter 2026-10-30 (daysLeft 2), 3 dage 2026-10-31.
const calm = [{ start_date: '2026-11-02', session_count: 3, exercise_count: 1 }, { start_date: '2026-11-09', session_count: 3, exercise_count: 1 }]
const ends = start_date => [{ start_date, session_count: 3, exercise_count: 1 }]
const logOn = (id, daysAgo) => ({ id: `s-${id}-${daysAgo}`, athlete_id: id, logged_at: `${addCalendarDays(day, -daysAgo)}T10:00:00Z`, weight: 50, reps_completed: 5 })

// spec: { id, name, weeks, logAgo (dage siden seneste log), video, note }
function build(specs) {
  const p = productionFixture(), ids = specs.map(s => s.id)
  p.athletes = specs.map(s => ({ id: s.id, name: s.name ?? `Syntetisk ${s.id}` }))
  p.readContext = { ...p.readContext, athleteIds: ids }
  p.calendarWeeks = Object.fromEntries(specs.map(s => [s.id, s.weeks ?? calm]))
  p.coachActionsStatus = { calendar: 'ready', activity: { state: 'ready', day, ids, rows: specs.map(s => logOn(s.id, s.logAgo ?? 0)) } }
  p.coachMorningData = { messages: { state: 'ready', day, ids, rows: [] },
    videos: { state: 'ready', day, ids, rows: specs.filter(s => s.video).map(s => ({ id: `v-${s.id}`, athlete_id: s.id, status: 'draft', created_at: '2026-11-02T08:00:00Z' })) } }
  p.coachNutrition = { ...p.coachNutrition, athleteIds: ids, rows: [], targets: [] }
  p.u3Data = true
  p.u3Attention = { day, ids, complete: true, readiness: [],
    notes: specs.filter(s => s.note).map(s => ({ athlete_id: s.id, logged_at: '2026-10-29T17:00:00Z', note: NOTE })) }
  return p
}
const names = p => coachHomeModel(p, day).idag.map(r => r.athlete.id)

test('hver regel for sig: smerte, 3 dage uden log, video, programuge der slutter inden for 2 dage', () => {
  assert.deepEqual(names(build([{ id: 'a', note: true }])), ['a'])
  assert.deepEqual(names(build([{ id: 'a', logAgo: 3 }])), ['a'])
  assert.deepEqual(names(build([{ id: 'a', video: true }])), ['a'])
  assert.deepEqual(names(build([{ id: 'a', weeks: ends('2026-10-30') }])), ['a'])
  assert.deepEqual(names(build([{ id: 'a' }])), [])
})

test('grænserne: 2 dage uden log og en uge der slutter om 3 dage giver intet; udløbet hører til Mangler ny uge', () => {
  assert.deepEqual(names(build([{ id: 'a', logAgo: 2 }])), [])
  assert.deepEqual(names(build([{ id: 'a', weeks: ends('2026-10-31') }])), [])
  assert.deepEqual(names(build([{ id: 'a', weeks: ends('2026-10-28') }])), ['a'])
  assert.deepEqual(names(build([{ id: 'a', weeks: ends('2026-10-27') }])), [])
  const [row] = coachHomeModel(build([{ id: 'a', weeks: ends('2026-10-28') }]), day).idag
  assert.equal(row.reason, 'Programmet slutter i dag')
  assert.equal(coachHomeModel(build([{ id: 'a', weeks: ends('2026-10-30') }]), day).idag[0].reason, 'Programmet slutter om 2 dage')
})

test('sorteret efter hast: smerte, ingen log, video, uge; flest dage uden log først', () => {
  const p = build([
    { id: 'e', name: 'E', weeks: ends('2026-10-30') },
    { id: 'd', name: 'D', video: true },
    { id: 'c', name: 'C', logAgo: 3 },
    { id: 'b', name: 'B', logAgo: 5 },
    { id: 'a', name: 'A', note: true },
  ])
  assert.deepEqual(names(p), ['a', 'b', 'c', 'd', 'e'])
  assert.equal(coachHomeModel(p, day).idag.find(r => r.athlete.id === 'b').reason, 'Ingen log i 5 dage')
})

test('én række pr. atlet: den hasteste grund fører, resten kommer i reasons', () => {
  const p = build([{ id: 'a', note: true, logAgo: 4, video: true, weeks: ends('2026-10-30') }])
  const rows = coachHomeModel(p, day).idag
  assert.equal(rows.length, 1)
  assert.equal(rows[0].rank, 0)
  assert.equal(rows[0].reasons.length, 4)
  assert.match(rows[0].reasons[0], /^Smerte nævnt/)
  assert.ok(rows[0].reasons.includes('Ingen log i 4 dage'))
})

test('højst 5 rækker i listen, og hver række åbner atleten med ét tryk', () => {
  const specs = 'abcdefg'.split('').map(id => ({ id, logAgo: 3 + 'abcdefg'.indexOf(id) % 2 }))
  assert.equal(idagVisible(coachHomeModel(build(specs), day).idag).length, IDAG_MAX)
  const opened = []
  const model = coachHomeModel(build(specs), day)
  for (const row of model.idag) openCoachRow(row, { openProfile: (a, tab, view) => opened.push([a.id, tab, view]), openCoachPriorityItem() {} })
  assert.ok(opened.every(o => o[1] === 'log' && o[2] === 'list'))
  const html = render(h(CoachView, build(specs)))
  assert.equal((html.match(/data-coach-action="idag-log-/g) || []).length, 5)
  assert.match(html, /Kræver dig i dag/)
  assert.doesNotMatch(html, /Kræver dit blik/)
})

test('tom liste viser én rolig linje; en fejl i dataene viser ikke den', () => {
  const html = render(h(CoachView, build([{ id: 'a' }, { id: 'b' }])))
  assert.match(html, /Ingen kræver dig i dag\./)
  assert.equal((html.match(/data-coach-idag-tom/g) || []).length, 1)
  assert.equal((html.match(/data-coach-action="idag-/g) || []).length, 0)
})

test('ukendt aktivitet (læsefejl) giver ingen "Ingen log"-række', () => {
  const p = build([{ id: 'a', logAgo: 9 }])
  p.coachActionsStatus.activity = { state: 'error' }
  assert.deepEqual(names(p), [])
})

test('regelfunktionerne: kun fast tekst, ingen noter, kvitteret smerte vises ikke', () => {
  const athlete = { id: 'x', name: 'Syntetisk x' }
  assert.equal(idagRow(idagCandidates({ athlete })), null)
  assert.equal(idagRow(idagCandidates({ athlete, noLogDays: 2, daysLeft: 3 })), null)
  assert.equal(idagRow(idagCandidates({ athlete, noLogDays: 3 })).reason, 'Ingen log i 3 dage')
  const html = render(h(CoachView, build([{ id: 'a', note: true }])))
  assert.doesNotMatch(html, /gjorde ondt/)
})
