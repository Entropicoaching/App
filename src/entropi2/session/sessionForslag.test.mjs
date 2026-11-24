import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { sessionForslag } from './sessionForslag.mjs'
import { historyTestDom } from './historik/historyTestDom.mjs'
import { udenForslagVedSmerte, SMERTE_BESKED } from '../../athlete/smerteStop.js'

// Ordre 2093: appens forslag og Marcs rolige smertelinje i Entropi 2-passet.
const NU = Date.parse('2026-11-04T12:00:00Z')
const ex = (id, name, extra = {}) => ({ id, name, sets: 2, reps: 5, intensity: '@8', tempo: '3-1-X-0', restSeconds: 90, ...extra })
function setup({ kommentar = null, raa = () => ({ weight: 102.5, fromRpe: 8 }), extra = {}, oevelser = [ex('sq', 'Squat')] } = {}) {
  const week = { id: 'week', athlete_id: 'synthetic-a', start_date: '2026-11-02',
    sessions: [{ id: 'session', athlete_comment: kommentar, exercises: oevelser }] }
  const timers = new Map(); let next = 0
  const root = historyTestDom()
  const clock = { Date: { now: () => NU }, setInterval(fn) { timers.set(++next, fn); return next }, clearInterval(id) { timers.delete(id) } }
  const p = { enabled: true, athleteId: 'synthetic-a', currentWeek: week, allWeeks: [week], exerciseLogs: [], logInputs: {},
    setLogInputs(fn) { p.logInputs = fn(p.logInputs) }, parsePlannedRpe: () => 8, onLogSet() {},
    suggestNextWeight: udenForslagVedSmerte(raa, [week], {}, NU), ...extra }
  const view = mountSession(root, () => p, { clock }); view.controller.start()
  return { root, p, dispose() { view.dispose() } }
}
const tekster = (t, sel) => [...t.root.querySelectorAll(sel)].map(n => n.textContent)

test('uden smerte vises appens forslag og næste sæt', () => {
  const t = setup()
  try {
    assert.deepEqual(tekster(t, '[data-forslag="forslag"]'), ['Appens forslag: 102,5 kg (RPE 8)', 'Næste: 5 reps @ 102,5 kg'])
    assert.equal(t.root.querySelector('[data-forslag="smerte"]'), null)
  } finally { t.dispose() }
})
test('smerte-note på samme region: kun Marcs rolige linje, intet forslagstal', () => {
  const t = setup({ kommentar: 'Det gjorde ondt i knæet' })
  try {
    assert.deepEqual(tekster(t, '[data-forslag="smerte"]'), [SMERTE_BESKED])
    assert.equal(SMERTE_BESKED, 'Ingen forslag i dag: tal med din coach om smerten')
    assert.equal(t.root.querySelector('[data-forslag="forslag"]'), null)
    assert.doesNotMatch(t.root.textContent, /102,5|Appens forslag|Næste: 5 reps/)
  } finally { t.dispose() }
})
test('smerte i skulderen rammer ikke squat; forslaget står', () => {
  const t = setup({ kommentar: 'Ondt i skulderen' })
  try { assert.equal(tekster(t, '[data-forslag="forslag"]').length, 2) } finally { t.dispose() }
})
test('smerte udløber efter 14 dage', () => {
  const week = sæt => ({ start_date: sæt, sessions: [{ athlete_comment: 'ondt i knæet', exercises: [{ name: 'Squat' }] }] })
  const f = udenForslagVedSmerte(() => ({ weight: 100, fromRpe: 8 }), [week('2026-10-05')], {}, NU)
  assert.equal(sessionForslag({ suggestNextWeight: f }, ex('sq', 'Squat')).kind, 'forslag')
})
test('uden data, uden funktion eller med coachens vægt vises intet', () => {
  assert.equal(sessionForslag({}, ex('sq', 'Squat')), null)
  assert.equal(sessionForslag({ suggestNextWeight: () => null }, ex('sq', 'Squat')), null)
  assert.equal(sessionForslag({ suggestNextWeight: () => ({ weight: 100, fromRpe: 8 }) }, ex('sq', 'Squat', { recommended_weight: 90 })), null)
  assert.equal(sessionForslag({ suggestNextWeight: () => { throw Error('x') } }, ex('sq', 'Squat')), null)
  const t = setup({ raa: () => null })
  try { assert.equal(t.root.querySelector('[data-forslag]'), null) } finally { t.dispose() }
})
test('forslaget kommer kun fra den genbrugte model og stop-objektet giver samme linje', () => {
  const t = setup({ raa: () => ({ stop: true, del: 'knæet', dag: '2026-11-03' }) })
  try { assert.deepEqual(tekster(t, '[data-forslag="smerte"]'), [SMERTE_BESKED]) } finally { t.dispose() }
})
test('broen: AthleteView giver HomeSession den smertepakkede suggestNextWeight, og HomeSession sender den videre til passet', async () => {
  const { readFile } = await import('node:fs/promises')
  const host = await readFile(new URL('../../AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(host, /const suggestNextWeight = udenForslagVedSmerte\(suggestNextWeightRaa, allWeeks, exerciseHistory\)/)
  assert.match(host, /<HomeSession [\s\S]*?\n\s+suggestNextWeight=\{suggestNextWeight\}[\s\S]*?onFilmSet/)
  const home = await readFile(new URL('../home/HomeSession.mjs', import.meta.url), 'utf8')
  assert.match(home, /props\.enabled === true \? \{ \.\.\.props,/)
})
