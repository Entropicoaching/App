import test from 'node:test'
import assert from 'node:assert/strict'
import { adaptCoachState } from './coachModel.mjs'
import { sessionNotesModel } from './coachSessionNotes.mjs'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import CoachSessionNotes, { SessionNotesView } from './SessionNotesView.mjs'

const today = '2026-11-03'
const row = (id, logged_at, extra = {}) => ({ id, athlete_id: 'synthetic-a', logged_at,
  exercise_id: 'exercise-a', set_number: 1, note: 'Syntetisk sætnote',
  exercises: { name: 'Squat', session_id: 'session-a', sessions: {
    id: 'session-a', title: 'Syntetisk pas', athlete_comment: 'Syntetisk paskommentar' } }, ...extra })
function fixture() {
  return { session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: today, athleteIds: ['synthetic-a', 'synthetic-b'] },
    athletes: [{ id: 'synthetic-a', name: 'Syntetisk atlet A' }, { id: 'synthetic-b', name: 'Syntetisk atlet B' }],
    athleteLogs: [row('log-a', today + 'T10:00:00Z')], loading: false, loadError: false }
}
const model = (p = fixture(), id = 'synthetic-a', day = today) => sessionNotesModel(p, adaptCoachState(p, day), id)
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] :
  [n, ...nodes(n.props?.children ?? n.children)]
const content = n => Array.isArray(n) ? n.map(content).join(' ') : !n || typeof n === 'boolean' ? '' :
  typeof n === 'object' ? content(n.props?.children ?? n.children) : String(n)
const view = m => SessionNotesView({ model: m, athletes: fixture().athletes, onSelect() {} })

test('actual modules group repeated session comments once, retain separate set notes and sort newest first', () => {
  const p = fixture(); p.athleteLogs = [row('old', '2026-10-28T10:00:00Z'),
    row('second', today + 'T09:00:00Z', { set_number: 2 }), p.athleteLogs[0]]
  const result = model(p)
  assert.equal(result.state, 'loaded'); assert.equal(result.entries.length, 2)
  assert.equal(result.entries[0].day, today); assert.equal(result.entries[0].notes.length, 2)
  assert.equal(result.entries[0].comments.length, 1)
  const dom = view(result)
  assert.equal(nodes(dom).filter(n => n.type === 'time').length, 2)
  assert.match(content(dom), /Syntetisk paskommentar/)
})

test('seven Copenhagen calendar days inclusive exclude older, future and malformed dates', () => {
  const p = fixture(); p.athleteLogs = [
    row('first', '2026-10-27T23:30:00Z'), // Copenhagen 28th
    row('old', '2026-10-27T22:30:00Z'),
    row('future', '2026-11-03T23:30:00Z'),
    row('invalid', '2026-02-30T10:00:00Z'),
    row('local', '2026-11-03T10:00:00'), row('clock', '2026-11-03T25:00:00Z')]
  assert.deepEqual(model(p).entries.map(e => e.day), ['2026-10-28'])
  assert.equal(model(p).state, 'unknown')
})

test('calendar window crosses daylight saving without losing the first day', () => {
  const p = fixture(); p.readContext.day = '2026-10-26'
  p.athleteLogs = [row('first', '2026-10-19T22:30:00Z'), row('old', '2026-10-19T21:30:00Z'),
    row('last', '2026-10-25T23:30:00Z')]
  assert.deepEqual(model(p, 'synthetic-a', '2026-10-26').entries.map(e => e.day), ['2026-10-26', '2026-10-20'])
})

test('same day sessions remain separate and offset timestamps sort by actual instant', () => {
  const p = fixture(); p.athleteLogs = [row('early', today + 'T11:00:00+02:00'),
    row('late', today + 'T10:00:00Z', { exercises: { sessions: { id: 'session-b' } } })]
  assert.equal(model(p).entries.length, 2)
  assert.equal(model(p).entries[0].notes[0].key, 'late')
})

test('existing pain detector ignores negation; explicit stop mentions and skipped sets are distinct', () => {
  const p = fixture(); p.athleteLogs = [row('pain', today, { note: 'Ondt i knæet. Stoppede passet.' }),
    row('negated', today, { note: 'Ingen smerter. Ikke stoppet.' }),
    row('skip', today, { note: null, skipped: true })]
  const notes = model(p).entries[0].notes
  assert.deepEqual(notes[0].marks, ['Smerte nævnt', 'Stop nævnt'])
  assert.deepEqual(notes[1].marks, [])
  assert.deepEqual(notes[2].marks, ['Sprunget sæt over'])
})

test('pain and stop in session comments are preserved with their source', () => {
  const p = fixture(); p.athleteLogs[0].exercises.sessions.athlete_comment = 'Smerte i ryggen; afbrudt.'
  assert.deepEqual(model(p).entries[0].comments[0].marks, ['Smerte nævnt', 'Stop nævnt'])
  assert.match(content(view(model(p))), /Paskommentar/)
})

test('RPE provenance is hidden and metadata-only notes do not produce an entry', () => {
  const p = fixture(); p.athleteLogs[0].note = 'Synlig tekst\n[appData2-rpe-v1:[7,100,5,"2026-11-03"]]'
  assert.equal(model(p).entries[0].notes[0].text, 'Synlig tekst')
  p.athleteLogs[0].note = '[appData2-rpe-v1:[7,100,5,"2026-11-03"]]'
  p.athleteLogs[0].exercises.sessions.athlete_comment = '  '
  assert.equal(model(p).entries.length, 0)
})

