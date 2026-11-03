import test from 'node:test'
import assert from 'node:assert/strict'
import { weekProgressSentence } from './weekProgressSentence.mjs'
import { adaptPublicContract } from './publicContract.mjs'
import { weekOverview } from './weekOverview.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const exercise = (id, sets = 2) => ({ id, name: 'Squat', sets })
const week = () => ({ start_date: '2026-11-02', block_name: 'Styrke', sessions: [
  { exercises: [exercise('a')] }, { exercises: [exercise('b', 1)] },
] })
const row = (exercise_id = 'a', set_number = 1, extra = {}) => ({
  exercise_id, set_number, logged_at: '2026-11-03T10:00:00Z',
  weight: 100, reps_completed: 3, ...extra,
})
const props = (exerciseLogs = [], extra = {}) => ({ currentWeek: week(), exerciseLogs, ...extra })
const sentence = (logs, extra) => weekProgressSentence(props(logs, extra), now)

test('one neutral sentence covers partial, closed and full program weeks', () => {
  assert.equal(sentence([row()]), 'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
  assert.equal(sentence([row(), row('a', 2)]), 'Denne uge: 1 afsluttet pas og 2 bekræftede sæt.')
  assert.equal(sentence([row(), row('a', 2), row('b')]), 'Denne uge: 2 afsluttede pas og 3 bekræftede sæt.')
  const currentWeek = { ...week(), sessions: Array.from({ length: 3 }, (_, i) => ({ exercises: [exercise(`e${i}`, 14)] })) }
  const logs = currentWeek.sessions.flatMap(s => Array.from({ length: 14 }, (_, i) => row(s.exercises[0].id, i + 1)))
  assert.equal(sentence(logs, { currentWeek }), 'Denne uge: 3 afsluttede pas og 42 bekræftede sæt.')
})

test('missing, empty and skipped-only snapshots return null', () => {
  for (const input of [undefined, null, {}, props(), props(undefined), props(null), props([row('a', 1, { skipped: true })])])
    assert.equal(weekProgressSentence(input, now), null)
  assert.equal(sentence([row()], { currentWeek: { ...week(), sessions: [] } }), null)
  assert.equal(sentence([row()], { exerciseLogs: undefined }), null)
})

test('skips close positions but do not inflate confirmed sets, matching existing models', () => {
  const input = props([row(), row('a', 2, { skipped: true }), row('b', 1, { skipped: true })])
  const overview = weekOverview(adaptPublicContract(input, now), now)
  assert.equal(overview.sessions, 'Pas gennemført: 2 af 2 planlagt.')
  assert.equal(overview.sets, 'Sæt bekræftet: 1. Sprunget over: 2.')
  assert.equal(weekProgressSentence(input, now), 'Denne uge: 2 afsluttede pas og 1 bekræftet sæt.')
})

test('invalid and inactive plans cannot fabricate progress', () => {
  for (const start_date of [undefined, '2026-02-30', '2026-10-28', '2026-11-05'])
    assert.equal(sentence([row()], { currentWeek: { ...week(), start_date } }), null)
  for (const sessions of [null, {}, [null], [{}], [{ exercises: [null] }],
    [{ exercises: [exercise('a'), exercise('a')] }],
    ...[0, -1, 1.5, '2', Infinity, Number.MAX_SAFE_INTEGER + 1].map(sets => [{ exercises: [exercise('a', sets)] }]),
    [{ exercises: [{ name: 'Squat', sets: 2 }] }]])
    assert.equal(sentence([row()], { currentWeek: { ...week(), sessions } }), null)
})

test('only confirmed current-week planned integer positions enter the sentence', () => {
  for (const bad of [row('foreign'), row('a', 0), row('a', 3), row('a', 1.5), row('a', '1'),
    row('a', 1, { _optimistic: true }), null, {}]) assert.equal(sentence([bad]), null)
  for (const logged_at of [undefined, '', 'November 3, 2026', '2026-02-30', '2026-11-01',
    '2026-11-05', '2026-11-04T12:00:01Z', '2026-11-03T24:00:00Z', '2026-11-03T10:00:00'])
    assert.equal(sentence([row('a', 1, { logged_at })]), null)
  assert.equal(sentence([row('a', 1, { logged_at: '2026-11-04T12:00:00Z' })]),
    'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
})

test('Danish calendar boundaries and explicit clock determine the seven-day program week', () => {
  const input = props([row('a', 1, { logged_at: '2026-11-01T23:30:00Z' })])
  assert.equal(weekProgressSentence(input, '2026-11-01T23:45:00Z'), 'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
  assert.equal(weekProgressSentence(input, '2026-11-08T23:00:00Z'), null)
  assert.equal(sentence([row('a', 1, { logged_at: '2026-11-02' })]), 'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
  assert.equal(sentence([row()], { currentWeek: { ...week(), start_date: '2026-10-30' } }),
    'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
  for (const clock of [undefined, null, 0, {}, '', 'invalid', new Date(NaN)])
    assert.equal(weekProgressSentence(props([row()]), clock), null)
})

test('retry IDs count once and conflicting positions count neither', () => {
  const saved = row('a', 1, { id: 'saved' })
  assert.equal(sentence([saved, { ...saved, id: 'retry' }]), 'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
  for (const change of [{ skipped: true }, { weight: 120 }, { reps_completed: 5 }]) {
    const conflict = { ...saved, id: 'retry', ...change }
    assert.equal(sentence([saved, conflict]), null)
    assert.equal(sentence([conflict, saved]), null)
  }
})

test('local undo owns the snapshot; history, callbacks and loading are not read or names reproduced', () => {
  const input = {
    ...props([]),
    get fremgangLogs() { throw Error('history read') },
    get fremgangLoading() { throw Error('loading read') },
    get setTab() { throw Error('callback read') },
  }
  assert.equal(weekProgressSentence(input, now), null)
  input.exerciseLogs = [row()]
  input.currentWeek.sessions[0].exercises[0].name = '<private-note>Bravo! Stop.</private-note>'
  assert.equal(weekProgressSentence(input, now), 'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
})

test('confirmed light/bodyweight/deload sets count without claiming strength or improvement', () => {
  const input = props([row('a', 1, { weight: null, reps_completed: null })])
  input.currentWeek.block_name = 'Deload'
  assert.equal(weekProgressSentence(input, now), 'Denne uge: 0 afsluttede pas og 1 bekræftet sæt.')
})

test('frozen inputs stay unchanged and output is independent of row order', () => {
  const input = props([row(), row('a', 2), row('b')])
  const before = JSON.stringify(input)
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze)
      Object.freeze(value)
    }
    return value
  }
  freeze(input)
  const result = weekProgressSentence(input, Object.freeze(now))
  assert.equal(result, weekProgressSentence({ ...input, exerciseLogs: [...input.exerciseLogs].reverse() }, now))
  assert.equal(result, weekProgressSentence(input, now))
  assert.equal(JSON.stringify(input), before)
  assert.equal(result.split('.').length, 2)
  assert.doesNotMatch(result, /Squat|100|Bravo|advarsel|bedre|stærk|e1RM/)
})
