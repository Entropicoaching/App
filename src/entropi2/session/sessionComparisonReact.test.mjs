import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { sessionComparisons } from './sessionComparison.mjs'
import { sessionComparisonContent } from './sessionComparisonContent.mjs'
import SessionScreen from './SessionScreen.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'

const now = Date.parse('2026-11-05T12:00:00Z')
function fixture() {
  const session = { id: 'session', exercises: [{ id: 'lift', name: 'Løft A', sets: 3, reps: 5 }] }
  const week = { id: 'week', sessions: [session] }
  const logs = ['2026-11-04', '2026-11-05'].map((day, i) => ({ athlete_id: 'synthetic', exercise_id: 'lift',
    set_number: i + 1, weight: 60 + 5 * i, reps_completed: 5, logged_at: `${day}T10:00:00Z` }))
  const p = { enabled: true, athleteId: 'synthetic', allWeeks: [week], currentWeek: week, exerciseLogs: logs,
    logInputs: {}, setLogInputs() { assert.fail('summary wrote inputs') },
    onLogSet() { assert.fail('summary saved a set') }, parsePlannedRpe: () => null }
  return { session, p }
}

// Mandatory real dependencies: no stubs, loaders, conditional skips or substitutes.
test('real React renders the production comparison content, escaped names and empty data', () => {
  const { session, p } = fixture()
  const render = () => renderToStaticMarkup(sessionComparisonContent(h, sessionComparisons(session, p.exerciseLogs, p, now)))
  const html = render()
  assert.match(html, /aria-label="Sammenligning med sidst"/)
  assert.match(html, /60 kg × 5 → 65 kg × 5/)
  assert.match(html, /300 kg → 325 kg/)
  assert.match(html, /<details[^>]*><summary[^>]*>Løft A · Tungeste sæt: 60 kg × 5 → 65 kg × 5<\/summary>/)
  assert.doesNotMatch(html, /<details[^>]*\sopen/)
  session.exercises[0].name = '<img src=x onerror=alert(1)>'
  assert.match(render(), /&lt;img/); assert.doesNotMatch(render(), /<img/)
  p.exerciseLogsError = true; assert.equal(render(), '')
  p.enabled = false; assert.equal(render(), '')
})

test('real React labels unequal counts in either direction without a total volume arrow', () => {
  for (const [beforeCount, currentCount] of [[5, 3], [2, 3], [3, 2]]) {
    const { session, p } = fixture()
    p.exerciseLogs = [
      ...Array.from({ length: beforeCount }, (_, i) => ({ ...p.exerciseLogs[0], set_number: i + 1 })),
      ...Array.from({ length: currentCount }, (_, i) => ({ ...p.exerciseLogs[1], set_number: i + 1 }))]
    const html = renderToStaticMarkup(sessionComparisonContent(h, sessionComparisons(session, p.exerciseLogs, p, now)))
    assert.ok(html.includes(`${beforeCount} sæt sidst, ${currentCount} sæt i dag`))
    assert.match(html, /Forskelligt antal sæt/)
    assert.doesNotMatch(html, /Samlet volumen:.*→/)
  }
})

test('real React SessionScreen opens summary, refreshes comparison, resumes and cleans up while OFF', async () => {
  const { p } = fixture(), doc = sessionReactDocument(), host = doc.createElement('div'), timers = new Set()
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const original = Object.fromEntries(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const dateNow = Date.now
  Date.now = () => now
  const root = createRoot(host)
  const render = () => act(async () => root.render(h(SessionScreen, { ...p })))
  const comparison = () => host.querySelector('[data-session-comparison]')
  const press = async label => {
    const b = host.querySelectorAll('button').find(node => node.textContent === label)
    assert.ok(b, label); assert.equal(b.disabled, false)
    await act(async () => b.click())
  }
  try {
    await render(); await press('Start dagens pas'); assert.equal(comparison(), null)
    await press('Afslut pas'); assert.match(comparison().textContent, /300 kg → 325 kg/)
    assert.equal(doc.activeElement, host.querySelector('[data-heading]'))
    let fold = comparison().querySelector('details')
    assert.equal(fold.open, false)
    fold.open = true; fold.querySelector('summary').focus(); await render()
    fold = comparison().querySelector('details')
    assert.equal(fold.open, true)
    assert.equal(doc.activeElement, fold.querySelector('summary'))
    const previous = p.exerciseLogs[0], today = p.exerciseLogs[1]
    p.exerciseLogs = [...[1, 2, 3].map(set_number => ({ ...previous, set_number })), today]
    for (const unavailable of [{ pendingSyncKeys: ['lift_1'], parkedSets: [] },
      { pendingSyncKeys: [], parkedSets: [{ exerciseId: 'lift', setNumber: 1 }] }]) {
      Object.assign(p, unavailable); await render()
      assert.match(comparison().textContent, /3 sæt sidst, 1 sæt i dag/)
      assert.match(comparison().textContent, /Forskelligt antal sæt/)
      assert.doesNotMatch(comparison().textContent, /Samlet volumen:.*→/)
    }
    p.pendingSyncKeys = []; p.parkedSets = []; p.exerciseLogs = [previous, today]; await render()
    p.exerciseLogsLoading = true; await render(); assert.equal(comparison(), null)
    p.exerciseLogsLoading = false; await render(); assert.ok(comparison())
    await press('Fortsæt passet'); assert.equal(comparison(), null)
    await press('Afslut pas'); assert.ok(comparison())
    p.enabled = false; await render(); assert.equal(host.querySelector('dialog'), null)
    assert.equal(timers.size, 0)
  } finally {
    await act(async () => root.unmount())
    Date.now = dateNow
    for (const [key, value] of Object.entries(original)) {
      if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]
    }
  }
  assert.equal(host.children.length, 0); assert.equal(timers.size, 0)
})