test('foreign and unowned rows never leak; changing selection cannot relabel old logs', () => {
  const p = fixture(); p.athleteLogs.push(row('foreign', today, { athlete_id: 'synthetic-b', note: 'B only' }),
    row('unowned', today, { athlete_id: undefined, note: 'Unowned' }), null)
  assert.doesNotMatch(content(view(model(p))), /B only|Unowned/)
  assert.equal(model(p, 'synthetic-b').entries[0].notes[0].text, 'B only')
  p.athleteLogs = [p.athleteLogs[0]]
  assert.equal(model(p, 'synthetic-b').state, 'unknown')
  assert.equal(model(p, 'synthetic-b').entries.length, 0)
})

for (const [label, mutate] of Object.entries({
  'stale context': p => { p.readContext.day = '2026-11-02' },
  'wrong owner': p => { p.readContext.coachId = 'synthetic-other' },
  'loading': p => { p.loading = true }, 'error': p => { p.loadError = true },
  'hidden roster flag': p => { p.athletes[0].hidden = true },
  'hidden set': p => { p.hiddenAthleteIds = new Set(['synthetic-a']) },
  'outside roster context': p => { p.readContext.athleteIds = ['synthetic-b'] },
  'missing logs': p => { delete p.athleteLogs },
  'mismatched receipt': p => { p.athleteLogs.readEvidence = { athleteId: 'synthetic-b', complete: true } },
  'loading receipt': p => { p.athleteLogs.readEvidence = { athleteId: 'synthetic-a', complete: false } },
})) test(`${label} suppresses note content`, () => {
  const p = fixture(); mutate(p); assert.equal(model(p).entries.length, 0)
})

test('missing and incomplete history is not described as no notes', () => {
  const p = fixture(); p.athleteLogs = []
  assert.equal(model(p).state, 'unknown')
  assert.match(content(view(model(p))), /Pasnoterne skal opdateres/)
  p.athleteLogs.readEvidence = { athleteId: 'synthetic-a', complete: true }
  assert.equal(model(p).state, 'loaded')
  assert.match(content(view(model(p))), /Ingen pasnoter de seneste 7 dage/)
})

test('duplicate rows deduplicate but identical notes on different sets remain', () => {
  const p = fixture(); p.athleteLogs.push(structuredClone(p.athleteLogs[0]),
    row('log-b', today, { set_number: 2 }))
  assert.equal(model(p).entries[0].notes.length, 2)
})

test('missing session or note fields use safe source labels without merging distinct exercises', () => {
  const p = fixture(); p.athleteLogs = [row('a', today, { exercises: null }),
    row('b', today, { exercise_id: 'exercise-b', exercises: null, note: 123 })]
  assert.equal(model(p).entries.length, 1)
  assert.equal(model(p).entries[0].title, 'Pas'); assert.equal(model(p).entries[0].notes[0].exercise, 'Øvelse')
})

test('literal markup stays a React text child, whitespace is retained and inputs remain unchanged', () => {
  const p = fixture(); p.athleteLogs[0].note = '<script>synthetic</script>\nSecond line'
  const before = structuredClone(p), dom = view(model(p))
  assert.match(content(dom), /<script>synthetic<\/script>/)
  assert.equal(nodes(dom).some(n => n.props?.dangerouslySetInnerHTML), false)
  assert.deepEqual(p, before)
})

test('selector is labelled, exposes visible athletes and changes local choice without data callbacks', () => {
  let selected; const p = fixture()
  const dom = SessionNotesView({ model: model(p), athletes: adaptCoachState(p, today).athletes,
    onSelect: value => { selected = value } })
  const select = nodes(dom).find(n => n.type === 'select')
  assert.equal(select.props.value, 'synthetic-a')
  assert.equal(nodes(dom).filter(n => n.type === 'option').length, 3)
  select.props.onChange({ target: { value: 'synthetic-b' } }); assert.equal(selected, 'synthetic-b')
  assert.ok(nodes(dom).find(n => n.type === 'label'))
})

test('CoachScreen integrates the view only in enabled overview and preserves OFF hook boundary', () => {
  const p = fixture()
  assert.equal(nodes(CoachView({ ...p, enabled: true, today })).filter(n => n.type === CoachSessionNotes).length, 1)
  assert.equal(nodes(CoachView({ ...p, enabled: true, today, tab: 'inbox' })).filter(n => n.type === CoachSessionNotes).length, 0)
  const hostile = { get athleteLogs() { throw Error('OFF read') } }
  assert.equal(CoachScreen(hostile), null)
  assert.equal(CoachView({ ...p, enabled: false }), null)
})


test('literal STOP mark in a note is shown without treating an ordinary blank note as a stop', () => {
  const p = fixture(); p.athleteLogs[0].note = 'STOP: smerte i skulderen'
  assert.deepEqual(model(p).entries[0].notes[0].marks, ['Smerte nævnt', 'Stop nævnt'])
  p.athleteLogs[0].note = ''
  assert.equal(model(p).entries[0].notes.length, 0)
})
