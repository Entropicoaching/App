import assert from 'node:assert/strict'
import { install } from './forenkl6Loader.mjs'
import { mount, nodes, text, button } from './forenkl6Dom.mjs'
install()
export const { default: Program } = await import('./ProgramTab.jsx')
export const { default: Baseline } = await import('./forenkl6Baseline.jsx')
export const helpers = await import('./ugeHjaelp.js')
export function propsFor(start = '2026-10-19') {
  const startDate = new Date(start + 'T12:00:00')
  const next = new Date(startDate); next.setDate(next.getDate() + 7)
  const day = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const weeks = [start, day(next)].map((date, i) => ({
    id: `week-${i}`, week_number: i + 1, start_date: date, block_name: `Blok ${i}`,
    block_description: `Beskrivelse ${i}`, coach_note: `Ugenote ${i}`,
    sessions: [{ id: `session-${i}`, title: `Pas ${i}`, weekday: null, exercises: [] }],
  }))
  const p = { entropi2: false, ...helpers, allWeeks: weeks, currentWeek: weeks[0], viewingWeekIdx: 0,
    athlete: { id: 'synthetic-athlete' }, exerciseLogs: [], pastLogs: [],
    progOpenSession: null, readinessLog: { readiness_score: 90 }, sessionRefs: { current: {} },
    dismissedFeedback: new Set(), feedbackInputs: {}, logInputs: {},
  }
  p.setViewingWeekIdx = n => { p.viewingWeekIdx = n }
  p.setProgOpenSession = n => { p.progOpenSession = n }
  p.setPastLogs = n => { p.pastLogs = n }
  p.fetchPastLogs = (w, id) => { p.fetched = [w.id, id] }
  p.openSession = id => { p.progOpenSession = id }
  return p
}
export const render = p => mount(Program, p).render()
export const byType = (tree, type) => nodes(tree, n => n.type === type)
export function assertLayout(tree, title) {
  const details = byType(tree, 'details')
  assert.equal(details.length, 1)
  assert.equal(details[0].props.open, undefined, 'native details starts closed')
  assert.equal(byType(tree, 'summary').length, 1)
  assert.ok(text(tree).indexOf(title) < text(tree).indexOf('Blokinfo:'))
  assert.ok(!text(details[0]).includes(title), 'sessions are outside the fold')
  return details[0]
}

export function domShape(value) {
  if (typeof value === 'function') return '[handler]'
  if (Array.isArray(value)) return value.flatMap(v => {
    if (v?.type === null) return domShape(v.props.children)
    return [domShape(v)]
  })
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, domShape(v)]))
  return value
}
