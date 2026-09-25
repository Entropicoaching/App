// ORDRE 377 · appens coach-prioritet i samme raekkefoelge som Coach
// Briefing-mailen (ORDRE 370). De syntetiske atlet-uger fra
// test/fixtures/briefing/ koeres gennem detectSignalsV2 og ind i
// buildCoachPriorityItems i samme form som entropi_training_signals leverer
// (o_*-felter). Ingen rigtige atletdata.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtures } from '../test/fixtures/briefing/index.mjs'
import { briefingOrder, detectSignalsV2 } from './coachBriefingRules.js'
import { AUTOMATION_RANK, buildCoachPriorityItems } from './coachPriority.js'

const allFixtures = Object.values(fixtures)
const athletes = allFixtures.map(fixture => fixture.athlete)
const signals = allFixtures.flatMap(fixture => detectSignalsV2(fixture))
const asRow = signal => ({
  o_athlete_id: signal.athlete_id, o_detector: signal.detector, o_severity: signal.severity,
  o_headline: signal.headline, o_detail: signal.detail,
})
const build = (overrides = {}) => buildCoachPriorityItems({
  athletes, trainingSignals: signals.map(asRow),
  unreadByTrack: {}, latestByTrack: {}, videoReviewQueue: [], describeVideo: () => 'Video',
  ...overrides,
})
const signalKeys = items => items.filter(item => item.kind === 'signal').map(item => `${item.athlete.name}:${item.signal.o_detector}`)

test('fixturerne giver signaler fra alle fem rang-grupper', () => {
  const detectors = new Set(signals.map(signal => signal.detector))
  for (const detector of ['pain', 'missed_sessions', 'rpe_drift', 'stagnation', 'data_conflict', 'pr']) {
    assert.ok(detectors.has(detector), `ingen fixture giver ${detector}`)
  }
})

test('smerte, fravaer, afvigelse fra plan, fremgang: samme raekkefoelge som mailen', () => {
  const expected = briefingOrder(signals).map(signal => `${signal.athlete_name}:${signal.detector}`)
  assert.deepEqual(signalKeys(build()), expected)
  assert.deepEqual(signalKeys(build({ trainingSignals: [...signals].reverse().map(asRow) })), expected,
    'raekkefoelgen maa ikke afhaenge af kildens raekkefoelge')
})

test('smerte (C) foerst, fravaer (D) foer afvigelse, PR (E) sidst', () => {
  const keys = signalKeys(build())
  assert.equal(keys[0], 'Atlet C:pain')
  assert.ok(keys.indexOf('Atlet D:missed_sessions') < keys.indexOf('Atlet A:stagnation'))
  assert.ok(keys.indexOf('Atlet D:missed_sessions') < keys.indexOf('Atlet B:rpe_drift'))
  assert.equal(keys.at(-1), 'Atlet E:pr')
})

test('beskeder og videoer staar mellem afvigelse fra plan og fremgang, som i mailen', () => {
  const items = build({
    unreadByTrack: { 'syn-f': { besked: 1 } },
    latestByTrack: { 'syn-f': { besked: { content: 'Hej coach', created_at: '2026-09-24T08:00:00Z' } } },
    videoReviewQueue: [{ id: 'v1', athlete_id: 'syn-f', created_at: '2026-09-23T08:00:00Z' }],
  })
  const kinds = items.map(item => (item.kind === 'signal' ? item.signal.o_detector : item.kind))
  const lastDeviation = Math.max(kinds.lastIndexOf('rpe_drift'), kinds.lastIndexOf('stagnation'), kinds.lastIndexOf('data_conflict'))
  assert.deepEqual(kinds.slice(lastDeviation + 1), ['video', 'message', 'pr'], 'aeldste video/besked foerst, PR til sidst')
})

test('inden for samme rang: alert foer context', () => {
  const items = buildCoachPriorityItems({
    athletes: [{ id: 'x', name: 'Atlet X' }, { id: 'y', name: 'Atlet Y' }],
    trainingSignals: [
      { o_athlete_id: 'x', o_detector: 'stagnation', o_severity: 'context', o_headline: 'X', o_detail: '' },
      { o_athlete_id: 'y', o_detector: 'rpe_drift', o_severity: 'alert', o_headline: 'Y', o_detail: '' },
      { o_athlete_id: 'x', o_detector: 'dropout', o_severity: 'context', o_headline: 'X', o_detail: '' },
      { o_athlete_id: 'y', o_detector: 'pain', o_severity: 'context', o_headline: 'Y', o_detail: '' },
    ],
    unreadByTrack: {}, latestByTrack: {}, videoReviewQueue: [], describeVideo: () => '',
  })
  assert.deepEqual(items.map(item => item.key), [
    'signal-y-pain', 'signal-x-dropout', 'signal-y-rpe_drift', 'signal-x-stagnation',
  ])
})

test('en automatiseringsfejl staar efter beskeder/videoer og foer fremgang', () => {
  const items = build({
    automationAlerts: [{ id: 'a1', workflow_name: 'Coach Briefing', occurred_at: '2026-09-25T06:00:00Z', resolved_at: null }],
    now: Date.parse('2026-09-25T08:00:00Z'),
  })
  const index = items.findIndex(item => item.kind === 'automation')
  assert.ok(index > 0, 'automatiseringsfejlen mangler')
  assert.equal(items[index].rank, AUTOMATION_RANK)
  assert.equal(items[index + 1]?.signal?.o_detector, 'pr')
  assert.ok(items.slice(0, index).every(item => item.rank < AUTOMATION_RANK))
})
