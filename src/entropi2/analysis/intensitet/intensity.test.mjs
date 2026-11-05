import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { weeklyIntensity, intensityZone, INTENSITY_ZONES } from './intensityModel.mjs'
import { renderTree } from '../testDom.mjs'

// Only React's element factory is substituted. Model, calendar and view imports
// execute the actual candidate source. No DOM/layout/React runtime claim.
register('../reactElementLoader.mjs', import.meta.url)
const { default: IntensityView } = await import('./IntensityView.mjs')
const now = '2026-11-04T12:00:00Z'
const log = (id, extra = {}) => ({ id, exercise_id: 'synthetic-exercise', set_number: id,
  logged_at: '2026-11-03T10:00:00Z', weight: 75, reps_completed: 5, reference_e1rm: 100, ...extra })
const current = rows => weeklyIntensity(rows, now).weeks.at(-1)
const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o) } return o }

test('exact boundaries, above 100%, decimal input and immutable zone definitions', () => {
  for (const [weight, expected] of [[69.999, 'under70'], [70, '70to80'], [79.999, '70to80'],
    [80, '80to90'], [89.999, '80to90'], [90, '90plus'], [125, '90plus'], ['70,5', '70to80']])
    assert.equal(intensityZone(weight, 100), expected)
  assert.ok(Object.isFrozen(INTENSITY_ZONES) && INTENSITY_ZONES.every(Object.isFrozen))
})

test('invalid or unmeasurable values remain unknown, including overflow/underflow', () => {
  for (const bad of [undefined, null, '', 0, -1, NaN, Infinity, true, {}, 'bad']) {
    assert.equal(intensityZone(bad, 100), null)
    assert.equal(intensityZone(75, bad), null)
  }
  assert.equal(intensityZone(Number.MAX_VALUE, Number.MIN_VALUE), null)
  assert.equal(intensityZone(Number.MIN_VALUE, Number.MAX_VALUE), null)
  for (const extra of [{ weight: 0 }, { reference_e1rm: null }, { reps_completed: 0 },
    { reps_completed: 2.5 }, { reps_completed: undefined }, { reps_completed: Infinity }]) {
    const week = current([log(1, extra)])
    assert.equal(week.total, 1); assert.equal(week.unknown, 1)
    assert.equal(week.classified, 0); assert.ok(week.zones.every(z => z.share === null))
  }
})

test('weekly counts use each set reference and shares use classified sets only', () => {
  const week = current([log(1, { weight: 60 }), log(2), log(3, { weight: 85 }),
    log(4, { weight: 190, reference_e1rm: 200 }), log(5, { reference_e1rm: null })])
  assert.deepEqual(week.zones.map(z => z.count), [1, 1, 1, 1])
  assert.deepEqual(week.zones.map(z => z.share), [0.25, 0.25, 0.25, 0.25])
  assert.deepEqual([week.total, week.classified, week.unknown], [5, 4, 1])
  assert.equal(current([log(1, { reps_completed: 1 }), log(2, { reps_completed: 20 })]).zones[1].count, 2)
})

test('empty weeks, unavailable data and invalid explicit clock are distinct', () => {
  const m = weeklyIntensity([], now)
  assert.equal(m.ready, true); assert.equal(m.weeks.length, 4)
  assert.equal(m.weeks[0].start, '2026-10-12'); assert.equal(m.weeks[3].end, '2026-11-08')
  assert.ok(m.weeks.every(w => w.total === 0 && w.zones.every(z => z.share === null)))
  assert.equal(weeklyIntensity(undefined, now).ready, false)
  for (const bad of [undefined, null, '', 'bad', '2026-02-30', '2026-02-30T12:00:00Z',
    '2026-11-04T12:00:00', '2026-11-04T24:00:00Z', new Date('bad')])
    assert.equal(weeklyIntensity([], bad).ready, false)
})

test('duplicates and conflicting retries including reference/skip/pending never choose a winner', () => {
  const a = log(1)
  assert.equal(current([a, { ...a }]).total, 1)
  assert.equal(current([a, { ...a, id: 'retry' }]).total, 1)
  for (const extra of [{ weight: 80 }, { reference_e1rm: 110 }, { skipped: true },
    { _optimistic: true }, { reps_completed: 3 }, { logged_at: '2026-11-02' }]) {
    assert.equal(current([a, { ...a, ...extra }]).total, 0)
    assert.equal(current([a, { ...a, id: 'retry', ...extra }]).total, 0)
  }
  assert.equal(current([a, { ...a, exercise_id: 'other', set_number: 2 }]).total, 0)
  const noId = log(undefined, { set_number: 1 })
  assert.equal(current([noId, { ...noId }]).total, 1)
  const timeOnly = log(undefined)
  assert.equal(current([timeOnly, { ...timeOnly }]).total, 1)
  assert.equal(current([log(1, { exercise_id: undefined, set_number: undefined })]).total, 1)
})

