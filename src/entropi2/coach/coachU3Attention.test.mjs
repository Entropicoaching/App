// U3 commit 4: coachens nye grunde og L1. Fejler på commit 3, fordi modulerne mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { coachHomeModel } from './coachModel.mjs'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import { readinessDrop, checkinStopped, ATTENTION_UNAVAILABLE } from './coachAttention.mjs'
import { readCoachAttention, startAttentionRefresh, L1_CAPS } from './coachAttentionRead.mjs'
import { fakeU3Client } from '../u3/fakeU3Client.mjs'

// day = 2026-11-03 (tirsdag). Indeværende uge starter 2026-11-02.
const NOTE = 'Syntetisk: det gjorde ondt i knæet på sidste sæt'
function fixture({ notes = [], readiness = [], voices = null, protein = 120, u3 = true, complete = true } = {}) {
  const p = productionFixture()
  p.coachNutrition.rows = p.coachNutrition.rows.map(r => ({ ...r, protein }))
  // Tre programuger frem, så "Programmet slutter" ikke blander sig i prøverne.
  const future = ['2026-11-02', '2026-11-09', '2026-11-16'].map((start_date, i) => ({ start_date, week_number: 45 + i, session_count: 1, exercise_count: 1 }))
  p.calendarWeeks[athleteId] = [...(voices ?? []), ...future.filter(f => !voices?.some(v => v.start_date === f.start_date))]
  if (u3) p.u3Data = true
  p.u3Attention = { day, ids: [athleteId], complete, readiness: complete ? readiness : null, notes: complete ? notes : null }
  return p
}
const reasons = p => coachHomeModel(p, day).actions.find(r => r.athlete.id === athleteId)?.reasons ?? []
const row = p => coachHomeModel(p, day).actions.find(r => r.athlete.id === athleteId)
const readiness = (offset, score, soreness = 2) => ({ athlete_id: athleteId, logged_date: addCalendarDays(day, -offset), readiness_score: score, soreness_level: soreness })

test('smerte i en note giver rang 0 med dato, "ingen smerter" giver ingen række', () => {
  const pain = row(fixture({ notes: [{ athlete_id: athleteId, logged_at: '2026-10-29T17:00:00Z', note: NOTE }] }))
  assert.equal(pain.rank, 0)
  assert.equal(pain.reason, 'Smerte nævnt 29. okt.')
  assert.equal(row(fixture({ notes: [{ athlete_id: athleteId, logged_at: '2026-10-29T17:00:00Z', note: 'ingen smerter i dag' }] })), undefined)
  // En note ældre end 14 dage tæller ikke.
  assert.equal(row(fixture({ notes: [{ athlete_id: athleteId, logged_at: '2026-10-18T17:00:00Z', note: NOTE }] })), undefined)
})

test('smerte i en pas-kommentar tæller i ugen fra mandag minus 7, ikke minus 14', () => {
  const week = start => [{ start_date: start, week_number: 44, session_count: 1, exercise_count: 1,
    session_voices: [{ order: 1, rating: 3, comment: 'Syntetisk: smerter i skulderen' }] }]
  assert.equal(row(fixture({ voices: week('2026-10-26') }))?.reason, 'Smerte nævnt i uge 44')
  assert.equal(row(fixture({ voices: week('2026-10-19') })), undefined)
})

test('ømhed 4 på 2 af 7 dage giver intet, på 3 af 7 dage en række', () => {
  const two = [readiness(1, 70, 4), readiness(2, 70, 4), readiness(3, 70, 2)]
  assert.equal(row(fixture({ readiness: two })), undefined)
  const three = [readiness(1, 70, 4), readiness(2, 70, 4), readiness(5, 70, 5)]
  assert.equal(row(fixture({ readiness: three })).reason, 'Ømhed 3 af 7 dage')
  // Dagen i dag tæller ikke.
  assert.equal(row(fixture({ readiness: [readiness(0, 70, 5), readiness(1, 70, 4), readiness(2, 70, 4)] })), undefined)
})

test('readinessDrop kræver 10 historikdage og et fald over tærsklen', () => {
  const recent = [readiness(1, 55), readiness(2, 56), readiness(3, 54)]
  const history = n => Array.from({ length: n }, (_, i) => readiness(4 + i, i % 2 ? 72 : 68))
  assert.equal(readinessDrop([...recent, ...history(9)], day), null)
  assert.ok(readinessDrop([...recent, ...history(10)], day))
  assert.equal(readinessDrop([readiness(1, 69), readiness(2, 69), readiness(3, 69), ...history(10)], day), null)
  const r = row(fixture({ readiness: [...recent, ...history(10)] }))
  assert.equal(r.rank, 1)
  assert.equal(r.reason, 'Readiness falder')
})

test('check-in stoppet springer atleter på ferie over', () => {
  const before = Array.from({ length: 8 }, (_, i) => readiness(8 + i * 2, 70))
  assert.ok(checkinStopped(before, day, { id: athleteId }))
  assert.equal(checkinStopped(before, day, { id: athleteId, status: 'ferie' }), null)
  assert.equal(checkinStopped(before, day, { id: athleteId, vacation_until: '2026-11-20' }), null)
  assert.equal(checkinStopped(before.slice(0, 7), day, { id: athleteId }), null)
  const p = fixture({ readiness: before })
  assert.equal(row(p).reason, 'Check-in stoppet')
  assert.equal(row(p).rank, 2)
  p.athletes[0].vacation_until = '2026-11-20'
  assert.equal(row(p), undefined)
})

