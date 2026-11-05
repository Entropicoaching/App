import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionComparisons } from './sessionComparison.mjs'
import { sessionComparisonContent } from './sessionComparisonContent.mjs'
import { historyElement } from './historik/exerciseHistoryDom.mjs'
import { mountSession } from './sessionView.mjs'
import { button } from './a11y-dom.mjs'
import { historyTestDom } from './historik/historyTestDom.mjs'

const now = Date.parse('2026-11-05T12:00:00Z')
const session = { id: 'session', exercises: [{ id: 'lift', name: 'Løft A', sets: 3, reps: 5 }] }
const p = { enabled: true, athleteId: 'synthetic' }
const row = (extra = {}) => ({ athlete_id: 'synthetic', exercise_id: 'lift', set_number: 1,
  weight: 60, reps_completed: 5, logged_at: '2026-11-04T10:00:00Z', ...extra })
const current = (extra = {}) => row({ logged_at: '2026-11-05T10:00:00Z', weight: 65, ...extra })
const read = (logs, extra = {}, selected = session, at = now) => sessionComparisons(selected, logs, { ...p, ...extra }, at)

test('two and eight comparisons have one closed row each, compact summaries and one shared explanation', () => {
  for (const size of [2, 8]) {
    const item = read([row(), current()])[0]
    const doc = historyTestDom().ownerDocument
    const content = sessionComparisonContent((...args) => historyElement(doc, ...args),
      Array.from({ length: size }, (_, i) => ({ ...item, exerciseId: `synthetic-${i}`, name: `Løft ${i}` })))
    const folds = content.querySelectorAll('details')
    assert.equal(folds.length, size)
    for (const [i, fold] of folds.entries()) {
      assert.ok(!fold.open)
      assert.equal(fold.getAttribute('data-detail'), `comparison-synthetic-${i}`)
      const summary = fold.querySelector('summary')
      assert.equal(summary.textContent, `Løft ${i} · Tungeste sæt: 60 kg × 5 → 65 kg × 5`)
      assert.doesNotMatch(summary.textContent, /volumen|bekræftede|nov\./)
      assert.match(fold.textContent, /nov\.|november/)
      assert.match(fold.textContent, /Samlet volumen/)
    }
    assert.equal(content.textContent.split('Før → nu.').length - 1, 1)
  }
  assert.equal(sessionComparisonContent(() => assert.fail('empty section'), []), null)
})

test('compares latest prior exact exercise day with today: all confirmed slots, decimals, zero kg and stable ties', () => {
  const logs = [row({ weight: 999, logged_at: '2026-11-01T10:00:00Z' }),
    row(), row({ set_number: 2, weight: '62,5', reps_completed: 4 }),
    current(), current({ set_number: 2, weight: 65, reps_completed: 6 }), current({ set_number: 3, weight: 0, reps_completed: 8 })]
  const expected = [{ exerciseId: 'lift', name: 'Løft A', previousDate: '2026-11-04',
    before: { count: 2, volume: 550, heaviest: { weight: 62.5, reps: 4 } },
    current: { count: 3, volume: 715, heaviest: { weight: 65, reps: 6 } } }]
  assert.deepEqual(read(logs), expected)
  assert.deepEqual(read([...logs].reverse()), expected)
  assert.equal(read([row({ weight: 0 }), current({ weight: 0 })])[0].before.volume, 0)
})

test('no comparison without previous/current data, on load failure, or while OFF; no OFF property reads', () => {
  for (const logs of [[], [row()], [current()], [row({ logged_at: '2026-11-05T09:00:00Z' }), current()]])
    assert.deepEqual(read(logs), [])
  for (const extra of [{ exerciseLogsError: true }, { exerciseLogsLoading: true }, { athleteId: null }])
    assert.deepEqual(read([row(), current()], extra), [])
  assert.deepEqual(sessionComparisons(null, null, { enabled: false,
    get athleteId() { assert.fail('OFF read') } }, null), [])
  assert.deepEqual(read(null), [])
  assert.deepEqual(read([row(), current()], {}, null), [])
  assert.deepEqual(read([row(), current()], {}, session, NaN), [])
})

