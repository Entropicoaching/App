// Ordre 1545: stilstand med et sprunget eller fejlet saet giver "Spoerg atleten foerst" (Marcs dom
// V-STILSTAND-SPRUNGET 8. okt.); uden giver alert "Overvej deload" uden oevelsesnavne (V-STILSTAND-FORSLAG).
// Kun syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { buildAthlete } from '../../../test/fixtures/briefing/helpers.mjs'
import { fixtures } from '../../../test/fixtures/briefing/index.mjs'
import { detectSignalsV2, stilstandUdeSaet, STILSTAND_OVERVEJ } from '../../coachBriefingRules.js'
import { stagnationReason, attentionCandidates } from './coachAttention.mjs'
import { readCoachAttention, attentionFor } from './coachAttentionRead.mjs'
import { fakeU3Client } from '../u3/fakeU3Client.mjs'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { coachHomeModel } from './coachModel.mjs'
import { CoachView } from './CoachScreen.mjs'

// Squat paa pas 1; top i uge 4 (indeks 3), derefter 3 uger uden ny top. extra(w) tilfoejer saet.
const squat = (tops, extra = () => []) => buildAthlete({
  id: 'syn-s', name: 'Atlet S',
  session: (w, p) => (p === 0 && tops[w] ? [{ name: 'Squat', weight: tops[w], reps: 5, rpe_planned: 8, rpe_actual: 8 }, ...extra(w)] : []),
})
const FLAT = [100, 110, 120, 130, 130, 130, 130]
const stagnation = fixture => detectSignalsV2(fixture).filter(s => s.detector === 'stagnation')

test('stilstand plus 1 sprunget saet: "Spørg atleten først" med kort grund', () => {
  const [s] = stagnation(squat(FLAT, w => (w === 5 ? [{ name: 'Squat', weight: 130, reps: 5, skipped: true }] : [])))
  assert.equal(s.detail, 'Spørg atleten først: 1 sprunget sæt i uge 6')
  assert.equal(s.metrics.action, s.detail)
  assert.equal(s.metrics.skipped_sets, 1)
})

test('stilstand plus 1 fejlet tungt saet (0 reps): samme regel', () => {
  const [s] = stagnation(squat(FLAT, w => (w === 6 ? [{ name: 'Squat', weight: 135, reps: 0 }] : [])))
  assert.equal(s.detail, 'Spørg atleten først: 1 fejlet sæt i uge 7')
  assert.equal(s.metrics.failed_sets, 1)
})

test('flere uger og begge slags: taelles og naevnes kort', () => {
  const [s] = stagnation(squat(FLAT, w => (w === 4 ? [{ name: 'Squat', weight: 130, reps: 5, skipped: true }]
    : w === 6 ? [{ name: 'Squat', weight: 130, reps: 5, skipped: true }, { name: 'Squat', weight: 135, reps: 0 }] : [])))
  assert.equal(s.detail, 'Spørg atleten først: 2 sprungne sæt og 1 fejlet sæt i uge 5 og 7')
})

test('stilstand uden sprungne eller fejlede saet: alert siger "Overvej deload" uden oevelsesnavne', () => {
  const [s] = stagnation(fixtures.a)
  assert.equal(s.severity, 'alert')
  assert.equal(s.detail, STILSTAND_OVERVEJ)
  assert.doesNotMatch(s.detail, /variation|pause|tempo|squat/i)
  // Fladt uden stigende RPE: uaendret tekst (ikke akut).
  const [flat] = stagnation(squat(FLAT))
  assert.equal(flat.severity, 'context')
  assert.doesNotMatch(flat.detail, /Spørg atleten/)
})

test('ingen stilstand giver intet, heller ikke med et sprunget saet', () => {
  assert.deepEqual(stagnation(squat([100, 105, 110, 115, 120, 125, 130], w => (w === 5 ? [{ name: 'Squat', weight: 125, reps: 5, skipped: true }] : []))), [])
})

test('sprunget foer toppen, paa et andet loeft eller paa et let saet taeller ikke', () => {
  const [s] = stagnation(squat(FLAT, w => (w === 2 ? [{ name: 'Squat', weight: 120, reps: 5, skipped: true }]
    : w === 5 ? [{ name: 'Bænkpres', weight: 80, reps: 5, skipped: true }, { name: 'Squat backoff', weight: 100, reps: 5, skipped: true }] : [])))
  assert.doesNotMatch(s.detail, /Spørg atleten/)
})

test('perioden er den samme serie som stilstanden: tal fra stilstandUdeSaet direkte', () => {
  const logs = [0, 1, 2, 3].map(w => ({ name: 'Squat', logged_at: `2026-10-${String(5 + 7 * w).padStart(2, '0')}T10:00:00Z`, weight: 130, reps_completed: 5, skipped: false }))
  logs.push({ name: 'Squat', logged_at: '2026-10-20T10:00:00Z', weight: 130, reps_completed: null, skipped: true, week_number: 3 })
  assert.deepEqual(stilstandUdeSaet(logs, 'Squat', 3), { sprunget: 1, fejlet: 0, uger: [3], grund: '1 sprunget sæt i uge 3' })
  assert.equal(stilstandUdeSaet(logs, 'Squat', 1), null, 'kun den sidste uge: det sprungne saet ligger foer')
  assert.equal(stilstandUdeSaet(logs, 'Bænk', 3), null)
})

