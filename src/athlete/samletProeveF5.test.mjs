// Supplemental actual-module checks; genuine React SSR stays in samletProeve.
import test from 'node:test'
import assert from 'node:assert/strict'
import { muscleVolume } from '../entropi2/analysis/muscleVolume.mjs'
import { assertCleanMarkup } from './samletProeveMarkup.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const row = (id, exercises) => ({ id, exercise_id: id, exercises,
  logged_at: '2026-11-03T10:00:00Z', weight: 20, reps_completed: 5 })

test('F5: volume explanation passes the shared release text gate with ready and empty data', () => {
  for (const fremgangLogs of [[], [row('synthetic-other', { name: 'Synthetic variation' })]]) {
    const result = muscleVolume({ fremgangLogs }, now)
    assertCleanMarkup(`<p>${result.message}</p>`)
    assert.match(result.message, /vises som Øvrigt/)
  }
})

test('F5: fallback exercises keep their confirmed counts and tonnage without mutating input', () => {
  const fremgangLogs = [row('synthetic-other', { name: 'Synthetic variation' }),
    row('synthetic-missing', {}), row('synthetic-bench', { name: 'Bænkpres' })]
  const before = structuredClone(fremgangLogs)
  for (const log of fremgangLogs) { Object.freeze(log.exercises); Object.freeze(log) }
  Object.freeze(fremgangLogs)
  const result = muscleVolume({ fremgangLogs }, now)
  const groups = result.weeks.at(-1).groups
  assert.deepEqual(groups.find(group => group.group === 'Øvrigt'), { group: 'Øvrigt', sets: 2, tonnage: 200 })
  assert.deepEqual(groups.find(group => group.group === 'Bryst'), { group: 'Bryst', sets: 1, tonnage: 100 })
  assert.deepEqual(fremgangLogs, before)
})

test('F5: missing and loading history still expose no computed weeks', () => {
  for (const props of [{}, { fremgangLogs: [], fremgangLoading: true }]) {
    const result = muscleVolume(props, now)
    assert.deepEqual(result.weeks, [])
    assertCleanMarkup(`<p>${result.message}</p>`)
    assert.match(result.message, /ikke klar/)
  }
})