test('foreign/missing athlete, other IDs with same name, optimistic, skipped, queued and parked are not evidence', () => {
  for (const extra of [{ athlete_id: 'other' }, { athlete_id: undefined }, { exercise_id: 'same-name-other-id' },
    { _optimistic: true }, { skipped: true }, { skipped: 'false' }]) {
    assert.deepEqual(read([row(extra), current()]), [])
    assert.deepEqual(read([row(), current(extra)]), [])
  }
  for (const extra of [{ pendingSyncKeys: ['lift_1'] }, { parkedSets: [{ exerciseId: 'lift', setNumber: 1 }] }])
    assert.deepEqual(read([row(), current()], extra), [])
  assert.equal(read([row(), current(), current({ set_number: 4, weight: 999 })])[0].current.volume, 325)
  assert.deepEqual(read([row(), current()], {}, { exercises: [...session.exercises, ...session.exercises] }), [])
})

test('timestamps use Copenhagen dates across midnight and DST; future and malformed rows are excluded', () => {
  const midnight = Date.parse('2026-11-05T00:30:00Z')
  const result = read([row({ logged_at: '2026-11-04T21:00:00Z' }),
    current({ logged_at: '2026-11-04T23:30:00Z' })], {}, session, midnight)
  assert.equal(result[0].previousDate, '2026-11-04')
  for (const logged_at of ['2026-11-05', '2026-11-04T10:00:00', '2026-02-30T10:00:00Z',
    '2026-11-04T24:00:00Z', '2026-11-04T10:60:00Z', '2026-11-04T10:00:00+25:00', '2026-11-06T10:00:00Z'])
    assert.deepEqual(read([row({ logged_at }), current()]), [])
  const dst = read([row({ logged_at: '2026-10-24T20:00:00Z' }), current({ logged_at: '2026-10-25T00:30:00Z' }),
    current({ set_number: 2, logged_at: '2026-10-25T01:30:00Z' })], {}, session, Date.parse('2026-10-25T12:00:00Z'))
  assert.equal(dst[0].current.count, 2)
  assert.equal(dst[0].previousDate, '2026-10-24')
})

test('duplicate slots count once; conflicting or invalid latest data hides comparison instead of falling back', () => {
  assert.equal(read([row(), row(), current(), current()])[0].before.volume, 300)
  const invalid = [{ weight: null }, { weight: '' }, { weight: -1 }, { weight: Infinity }, { weight: true },
    { weight: '1e2' }, { reps_completed: 0 }, { reps_completed: 1.5 }, { set_number: 0 },
    { weight: Number.MAX_VALUE }, { reps_completed: Number.MAX_SAFE_INTEGER + 1 }]
  for (const extra of invalid) {
    assert.deepEqual(read([row(), row(extra), current()]), [])
    assert.deepEqual(read([row(), current(), current(extra)]), [])
  }
  const conflict = [row(), row({ weight: 80 }), current()]
  assert.deepEqual(read(conflict), [])
  assert.deepEqual(read(conflict.reverse()), [])
  const skippedConflict = [row(), row({ skipped: true }), current()]
  assert.deepEqual(read(skippedConflict), [])
  assert.deepEqual(read(skippedConflict.reverse()), [])
  assert.equal(read([row({ logged_at: '2026-11-01T10:00:00Z' }), row({ skipped: true }), current()])[0].previousDate, '2026-11-01')
  assert.deepEqual(read([row({ logged_at: '2026-11-01T10:00:00Z' }), row({ weight: null }), current()]), [])
})

