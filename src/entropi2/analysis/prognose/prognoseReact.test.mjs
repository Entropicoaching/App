import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PrognoseView from './PrognoseView.mjs'

const history = Array.from({ length: 10 }, (_, i) => ({ exercise_id: `synthetic-${i}`,
  logged_at: new Date(Date.UTC(2026, 8, 2 + i * 7)).toISOString().slice(0, 10), weight: 100 + i, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }))
const html = extra => renderToStaticMarkup(h(PrognoseView, { entropi2: true, now: '2026-11-04',
  meetDate: '2026-11-18', fremgangLogs: history, ...extra }))

test('real React renders forecast and folded method without requiring integration', () => {
  const rendered = html()
  assert.match(rendered, /Skøn: 122 kg/)
  assert.match(rendered, /Usikkerhedsinterval:/)
  assert.match(rendered, /<label[^>]*>Stævnedato<input/)
  assert.match(rendered, /<details><summary/)
  assert.doesNotMatch(rendered, /<details open/)
})

test('real React renders empty and error states without fabricated numbers', () => {
  const empty = html({ fremgangLogs: [] })
  assert.equal((empty.match(/For lidt data/g) ?? []).length, 4)
  assert.doesNotMatch(empty, /Skøn:|Usikkerhedsinterval:/)
  const failed = html({ fremgangError: true })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /kunne ikke hentes/)
  assert.doesNotMatch(failed, /Skøn:/)
  assert.equal(html({ entropi2: false }), '')
})
