// Synthetic inputs shared by real React SSR and the explicitly synthetic check.
import assert from 'node:assert/strict'
import MineData from './athlete/minedata/MineData.mjs'
import DevelopmentView from './analysis/DevelopmentView.mjs'
import SleepOverview from './tracking/soevn/SleepOverview.mjs'
import { renderUpload } from './videocoach/view.mjs'
import { addCalendarDays } from '../calendarDate.js'

const id = 'synthetic-count', today = '2026-11-04'
const ready = rows => ({ state: 'ready', rows })

export function verifyMineData(h, render) {
  for (const count of [0, 1, 2]) {
    const rows = Array.from({ length: count }, (_, i) => ({ athlete_id: id, id: `synthetic-${i}`,
      date: addCalendarDays(today, -i), status: 'completed', kg: 80, goalMet: true }))
    const props = { athleteId: id, today, sessions: ready(rows), records: ready([]),
      nutritionDays: ready(rows), weights: ready(rows) }
    const before = structuredClone(props), output = render(h(MineData, props))
    if (count === 0) {
      assert.equal(output, '') // Existing quiet empty state is preserved.
      assert.deepEqual(props, before)
      continue
    }
    assert.match(output, new RegExp(`${count} ${count === 1 ? 'registreret, gennemført pas' : 'registrerede, gennemførte pas'}`))
    assert.match(output, new RegExp(`${count} ${count === 1 ? 'registreret dag' : 'registrerede dage'} af 28`))
    assert.match(output, new RegExp(`${count} ${count === 1 ? 'dag' : 'dage'} med registreret kropsvægt`))
    if (count) assert.match(output, new RegExp(`${count} ${count === 1 ? 'kostdag' : 'kostdage'} med vurderbart mål`))
    assert.deepEqual(props, before)
  }
}

export function verifyDevelopment(h, render) {
  const props = { entropi2: true, now: '2026-11-04T12:00:00Z', athlete: { id }, fremgangLogs: [
    { athlete_id: id, exercise_id: 'synthetic-count-ex', set_number: 1,
      logged_at: '2026-11-03T10:00:00Z', weight: 100, reps_completed: 1,
      exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } },
  ] }
  const output = render(h(DevelopmentView, props))
  assert.match(output, /1 uge med data/)
  assert.doesNotMatch(output, /1 uger med data|1 gentagelser/)
  assert.equal(DevelopmentView({ entropi2: false, get now() { throw Error('OFF read') } }), null)
  assert.equal(render(h(DevelopmentView, { entropi2: false })), '')
}

export function verifySleep(h, render) {
  const snapshot = { status: 'ready', complete: true, athleteId: id, endDate: today,
    readinessRows: Array.from({ length: 4 }, (_, i) => ({ athlete_id: id,
      logged_date: addCalendarDays(today, -i), sleep_hours: 1 })), qualityRows: [], exerciseLogs: [] }
  for (const compact of [false, true]) {
    const output = render(h(SleepOverview, { enabled: true, hoursOnly: true, compact, snapshot }))
    // The compact display keeps its existing decimal format (1,0).
    assert.match(output, compact ? /1,0 time/ : /1 time/)
    assert.doesNotMatch(output, /1(?:,0)? timer/)
    assert.match(output, /4\/7 dage/)
  }
  assert.equal(SleepOverview({ enabled: false, get snapshot() { throw Error('OFF read') } }), null)
  assert.equal(render(h(SleepOverview, { enabled: false })), '')
}

export function verifyUpload(h, render) {
  for (const reps of [1, '1', 2, '1-3', null]) {
    const state = { enabled: true, step: 1, phase: 'idle', options: [{ key: 'synthetic',
      exercise_name: 'Syntetisk løft', set_number: 1, load_kg: 80, reps }] }
    const output = render(renderUpload(h, { state, controller: {} }))
    const expected = reps === 1 || reps === '1' ? '1 gentagelse' : `${reps ?? '—'} gentagelser`
    assert.ok(output.includes(expected), expected)
    assert.doesNotMatch(output, /1 gentagelser/)
  }
  assert.equal(renderUpload(h, { state: { enabled: false }, controller: {} }), null)
}
