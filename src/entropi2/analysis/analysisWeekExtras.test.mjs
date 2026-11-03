import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './testRender.mjs'
import RawAnalysis from './Analysis.mjs'
import { analysisWeekExtras } from './analysisWeekExtras.mjs'
import { weekProgressSentence } from './weekProgressSentence.mjs'
import { weeklyShareSummary } from './weeklyShareSummary.mjs'
import { weeklyLoad } from './weeklyLoad.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const currentWeek = { start_date: '2026-11-02', block_name: 'Deload',
  sessions: [{ exercises: [{ id: 'local', name: 'Squat', sets: 1 }] }] }
const local = { id: 'current', exercise_id: 'local', set_number: 1,
  logged_at: '2026-11-03T10:00:00Z', weight: 100, reps_completed: 10 }
const history = ['2026-10-13', '2026-10-20', '2026-10-27'].map((logged_at, i) => ({
  id: `history-${i}`, exercise_id: `old-${i}`, logged_at, weight: 50, reps_completed: 10,
}))
const props = extra => ({ entropi2: true, now, currentWeek, exerciseLogs: [local],
  fremgangLogs: history, ...extra })
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]
const copyButton = p => nodes(RawAnalysis(p)).find(n => n.props?.['data-analysis-copy'])

test('integration: actual sentence immediately follows heading; share is folded and no graph is added', () => {
  const p = props(), tree = RawAnalysis(p), dom = Analysis(p)
  assert.equal(tree.props.children[1].props.children, weekProgressSentence(p, now))
  assert.equal(dom.querySelectorAll('[data-analysis-progress]').length, 1)
  assert.equal(dom.querySelectorAll('[data-analysis-load]').length, 1)
  assert.match(dom.querySelectorAll('[data-analysis-load]')[0].textContent, /1.000 kg tonnage.*2 gange.*ufuldstændig/)
  const share = nodes(tree).find(n => n.props?.['data-analysis-share'])
  assert.equal(share.type, 'details')
  assert.equal(share.props.open, undefined)
  assert.equal(nodes(share).find(n => n.type === 'pre').props.children, weeklyShareSummary(p, now))
  assert.equal(copyButton(p).props.style.minHeight, 44)
  assert.equal(dom.querySelectorAll('svg').length, 0)
  const without = Analysis(props({ fremgangLogs: [] }))
  assert.equal(dom.querySelectorAll('figure').length, without.querySelectorAll('figure').length)
})

test('load integration keeps light/deload rows and local edits/undo own saved rows', () => {
  const p = props({ fremgangLogs: [...history, { ...local, weight: 900 }] })
  const expected = weeklyLoad([...history, local], now)
  assert.equal(expected.acuteChronicRatio, 2)
  assert.match(analysisWeekExtras(p, now).load, /2 gange/)
  assert.equal(analysisWeekExtras({ ...p, exerciseLogs: [] }, now).load, null)
  assert.equal(analysisWeekExtras({ ...p, exerciseLogs: [{ ...local, _optimistic: true }] }, now).load, null)
  assert.equal(analysisWeekExtras({ ...p, exerciseLogs: [{ ...local, weight: null }] }, now).load, null)
  for (const exerciseLogs of [
    [local, { ...local, id: 'retry', _optimistic: true }],
    [{ ...local, id: 'retry', _optimistic: true }, local],
    [local, { ...local, id: 'retry', weight: 900 }],
  ]) assert.equal(analysisWeekExtras({ ...p, exerciseLogs }, now).load, null)
  assert.match(analysisWeekExtras({ ...p, exerciseLogs: [local, { ...local, id: 'retry' }] }, now).load, /2 gange/)
})

test('insufficient, missing, loading, invalid and conflicting load data produce no line', () => {
  for (const extra of [
    { fremgangLogs: history.slice(1) }, { fremgangLogs: undefined },
    { fremgangLoading: true }, { now: new Date('invalid') },
    { fremgangLogs: [...history, { ...history[0], weight: 999 }] },
    { fremgangLogs: history.map(r => ({ ...r, weight: 0 })) },
  ]) assert.equal(Analysis(props(extra)).querySelectorAll('[data-analysis-load]').length, 0)
  assert.equal(Analysis(props({ exerciseLogs: [] })).querySelectorAll('[data-analysis-progress]').length, 0)
})

test('copy action writes exact module text only on click and reports success after completion', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const calls = []
  let finish
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    clipboard: { writeText(text) { calls.push(text); return new Promise(resolve => { finish = resolve }) } },
  } })
  try {
    const p = props(), button = copyButton(p)
    assert.deepEqual(calls, [])
    const target = { textContent: 'Del ugen', disabled: false }
    const action = button.props.onClick({ currentTarget: target })
    assert.equal(target.disabled, true)
    assert.equal(target.textContent, 'Del ugen')
    assert.deepEqual(calls, [weeklyShareSummary(p, now)])
    assert.equal(await button.props.onClick({ currentTarget: target }), false)
    finish()
    assert.equal(await action, true)
    assert.equal(target.textContent, 'Ugen er kopieret')
    assert.equal(target.disabled, false)
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete globalThis.navigator
  }
})

test('unavailable/rejected clipboard gives actionable feedback and keeps text available', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  try {
    for (const clipboard of [undefined, { writeText() { throw Error('denied') } },
      { writeText: async () => { throw Error('denied') } }]) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } })
      const target = { textContent: 'Del ugen', disabled: false }
      assert.equal(await copyButton(props()).props.onClick({ currentTarget: target }), false)
      assert.equal(target.textContent, 'Kunne ikke kopiere. Markér teksten ovenfor.')
      assert.equal(target.disabled, false)
      assert.equal(Analysis(props()).querySelectorAll('pre')[0].textContent, weeklyShareSummary(props(), now))
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete globalThis.navigator
  }
})

test('OFF reads no data or clipboard; ON does not mutate frozen snapshots', () => {
  for (const entropi2 of [false, undefined, 'true', 1]) {
    assert.equal(RawAnalysis({ entropi2,
      get currentWeek() { throw Error('OFF read') }, get now() { throw Error('OFF clock') },
    }), null)
  }
  const p = props({ exerciseLogs: Object.freeze([Object.freeze({ ...local })]),
    fremgangLogs: Object.freeze(history.map(row => Object.freeze({ ...row }))) })
  const before = JSON.stringify(p)
  Analysis(Object.freeze(p))
  assert.equal(JSON.stringify(p), before)
})
