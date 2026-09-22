// ORDRE 325 · commit 2 — punkt-nøglens stabilitet. Se coachBriefingSeen.js
// for hvorfor beskeder har en dato-del, og video/signal ikke har.
import test from 'node:test'
import assert from 'node:assert/strict'
import { coachBriefingPointKey, coachBriefingSeenErrorMessage } from './coachBriefingSeen.js'

const athlete = { id: 'ath1' }

test('signal: stabil for samme atlet+detector, ny nøgle ved anden atlet eller detector', () => {
  const item = { kind: 'signal', athlete, signal: { o_detector: 'dropout' } }
  const key = coachBriefingPointKey(item)
  assert.equal(key, 'signal-ath1-dropout')
  assert.equal(coachBriefingPointKey({ ...item }), key, 'samme punkt to gange skal give samme nøgle')
  assert.notEqual(coachBriefingPointKey({ kind: 'signal', athlete: { id: 'ath2' }, signal: { o_detector: 'dropout' } }), key)
  assert.notEqual(coachBriefingPointKey({ kind: 'signal', athlete, signal: { o_detector: 'stagnation' } }), key)
})

test('video: stabil pr. analyse-id', () => {
  const key = coachBriefingPointKey({ kind: 'video', athlete, video: { id: 'v1' } })
  assert.equal(key, 'video-v1')
  assert.notEqual(coachBriefingPointKey({ kind: 'video', athlete, video: { id: 'v2' } }), key)
})

test('besked: stabil samme dag, ny nøgle en ny kalenderdag — ellers dæmper "Set" ægte nyt indhold for evigt', () => {
  const morgen = { kind: 'message', athlete, track: 'besked', createdAt: '2026-09-22T07:00:00Z' }
  const senereSammeDag = { kind: 'message', athlete, track: 'besked', createdAt: '2026-09-22T21:00:00Z' }
  const nesteDag = { kind: 'message', athlete, track: 'besked', createdAt: '2026-09-23T07:00:00Z' }
  assert.equal(coachBriefingPointKey(morgen), coachBriefingPointKey(senereSammeDag), 'samme UTC-dato skal give samme nøgle')
  assert.notEqual(coachBriefingPointKey(morgen), coachBriefingPointKey(nesteDag), 'ny kalenderdag skal give en ny nøgle')
})

test('besked: teknik og besked på samme atlet/dato er to forskellige punkter', () => {
  const beskedItem = { kind: 'message', athlete, track: 'besked', createdAt: '2026-09-22T07:00:00Z' }
  const teknikItem = { kind: 'message', athlete, track: 'teknik', createdAt: '2026-09-22T07:00:00Z' }
  assert.notEqual(coachBriefingPointKey(beskedItem), coachBriefingPointKey(teknikItem))
})

test('automation: stabil pr. alert-id', () => {
  assert.equal(coachBriefingPointKey({ kind: 'automation', alert: { id: 'a1' } }), 'automation-a1')
})

test('manglende data giver null, aldrig en tom eller vildledende nøgle', () => {
  assert.equal(coachBriefingPointKey(null), null)
  assert.equal(coachBriefingPointKey({ kind: 'signal', athlete: null, signal: {} }), null)
  assert.equal(coachBriefingPointKey({ kind: 'video', athlete, video: {} }), null)
  assert.equal(coachBriefingPointKey({ kind: 'message', athlete: null, track: 'besked' }), null)
})

test('fejlteksten ved "Set" er læsbar, også når tabellen ikke er oprettet endnu', () => {
  const missingByCode = coachBriefingSeenErrorMessage({ code: '42P01', message: 'relation "public.coach_briefing_seen" does not exist' })
  assert.match(missingByCode, /findes ikke endnu/)
  const missingByText = coachBriefingSeenErrorMessage({ message: 'Could not find the table \'public.coach_briefing_seen\' in the schema cache' })
  assert.match(missingByText, /findes ikke endnu/)
  assert.match(coachBriefingSeenErrorMessage({ message: 'boom' }), /boom/)
  assert.match(coachBriefingSeenErrorMessage(null), /Prøv igen/)
})
