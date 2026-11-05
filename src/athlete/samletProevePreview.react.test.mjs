// App npm test: genuine React SSR; no synthetic replacement for React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { assertCleanMarkup, assertNoWriteButtons } from './samletProeveMarkup.mjs'
import { scenario } from './samletProeveData.mjs'
import Analysis from '../entropi2/analysis/Analysis.mjs'

const hooks = installProgramReactLoader()
test.after(() => hooks.deregister())
const { default: Program } = await import('./ProgramTab.jsx')

for (const readOnly of [true, false]) {
  test(`React: timed Program keeps prescription; preview hides timer and writes: ${readOnly}`, () => {
    const props = programQolFixture({ readOnly, progOpenSession: 'session-1-0', readinessLog: null })
    Object.assign(props.currentWeek.sessions[0].exercises[0], { name: 'Planke', reps: '30 sek' })
    const html = renderToStaticMarkup(h(Program, props))
    assertCleanMarkup(html)
    assert.match(html, /Planke/)
    assert.match(html, /30 sek/)
    if (readOnly) {
      assertNoWriteButtons(html)
      assert.doesNotMatch(html, /Start timer|<input|<textarea|<select/)
    } else {
      assert.match(html, /Start timer/)
      assert.match(html, /Spring over/)
      assert.match(html, /Log dagens parathed/)
    }
  })
}

test('React: Analysis preview hides write shortcuts and copy, retaining program navigation and strict OFF', () => {
  const props = { entropi2: true, now: new Date('2026-11-04T12:00:00Z'),
    ...scenario('own', 'fremgang').seed, setTab() {} }
  props.fremgangLogs = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-11-03'].map((day, i) => ({
    exercise_id: 'synthetic-history-' + i, logged_at: day + 'T09:00:00Z', weight: 60 + i * 5, reps_completed: 3,
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Basis' } } },
  }))
  const own = renderToStaticMarkup(h(Analysis, props))
  assert.match(own, /data-analysis-copy/)
  assert.match(own, /data-analysis-destination="hjem"/)
  const preview = renderToStaticMarkup(h(Analysis, { ...props, readOnly: true }))
  assertCleanMarkup(preview)
  assertNoWriteButtons(preview)
  assert.match(preview, /Åbn program/)
  assert.doesNotMatch(preview, /data-analysis-copy|data-analysis-destination="hjem"/)
  assert.equal(renderToStaticMarkup(h(Analysis, { ...props, entropi2: false, readOnly: true })), '')
})
