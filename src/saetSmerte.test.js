// Ordre 1560: smerte i saet-noter standser stigningsforslag og staar oeverst hos coachen. Syntetiske data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { smerteNoter } from './coachFremgang.js'
import { mentionsPain } from './coachBriefingRules.js'
import { buildCoachPriorityItems } from './coachPriority.js'
import { filterOpenTrainingSignals } from './coachInboxState.js'
import { historikSomLogs, medSaetSmerte, ramteLoeft, saetSmerteSignaler, smerteStopFor, SMERTE_LINJE } from './saetSmerte.js'

const TODAY = '2026-10-07'
const dag = n => new Date(Date.parse(`${TODAY}T10:00:00Z`) - n * 86400000).toISOString().slice(0, 10)
const hist = (navn, dage, note) => ({ [navn.toLowerCase()]: [{ date: dag(dage), sets: [{ weight: 100, reps: 5, rpe: 8, set: 1, note }] }] })
const stopFor = (historik, navn) => smerteStopFor(smerteNoter(historikSomLogs(historik), TODAY), navn)

test('skulder-smerte paa baenk standser baenk, ikke squat', () => {
  const h = hist('Bænkpres', 1, 'skulderen stikker på sidste sæt')
  assert.deepEqual({ del: stopFor(h, 'Bænkpres').del, dag: stopFor(h, 'Bænkpres').dag }, { del: 'skulderen', dag: dag(1) })
  assert.equal(stopFor(h, 'Squat'), null)
  assert.equal(stopFor(h, 'Dødløft'), null)
})

test('hofte-smerte paa squat standser ogsaa doedloeft og sumo (regionen), ikke baenk', () => {
  const h = hist('Squat', 2, 'ondt i hoften')
  assert.ok(stopFor(h, 'Sumo dødløft'))
  assert.ok(stopFor(h, 'Dødløft'))
  assert.ok(stopFor(h, 'Squat'))
  assert.equal(stopFor(h, 'Bænkpres'), null)
})

test('ukendt kropsdel: kun loeftet noten stod paa, plus den praecise oevelse', () => {
  const h = hist('Squat', 1, 'noget gør ondt')
  assert.deepEqual(ramteLoeft(smerteNoter(historikSomLogs(h), TODAY)[0]), ['Squat'])
  assert.ok(stopFor(h, 'Squat'))
  assert.equal(stopFor(h, 'Dødløft'), null)
})

test('smerte paa en tilbehoersoevelse standser netop den oevelse', () => {
  const h = hist('Skulderpres', 1, 'smerter i skulderen')
  assert.ok(stopFor(h, 'Skulderpres'))
  assert.ok(stopFor(h, 'Bænkpres')) // regionen (skulderen) rammer ogsaa baenk
  assert.equal(stopFor(h, 'Squat'), null)
})

test('gammel note (>14 dage), negation og tom note standser intet', () => {
  assert.equal(stopFor(hist('Squat', 20, 'knæet gjorde ondt'), 'Squat'), null)
  assert.equal(stopFor(hist('Squat', 1, 'ingen smerter i knæet'), 'Squat'), null)
  assert.equal(stopFor(hist('Squat', 1, 'kunne ikke mærke smerte'), 'Squat'), null)
  assert.equal(stopFor(hist('Squat', 1, null), 'Squat'), null)
})

test('"kunne ikke maerke smerte" er ikke smerte (QA 1555 fund 4), rigtig smerte er stadig smerte', () => {
  assert.equal(mentionsPain('kunne ikke mærke smerte'), false)
  assert.equal(mentionsPain('knæet gør ondt'), true)
})

test('V-SMERTE B: den rolige linje har den valgte ordlyd', () => {
  assert.equal(SMERTE_LINJE, 'Ingen forslag i dag: tal med din coach om smerten')
})

const ECHO = { id: 'a-echo', name: 'Echo' }
const LOGS = [
  { athlete_id: 'a-echo', note: 'skulderen stikker', logged_at: `${dag(1)}T10:00:00Z`, exercise_id: 'e1', exercises: { name: 'Bænkpres topsæt' } },
  { athlete_id: 'a-echo', note: 'tung men fin', logged_at: `${dag(1)}T10:05:00Z`, exercise_id: 'e1', exercises: { name: 'Bænkpres topsæt' } },
  { athlete_id: 'a-bravo', note: 'ondt i knæet', logged_at: `${dag(1)}T10:00:00Z`, exercise_id: 'e2', exercises: { name: 'Squat' } },
]

test('coachen: saet-note-smerte bliver et alert-signal med loeft og dato, kun for kendte atleter, noten citeres ikke', () => {
  const s = saetSmerteSignaler(LOGS, [ECHO, { id: 'a-charlie', name: 'Charlie' }], TODAY)
  assert.equal(s.length, 1)
  assert.equal(s[0].o_detector, 'pain')
  assert.equal(s[0].o_severity, 'alert')
  assert.match(s[0].o_headline, /^Echo: melder ondt i skulderen \(bænkpres, sæt-note 6\. okt\)$/)
  assert.match(s[0].o_detail, /Ingen stigning på bænkpres/)
  assert.ok(!JSON.stringify(s).includes('stikker'))
})

test('coachen: signalet staar oeverst i Kraever dit blik (foer fravaer) og erstatter atletens SQL-smertesignal', () => {
  const sql = [
    { o_athlete_id: 'a-echo', o_athlete_name: 'Echo', o_detector: 'pain', o_severity: 'context', o_headline: 'x', o_detail: 'y', o_metrics: {} },
    { o_athlete_id: 'a-echo', o_athlete_name: 'Echo', o_detector: 'missed_sessions', o_severity: 'alert', o_headline: 'm', o_detail: 'd', o_metrics: {} },
  ]
  const alle = medSaetSmerte(sql, saetSmerteSignaler(LOGS, [ECHO], TODAY))
  assert.equal(alle.filter(x => x.o_detector === 'pain').length, 1)
  const aaben = filterOpenTrainingSignals(alle, [])
  const items = buildCoachPriorityItems({ athletes: [ECHO], trainingSignals: aaben, unreadByTrack: {}, latestByTrack: {}, videoReviewQueue: [], describeVideo: () => '' })
    .sort((a, b) => a.rank - b.rank)
  assert.equal(items[0].label, 'Smerte')
  assert.match(items[0].title, /bænkpres/)
})