test('frozen source is untouched; a separate exhaustive oracle checks totals and heaviest for 256 inputs', () => {
  for (let mask = 0; mask < 256; mask++) {
    const before = [], after = []
    for (let i = 0; i < 4; i++) {
      if (mask & (1 << i)) before.push(row({ set_number: i + 1, weight: (i + 1) * 10, reps_completed: 4 - i }))
      if (mask & (1 << (i + 4))) after.push(current({ set_number: i + 1, weight: (i + 1) * 15, reps_completed: i + 2 }))
    }
    const logs = Object.freeze([...before, ...after].map(Object.freeze))
    const plan = Object.freeze({ exercises: Object.freeze([Object.freeze({ ...session.exercises[0], sets: 4 })]) })
    const output = read(logs, {}, plan)
    if (!before.length || !after.length) { assert.deepEqual(output, []); continue }
    const expected = sets => ({ count: sets.length, volume: sets.reduce((sum, s) => sum + s.weight * s.reps_completed, 0),
      heaviest: { weight: sets.at(-1).weight, reps: sets.at(-1).reps_completed } })
    assert.deepEqual(output[0].before, expected(before))
    assert.deepEqual(output[0].current, expected(after))
    output[0].before.heaviest.weight = -1
    assert.deepEqual(read(logs, {}, plan)[0].before, expected(before))
  }
})

test('mounted summary shows before/now once, updates errors and data, resumes, and never writes', () => {
  const week = { id: 'week', sessions: [session] }, root = historyTestDom()
  const props = { ...p, allWeeks: [week], currentWeek: week, exerciseLogs: [row(), current({ set_number: 2 })],
    logInputs: {}, setLogInputs() { assert.fail('summary input write') },
    onLogSet() { assert.fail('summary set write') }, parsePlannedRpe: () => null }
  const clock = { Date: { now: () => now }, setInterval() { assert.fail('unexpected timer') }, clearInterval() {} }
  const view = mountSession(root, () => props, { clock })
  const comparison = () => root.querySelector('[data-session-comparison]')
  try {
    button(root, 'Start dagens pas').click()
    assert.equal(comparison(), null)
    button(root, 'Afslut pas').click()
    assert.match(comparison().textContent, /Sidst 4\. nov\. 2026: 1 bekræftet sæt · Nu i dag: 1 bekræftet sæt/)
    assert.match(comparison().textContent, /Tungeste sæt: 60 kg × 5 → 65 kg × 5/)
    assert.match(comparison().textContent, /Samlet volumen: 300 kg → 325 kg/)
    assert.doesNotMatch(root.querySelector('[data-session-summary]').textContent, /Tungeste sæt i dag/)
    assert.equal(root.ownerDocument.activeElement, root.querySelector('[data-heading]'))
    props.exerciseLogsError = true; view.update(); assert.equal(comparison(), null)
    props.exerciseLogsError = false; props.exerciseLogsLoading = true; view.update(); assert.equal(comparison(), null)
    props.exerciseLogsLoading = false; props.exerciseLogs = [current()]; view.update(); assert.equal(comparison(), null)
    props.exerciseLogs = [row(), current()]; view.update(); assert.ok(comparison())
    button(root, 'Fortsæt passet').click(); assert.equal(comparison(), null)
    button(root, 'Afslut pas').click(); button(root, 'Luk pas').click()
    button(root, 'Åbn dagens pas').click(); assert.ok(comparison())
    props.enabled = false; view.update(); assert.equal(root.querySelector('dialog'), null)
  } finally { view.dispose() }
  assert.equal(root.children.length, 0)
})

test('today pending or parked slot never removes the same confirmed historical slot', () => {
  const before = [1, 2, 3].map(set_number => row({ set_number }))
  const after = [1, 2, 3].map(set_number => current({ set_number }))
  for (const extra of [{ pendingSyncKeys: ['lift_1'] }, { parkedSets: [{ exerciseId: 'lift', setNumber: 1 }] }]) {
    const result = read([...before, ...after], extra)[0]
    assert.equal(result.before.count, 3)
    assert.equal(result.before.volume, 900)
    assert.equal(result.current.count, 2)
    assert.equal(result.current.volume, 650)
  }
})