// Forsiden: RPC-raekken fra briefingens SQL plus loeftets saet (indlejret som i Supabase).
const rpcRow = (severity, stalled = 3) => ({ o_athlete_id: athleteId, o_athlete_name: 'Atlet S', o_detector: 'stagnation', o_severity: severity,
  o_headline: 'Atlet S: Squat stået stille', o_detail: 'gammel tekst', o_metrics: { lift: 'Squat', stalled_weeks: stalled } })
const nested = (date, extra = {}, week = 45) => ({ athlete_id: athleteId, logged_at: `${date}T10:00:00Z`, weight: 130, reps_completed: 5, skipped: false,
  exercises: { name: 'Squat', session_id: `s-${date}`, sessions: { weeks: { week_number: week, block_name: 'Opbygning' } } }, ...extra })
const HEAVY = [['2026-10-06', 42], ['2026-10-13', 43], ['2026-10-20', 44], ['2026-10-27', 45]].map(([d, w]) => nested(d, {}, w))

test('forsiden: grunden er kort og siger "Spørg atleten først"', () => {
  const logs = [...HEAVY, nested('2026-10-28', { skipped: true, reps_completed: null }, 45)]
  assert.deepEqual(stagnationReason({ signal: rpcRow('context'), logs }), { reason: 'Spørg atleten først (squat står stille, 1 sprunget sæt i uge 45)' })
  assert.deepEqual(stagnationReason({ signal: rpcRow('alert'), logs: HEAVY }), { reason: 'Squat står stille 3 uger: overvej deload' })
  assert.equal(stagnationReason({ signal: rpcRow('context'), logs: HEAVY }), null, 'ikke akut: ingen grund paa forsiden')
  assert.equal(stagnationReason({ signal: rpcRow('alert'), logs: null }), null, 'ukendte saet: hellere intet end et forkert forslag')
  assert.equal(stagnationReason({ signal: rpcRow('alert', 2), logs: HEAVY }), null, 'under 3 uger er ikke stilstand')
})

test('forsiden: kandidaten faar rang 2 og staar i Kræver dit blik uden at gentage grunden', () => {
  const logs = [...HEAVY, nested('2026-10-29', { reps_completed: 0 }, 45)]
  const athlete = { id: athleteId, name: 'Atlet S' }
  const [c] = attentionCandidates({ athlete, day, attention: { readiness: [], notes: [], stagnation: { signal: rpcRow('alert'), logs } } })
  assert.equal(c.rank, 2)
  assert.equal(c.reason, 'Spørg atleten først (squat står stille, 1 fejlet sæt i uge 45)')
  const p = productionFixture()
  p.u3Data = true
  p.calendarWeeks[athleteId] = ['2026-11-02', '2026-11-09', '2026-11-16'].map((start_date, i) => ({ start_date, week_number: 45 + i, session_count: 1, exercise_count: 1 }))
  p.u3Attention = { day, ids: [athleteId], complete: true, readiness: [], notes: [], stagnation: { [athleteId]: { signal: rpcRow('alert'), logs } } }
  const row = coachHomeModel(p, day).actions.find(r => r.athlete.id === athleteId)
  assert.ok(row.reasons.includes(c.reason))
  const html = render(h(CoachView, { ...p, today: day }))
  assert.equal(html.split('pørg atleten først').length - 1, 1, 'grunden staar én gang')
})

test('L1-laesningen: RPC og saet hentes; fejl i stilstand roerer ikke resten', async () => {
  const withRpc = (tables, rpc) => {
    const client = fakeU3Client(tables)
    const from = client.from.bind(client)
    client.from = table => { const b = from(table); b.or = () => b; return b }
    client.rpc = rpc
    return client
  }
  const logs = [...HEAVY, nested('2026-10-28', { skipped: true, reps_completed: null }, 45)]
  const ok = await readCoachAttention(withRpc({ exercise_logs: logs, readiness_logs: [] }, async () => ({ data: [rpcRow('alert'), { ...rpcRow('ok'), o_athlete_id: 'andre' }], error: null })), [athleteId], day)
  assert.equal(ok.complete, true)
  assert.equal(attentionFor(ok, athleteId, day).stagnation.logs.length, logs.length)
  const failed = await readCoachAttention(withRpc({ exercise_logs: [], readiness_logs: [] }, async () => ({ data: null, error: { message: 'syntetisk' } })), [athleteId], day)
  assert.equal(failed.complete, true)
  assert.equal(attentionFor(failed, athleteId, day).stagnation, undefined)
  const noRpc = await readCoachAttention(fakeU3Client({ exercise_logs: [], readiness_logs: [] }), [athleteId], day)
  assert.equal(noRpc.stagnation, undefined)
})