test('future, invalid, skipped, optimistic, unidentifiable and outside-window rows are ignored', () => {
  for (const logged_at of ['2026-11-05', '2026-11-04T12:00:01Z', '2026-10-11',
    '2026-02-30', '2026-11-03T24:00:00Z', '2026-11-03T10:00:00', 'bad'])
    assert.equal(current([log(1, { logged_at })]).total, 0)
  for (const extra of [{ skipped: true }, { _optimistic: true },
    { id: undefined, exercise_id: undefined, set_number: undefined }])
    assert.equal(current([log(1, extra)]).total, 0)
  assert.equal(current([null, [], false, 'bad']).total, 0)
  assert.equal(weeklyIntensity([log(1, { logged_at: '2026-11-04T22:59:59Z' })], '2026-11-04').weeks.at(-1).total, 1)
})

test('Danish Monday boundary in winter, summer and year rollover', () => {
  for (const [asOf, before, after, monday] of [
    ['2026-11-01T23:30:00Z', '2026-11-01T22:59:59Z', '2026-11-01T23:00:00Z', '2026-11-02'],
    ['2026-07-05T22:30:00Z', '2026-07-05T21:59:59Z', '2026-07-05T22:00:00Z', '2026-07-06'],
    ['2026-01-04T23:30:00Z', '2026-01-04T22:59:59Z', '2026-01-04T23:00:00Z', '2026-01-05'],
  ]) {
    const m = weeklyIntensity([log(1, { logged_at: before }), log(2, { logged_at: after })], asOf)
    assert.equal(m.weeks.at(-1).start, monday)
    assert.equal(m.weeks.at(-1).total, 1); assert.equal(m.weeks.at(-2).total, 1)
  }
})

test('frozen inputs, ordering and count conservation across exercises', () => {
  const rows = freeze(Array.from({ length: 40 }, (_, i) => log(i, {
    exercise_id: i % 2 ? 'synthetic-bench' : 'synthetic-squat',
    weight: 50 + i * 2, reference_e1rm: i % 7 ? 100 : null,
  })))
  const m = weeklyIntensity(rows, now)
  assert.deepEqual(m, weeklyIntensity([...rows].reverse(), now))
  assert.deepEqual(m, weeklyIntensity(rows, new Date(now)))
  for (const w of m.weeks) {
    assert.equal(w.total, w.classified + w.unknown)
    assert.equal(w.classified, w.zones.reduce((n, z) => n + z.count, 0))
    if (w.classified) assert.ok(Math.abs(w.zones.reduce((n, z) => n + z.share, 0) - 1) < 1e-12)
  }
})

test('OFF returns before reading data or clock and preserves strict opt-in', () => {
  for (const entropi2 of [undefined, false, null, 0, 1, 'true'])
    assert.equal(IntensityView({ entropi2, get exerciseLogs() { throw Error('data') },
      get asOf() { throw Error('clock') } }), null)
})

test('actual view exposes semantic counts, missing state, empty state and honest denominator', () => {
  const render = exerciseLogs => renderTree(IntensityView({ entropi2: true, exerciseLogs, asOf: now }))
  const tree = render([log(1), log(2, { reference_e1rm: null })])
  assert.equal(tree.getAttribute('aria-label'), 'Intensitet pr. uge')
  assert.equal(tree.querySelectorAll('h3').length, 1)
  assert.equal(tree.querySelectorAll('li').length, 4)
  assert.match(tree.textContent, /1 af 2 registrerede sæt fordelt/)
  assert.match(tree.textContent, /70 til under 80 %: 1 sæt \(100\s%\)/)
  assert.match(tree.textContent, /1 sæt uden gyldig måling/)
  assert.match(tree.textContent, /ikke en træningsanbefaling/)
  assert.equal(render([]), null)
  assert.match(render(undefined).textContent, /Sætdata er ikke klar/)
  assert.equal(render([log(1, { reference_e1rm: null })]), null)
  assert.match(renderTree(IntensityView({ entropi2: true })).textContent, /Dato mangler/)
})