test('mounted comparison keeps historical slots excluded by the controller today; unequal counts have no volume arrow', () => {
  const week = { id: 'week', sessions: [session] }
  for (const extra of [{ pendingSyncKeys: ['lift_1'] }, { parkedSets: [{ exerciseId: 'lift', setNumber: 1 }] }, {}]) {
    const root = historyTestDom()
    const props = { ...p, ...extra, allWeeks: [week], currentWeek: week,
      exerciseLogs: [...[1, 2, 3, 4, 5].map(set_number => row({ set_number })),
        ...[1, 2, 3].map(set_number => current({ set_number }))],
      logInputs: {}, setLogInputs() { assert.fail('comparison input write') },
      onLogSet() { assert.fail('comparison set write') }, parsePlannedRpe: () => null }
    const clock = { Date: { now: () => now }, setInterval() { assert.fail('unexpected timer') }, clearInterval() {} }
    const logs = props.exerciseLogs
    props.exerciseLogs = []
    const view = mountSession(root, () => props, { clock })
    try {
      button(root, 'Start dagens pas').click()
      props.exerciseLogs = logs; view.update()
      const finish = root.querySelectorAll('button').find(b => b.textContent === 'Afslut pas')
      finish?.click()
      const text = root.querySelector('[data-session-comparison]').textContent
      assert.match(text, extra.pendingSyncKeys || extra.parkedSets ? /5 sæt sidst, 2 sæt i dag/ : /5 sæt sidst, 3 sæt i dag/)
      assert.match(text, /Forskelligt antal sæt/)
      assert.doesNotMatch(text, /Samlet volumen:.*→/)
      assert.doesNotMatch(text, /1\.500 kg →/)
    } finally { view.dispose() }
    assert.equal(root.children.length, 0)
  }
})

test('controller confirmation snapshot gates only today, including in-flight saves', () => {
  const previous = row(), today = current(), otherToday = current({ set_number: 2 })
  const result = sessionComparisons(session, [previous, today, otherToday], p, now, [otherToday])[0]
  assert.equal(result.before.volume, 300)
  assert.equal(result.current.volume, 325)
  assert.equal(result.current.count, 1)
  assert.deepEqual(sessionComparisons(session, [previous, today], p, now, []), [])
})

test('pending keys are scoped to Copenhagen today across the UTC midnight boundary', () => {
  const previous = row({ logged_at: '2026-11-04T22:00:00Z' })
  const queuedToday = current({ logged_at: '2026-11-04T23:10:00Z' })
  const confirmedToday = current({ set_number: 2, logged_at: '2026-11-04T23:15:00Z' })
  const result = read([previous, queuedToday, confirmedToday], { pendingSyncKeys: ['lift_1'] },
    session, Date.parse('2026-11-04T23:30:00Z'))[0]
  assert.equal(result.previousDate, '2026-11-04')
  assert.equal(result.before.volume, 300)
  assert.equal(result.current.volume, 325)
})

test('latest skipped-only day uses the latest older attempted day, but invalid attempted data prevents fallback', () => {
  const older = row({ logged_at: '2026-10-28T10:00:00Z' })
  const skipped = [1, 2, 3].map(set_number => row({ set_number, skipped: true }))
  assert.equal(read([older, ...skipped, current()])[0].previousDate, '2026-10-28')
  assert.deepEqual(read([...skipped, current()]), [])
  assert.deepEqual(read([older, ...skipped, row({ set_number: 4, weight: null }), current()]), [])
})

test('production content marks both unequal directions and compares volume only for equal counts', () => {
  for (const [beforeCount, currentCount] of [[5, 3], [2, 3], [3, 2], [3, 3]]) {
    const logs = [...Array.from({ length: beforeCount }, (_, i) => row({ set_number: i + 1 })),
      ...Array.from({ length: currentCount }, (_, i) => current({ set_number: i + 1 }))]
    const doc = historyTestDom().ownerDocument
    const text = sessionComparisonContent((...args) => historyElement(doc, ...args), read(logs)).textContent
    if (beforeCount === currentCount) {
      assert.match(text, /3 bekræftede sæt/)
      assert.match(text, /Samlet volumen: 900 kg → 975 kg/)
      assert.doesNotMatch(text, /Forskelligt antal sæt/)
    } else {
      assert.ok(text.includes(`${beforeCount} sæt sidst, ${currentCount} sæt i dag`))
      assert.match(text, /Forskelligt antal sæt/)
      assert.doesNotMatch(text, /Samlet volumen:.*→/)
    }
  }
})
