import { assertNoteDependencies } from '../coachNoteDependencyGuard.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nodes, text } from './kandFlet3Dom.mjs'
const { default: ForsideView } = await import('./ForsideView.jsx')
const { default: VideoReviewModal } = await import('./VideoReviewModal.jsx')
import { COACH_ACTIONS_ENABLED } from './coachActions.mjs'
import { COACH_NOTE_SIGNAL_ENABLED } from '../coachNoteSignal.js'
const noop = () => {}
function home(flag) {
  const opened = []
  const props = { athletes: [{ id: 'visible', name: 'Synlig' }, { id: 'hidden', name: 'Skjult' }],
    hiddenAthleteIds: new Set(['hidden']), calendarWeeks: {}, athleteCurrentWeek: {}, athleteLastLogs: {},
    athleteWeekCompletion: {}, athleteWeekSummary: {}, coachBriefingSeen: {}, coachPriorityItems: [],
    coachPriorityCount: 0, unreadCounts: {}, videoMeasurementByAthlete: {},
    latestByTrack: Object.fromEntries(['visible', 'hidden'].map(id => [id, { besked: { sender_role: 'athlete', created_at: '2020-01-01' } }])),
    coachActionsStatus: { calendar: 'ready', progress: 'ready' }, coachActions: flag,
    openCoachPriorityItem: (...args) => opened.push(args), openProfile: noop }
  return { tree: ForsideView(props), opened }
}
function modal(status, enabled, mobile = false) {
  const calls = []
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key === 'entropi:vc-review1' && enabled ? '1' : null } })
  try {
    const tree = VideoReviewModal({ videoAnalysisReview: { id: 'v', athlete_id: 'a', status, lift: 'squat', analyzed_at: '2026-10-26', bar_path: [], session_context: { athlete_note: '<img src=x>' } },
      isMobile: mobile, selectedAthlete: { id: 'a' }, videoBaselines: [], videoAnalyses: [], videoAnalysisFeedbackDraft: { works: '', focus: '', next_set: '' },
      reviewVideoAnalysis: (...args) => calls.push(args), saveVideoAnalysisFeedback: noop, discardVideoAnalysisFeedback: noop,
      closeVideoAnalysisReview: noop, setVideoAnalysisBaselineFindingId: noop, setVideoAnalysisCloseWarning: noop,
      setVideoAnalysisFeedbackDirty: noop, setVideoAnalysisFeedbackDraft: noop })
    return { tree, calls }
  } finally { if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage }
}
test('modproeve: actual home keeps both code flags OFF and rejects truthy values', () => {
  assert.equal(COACH_ACTIONS_ENABLED, false); assert.equal(COACH_NOTE_SIGNAL_ENABLED, false)
  for (const value of [undefined, false, 1, 'true', {}]) assert.equal(nodes(home(value).tree).some(n => n.props['data-coach-actions']), false)
})
test('modproeve: actual home excludes hidden athlete from actions and opens visible thread', () => {
  const { tree, opened } = home(true)
  const section = nodes(tree).find(n => n.props['data-coach-actions'])
  assert.ok(section); assert.match(text(section), /Synlig/); assert.doesNotMatch(text(section), /Skjult/)
  const buttons = nodes(section).filter(n => n.type === 'button'); assert.equal(buttons.length, 1)
  buttons[0].props.onClick(); assert.equal(opened[0][0].athlete.id, 'visible')
})
test('modproeve: imported modal renders both layouts and all statuses with same controls', () => {
  for (const mobile of [false, true]) for (const status of ['draft', 'coach_approved', 'shared', 'invalid']) {
    const off = modal(status, false, mobile).tree, on = modal(status, true, mobile).tree
    const controls = tree => nodes(tree).filter(n => ['button', 'textarea', 'input'].includes(n.type)).map(n => [n.type, n.props.disabled, n.type === 'button' ? text(n) : n.props.type])
    assert.deepEqual(controls(on), controls(off))
    assert.equal(nodes(off).filter(n => n.type === 'details').length, 0)
    assert.equal(nodes(on).filter(n => n.type === 'details').length, 1)
    assert.equal(nodes(on).find(n => n.type === 'details').props.open, undefined)
    assert.match(text(on), /<img src=x>/)
  }
})
test('modproeve: actual modal button forwards same analysis and status in both layouts', () => {
  for (const enabled of [false, true]) {
    const { tree, calls } = modal('draft', enabled)
    nodes(tree).find(n => n.type === 'button' && text(n) === 'Godkend til baseline').props.onClick()
    assert.equal(calls.length, 1); assert.equal(calls[0][0].id, 'v'); assert.equal(calls[0][1], 'coach_approved')
  }
})
test('modproeve: merged Dashboard retains coach note state and new actions state', () => {
  const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  for (const name of ['pendingByTrack', 'setPendingByTrack', 'coachActionsStatus', 'setCoachActionsStatus']) assert.ok(source.includes(name), name)
  const readerOptions = source.match(/lavLaesninger\(\{([\s\S]*?)\}\)/)?.[1]
  assert.ok(readerOptions)
  assert.match(readerOptions, /\bsetCoachActionsStatus,/)
})

test('notesignalets transitive kaede har ingen net eller lagring', () => {
  assertNoteDependencies(path => readFileSync(new URL('../' + path.slice(4), import.meta.url), 'utf8'))
})
