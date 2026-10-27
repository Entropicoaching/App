import test from 'node:test'
import assert from 'node:assert/strict'
import { atletStatus, kostmaalTekst, samletAtletprofilEnabled, SAMLET_ATLETPROFIL_FLAG } from './samletAtletprofil.js'

const now = new Date('2026-10-27T10:00:00Z')
const exercise = (id, sets = 2) => ({ id, sets })
const session = (id, weekday, exercises = [exercise(`e-${id}`)]) => ({ id, weekday, session_order: weekday, title: id, exercises })
const week = (sessions, start_date = '2026-10-26', athlete_id = 'a') => ({ id: 'w', athlete_id, start_date, sessions })
const log = (exercise_id, set_number, extra = {}) => ({ athlete_id: 'a', exercise_id, set_number, skipped: false, logged_at: '2026-10-27T10:00:00Z', ...extra })
const status = data => atletStatus({ athleteId: 'a', now, ...data })

test('kontakten er fra som standard og kræver et eksplicit lokalt tilvalg', () => {
  assert.equal(samletAtletprofilEnabled(), false)
  for (const value of [null, '', 'false', '1', 'TRUE']) {
    assert.equal(samletAtletprofilEnabled({ getItem: () => value }), false)
  }
  assert.equal(samletAtletprofilEnabled({ getItem: key => key === SAMLET_ATLETPROFIL_FLAG ? 'true' : null }), true)
  assert.equal(samletAtletprofilEnabled({ getItem() { throw new Error('Lager blokeret') } }), false)
})

test('en tom atlet får ingen opdigtede statusfelter', () => {
  assert.deepEqual(status({}), { week: null, next: null, message: null, video: null })
  assert.deepEqual(status({ weeks: [week([session('uden-dato', 1)], null)] }).next, null)
  assert.equal(status({ weeks: [{ athlete_id: 'a', sessions: [session('uden-dato', 1)] }] }).week, null)
})

test('denne uge tæller pas og ignorerer gamle logs, dubletter og sprangne sæt', () => {
  const weeks = [week([session('s1', 0), session('s2', 2), session('s3', null)])]
  const logs = [log('e-s1', 1), log('e-s1', 2), log('e-s1', 2),
    log('e-s2', 1, { skipped: true }), log('e-s2', 2, { logged_at: '2026-10-25T10:00:00Z' })]
  assert.deepEqual(status({ weeks, logs }).week, { planned: 3, logged: 1 })
})

test('dansk mandag og søndag afgrænser ugen ved vintertid og årsskifte', () => {
  const logs = [log('e-s1', 1, { logged_at: '2026-10-25T23:30:00Z', exercises: { session_id: 's1' } }),
    log('e-s2', 1, { logged_at: '2026-11-01T23:30:00Z', exercises: { session_id: 's2' } })]
  assert.deepEqual(status({ logs }).week, { planned: null, logged: 1 })
  assert.deepEqual(status({ now: new Date('2027-01-01T10:00:00Z'), weeks: [week([session('s1', 4)], '2026-12-28')] }).week,
    { planned: 1, logged: 0 })
})

test('næste pas er det første daterede pas med manglende sæt', () => {
  const weeks = [week([session('s3', 4), session('s1', 1), session('s2', 2), session('fleksibel', null), session('tom', 1, [])])]
  assert.equal(status({ weeks, logs: [log('e-s1', 1)] }).next.id, 's1')
  assert.equal(status({ weeks, logs: [log('e-s1', 1), log('e-s1', 2, { skipped: true })] }).next.id, 's2')
  assert.equal(status({ weeks, logs: [log('e-s1', 1), log('e-s1', 1)] }).next.id, 's1')
})

test('uger, logs, beskeder og videoer fra en anden atlet vises aldrig', () => {
  assert.deepEqual(status({
    weeks: [week([session('s1', 1)], '2026-10-26', 'b')],
    logs: [log('e-s1', 1, { athlete_id: 'b', exercises: { session_id: 's1' } })],
    messages: [{ athlete_id: 'b', content: 'Anden atlet' }],
    videos: [{ athlete_id: 'b', status: 'draft' }],
  }), { week: null, next: null, message: null, video: null })
})

test('status viser nyeste besked i begge spor og kun videoer der venter', () => {
  const messages = [
    { id: 'm1', athlete_id: 'a', category: 'besked', created_at: '2026-10-26T10:00:00Z' },
    { id: 'm2', athlete_id: 'a', category: 'teknik', created_at: '2026-10-27T10:00:00Z' },
  ]
  const videos = [
    { id: 'v1', athlete_id: 'a', status: 'draft', created_at: '2026-10-26T10:00:00Z' },
    { id: 'v2', athlete_id: 'a', status: 'shared', created_at: '2026-10-28T10:00:00Z' },
    { id: 'v3', athlete_id: 'a', status: 'draft', created_at: '2026-10-27T10:00:00Z' },
  ]
  assert.equal(status({ messages, videos }).message.id, 'm2')
  assert.equal(status({ messages, videos }).video.id, 'v3')
})

test('kostresumé indeholder kun registrerede mål', () => {
  assert.equal(kostmaalTekst({}), '')
  assert.equal(kostmaalTekst({ kcal_target: 0, protein_target: null }), '')
  assert.equal(kostmaalTekst({ kcal_target: 2500 }), '2500 kcal')
  assert.equal(kostmaalTekst({ protein_target: 180 }), '180 g protein')
  assert.equal(kostmaalTekst({ kcal_target: 2500, protein_target: 180 }), '2500 kcal · 180 g protein')
})