test('flere grunde: højeste er titlen, de øvrige står som "Også"', () => {
  const p = fixture({ protein: 50, notes: [{ athlete_id: athleteId, logged_at: '2026-11-02T17:00:00Z', note: NOTE }],
    readiness: Array.from({ length: 8 }, (_, i) => readiness(8 + i * 2, 70)) })
  assert.deepEqual(reasons(p), ['Smerte nævnt 2. nov.', 'Check-in stoppet', 'Protein under målet'])
  const html = render(h(CoachView, { ...p, today: day }))
  assert.match(html, /Også: check-in stoppet, protein under målet/)
})

test('L1 med nået loft: ingen nye grunde, C1 og C3 vises stadig, beskeden står én gang', () => {
  const p = fixture({ complete: false, protein: 50 })
  p.coachMorningData.messages.rows = []
  p.calendarWeeks[athleteId] = [{ start_date: '2026-10-27', week_number: 9, session_count: 1, exercise_count: 1,
    session_voices: [{ order: 1, comment: 'Syntetisk: smerter' }] }]
  const model = coachHomeModel(p, day)
  const r = model.actions.find(a => a.athlete.id === athleteId)
  // Programmet slutter (C3) vises stadig; smerte vises ikke; protein afhænger kun af kostkilden.
  assert.ok(r.reasons.some(x => /Programmet/.test(x)))
  assert.ok(!r.reasons.some(x => /Smerte/.test(x)))
  assert.ok(r.reasons.includes('Protein under målet'))
  const html = render(h(CoachView, { ...p, today: day }))
  assert.equal(html.split(ATTENTION_UNAVAILABLE).length - 1, 1)
})

test('L1 følger R2: loft plus 1 gør læsningen ufuldstændig', async () => {
  const rows = Array.from({ length: L1_CAPS.notes + 1 }, (_, i) => ({ athlete_id: athleteId, logged_at: `2026-11-0${1 + (i % 2)}T10:00:00Z`, note: 'ok' }))
  const over = await readCoachAttention(fakeU3Client({ exercise_logs: rows, readiness_logs: [] }), [athleteId], day)
  assert.equal(over.complete, false)
  const ok = await readCoachAttention(fakeU3Client({ exercise_logs: rows.slice(1), readiness_logs: [] }), [athleteId], day)
  assert.equal(ok.complete, true)
  const failed = await readCoachAttention(fakeU3Client({}, { fail: new Set(['readiness_logs']) }), [athleteId], day)
  assert.equal(failed.complete, false)
})

test('notens tekst findes aldrig i DOM', () => {
  const p = fixture({ notes: [{ athlete_id: athleteId, logged_at: '2026-11-02T17:00:00Z', note: NOTE }],
    voices: [{ start_date: '2026-11-02', week_number: 45, session_count: 1, exercise_count: 1, session_voices: [{ order: 1, comment: 'Syntetisk: hoften gør ondt' }] }] })
  const html = render(h(CoachView, { ...p, today: day }))
  assert.match(html, /Smerte nævnt 2. nov./)
  assert.doesNotMatch(html, /knæet|hoften|gjorde ondt|gør ondt/)
})

test('hooken henter igen efter 60 sekunder og ved fokus, og et forældet svar kasseres', async () => {
  const listeners = {}, timers = { fns: [], setInterval(fn) { this.fns.push(fn); return 1 }, clearInterval() { this.fns = [] } }
  const target = { addEventListener(type, fn) { listeners[type] = fn }, removeEventListener(type) { delete listeners[type] } }
  const doc = { ...target, visibilityState: 'visible' }
  const win = { addEventListener(type, fn) { listeners['win:' + type] = fn }, removeEventListener(type) { delete listeners['win:' + type] } }
  let calls = 0
  const gates = []
  const load = () => { calls++; return new Promise(resolve => gates.push(resolve)) }
  const seen = []
  const control = startAttentionRefresh(load, r => seen.push(r), { doc, win, timers })
  assert.equal(calls, 1)
  timers.fns[0]() // singleflight: intet nyt kald, mens det første er i gang
  assert.equal(calls, 1)
  gates[0]('første'); await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(seen, ['første'])
  timers.fns[0](); assert.equal(calls, 2) // 60 sekunder
  gates[1]('anden'); await new Promise(r => setTimeout(r, 0))
  listeners['win:focus'](); assert.equal(calls, 3) // fokus
  doc.visibilityState = 'hidden'; timers.fns[0](); assert.equal(calls, 3)
  control.stop()
  gates[2]('forældet'); await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(seen, ['første', 'anden'])
})

test('med flaget slukket sker ingen L1-læsning og ingen nye grunde', () => {
  const client = fakeU3Client({})
  const off = fixture({ u3: false, protein: 50, readiness: Array.from({ length: 8 }, (_, i) => readiness(8 + i * 2, 70)) })
  off.notesClient = client
  assert.equal(row(off), undefined)
  const html = render(h(CoachScreen, off))
  assert.doesNotMatch(html, /Check-in stoppet|Protein under målet|Også:/)
  assert.equal(client.calls.length, 0)
})
