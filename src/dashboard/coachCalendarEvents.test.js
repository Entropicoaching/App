import './coachCalendarLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { default: Calendar } = await import('./KalenderView.jsx')
const { default: Baseline } = await import('./coachCalendarBaseline.jsx')
const { coachCalendarDays } = await import('./coachCalendarEvents.mjs')
import { mount, nodes, text } from './coachCalendarDom.mjs'

const athletes = [
  { id: 'a', name: 'Alma', competition_date: '2026-11-08' },
  { id: 'b', name: 'Bo', competition_date: '2026-11-08' },
  { id: 'c', name: 'Clara', competition_date: null },
  { id: 'd', name: 'Dan' },
  { id: 'e', name: 'Eva', competition_date: '2026-10-31' },
]
const props = overrides => ({
  athletes, hiddenAthleteIds: new Set(), athleteCurrentWeek: {}, athleteLastLogs: {},
  calendarWeeks: {}, snoozedAthletes: {}, blockPlan: [], blockSequenceRows: [],
  calBlockAthlete: null, timelineEdit: null, openProfile() {}, ...overrides,
})
const render = overrides => mount(Calendar, props(overrides)).render()
const sections = tree => nodes(tree, n => n.type === 'section' && n.props['aria-label'] === 'Stævnedatoer')
const eventButtons = tree => sections(tree).flatMap(s => nodes(s, n => n.type === 'button'))

test('same-day athletes retain separate markers and dates sort chronologically', () => {
  assert.deepEqual(coachCalendarDays(athletes).map(d => [d.date, d.athletes.map(a => a.id)]), [
    ['2026-10-31', ['e']], ['2026-11-08', ['a', 'b']],
  ])
  const tree = render({ coachCalendarEvents: true })
  assert.deepEqual(nodes(tree, n => n.props['data-coach-event-day']).map(n => n.props['data-coach-event-day']), ['2026-10-31', '2026-11-08'])
  assert.deepEqual(eventButtons(tree).map(text), ['Eva · Stævne', 'Alma · Stævne', 'Bo · Stævne'])
})

test('actual calendar marker handlers open the matching athlete profile', () => {
  const calls = []
  const tree = render({ coachCalendarEvents: true, openProfile: (...args) => calls.push(args) })
  for (const button of eventButtons(tree)) button.props.onClick()
  assert.deepEqual(calls, [[athletes[4], 'stævne'], [athletes[0], 'stævne'], [athletes[1], 'stævne']])
})

test('missing dates and athletes without meets produce no markers', () => {
  const tree = render({ coachCalendarEvents: true, athletes: athletes.slice(2, 4) })
  assert.equal(eventButtons(tree).length, 0)
  assert.match(text(sections(tree)[0]), /Ingen stævnedatoer angivet/)
})

test('hidden athlete scope applies before grouping', () => {
  const tree = render({ coachCalendarEvents: true, hiddenAthleteIds: new Set(['a', 'e']) })
  assert.deepEqual(eventButtons(tree).map(text), ['Bo · Stævne'])
})

test('default, false and truthy nonboolean flags preserve exact baseline tree', () => {
  const baseline = mount(Baseline, props()).render()
  const json = tree => JSON.stringify(tree)
  for (const flag of [undefined, false, 1, 'true', {}]) {
    const tree = render({ coachCalendarEvents: flag })
    assert.equal(sections(tree).length, 0)
    assert.equal(json(tree), json(baseline))
  }
})

test('invalid and rollover dates are excluded; leap day is valid', () => {
  const dates = ['', '2026-02-29', '2026-04-31', 'bad', '2026-11-08T00:00:00Z', '2028-02-29']
  assert.deepEqual(coachCalendarDays(dates.map((competition_date, id) => ({ id: String(id), competition_date }))).map(d => d.date), ['2028-02-29'])
})

test('date-only markers retain exact dates across daylight-saving boundaries', () => {
  const tree = render({ coachCalendarEvents: true, athletes: ['2026-03-29', '2026-10-25'].map((competition_date, id) => ({ id: String(id), name: 'Test', competition_date })) })
  assert.deepEqual(nodes(tree, n => n.type === 'time').map(n => n.props.dateTime), ['2026-03-29', '2026-10-25'])
})

test('long and markup-like names remain text and keyboard-operable buttons', () => {
  const name = '<img onerror=fail>' + ' Langt navn'.repeat(30)
  const tree = render({ coachCalendarEvents: true, isMobile: true, athletes: [{ id: 'x', name, competition_date: '2026-11-08' }] })
  const [button] = eventButtons(tree)
  assert.equal(text(button), name + ' · Stævne')
  assert.equal(button.props.type, 'button')
  assert.equal(button.props.style.minHeight, 44)
  assert.equal(button.props.style.overflowWrap, 'anywhere')
  assert.equal(nodes(sections(tree)[0], n => n.type === 'img').length, 0)
})

test('new athlete props replace previous markers without cached data', () => {
  const view = mount(Calendar, props({ coachCalendarEvents: true }))
  assert.equal(eventButtons(view.render()).length, 3)
  assert.equal(eventButtons(view.render(props({ coachCalendarEvents: true, athletes: [] }))).length, 0)
})

test('helper does not mutate synthetic athlete input or inspect notes as dates', () => {
  const rows = Object.freeze([Object.freeze({ id: 'x', name: 'Testdag', notes: '2026-11-08' })])
  assert.deepEqual(coachCalendarDays(rows), [])
  assert.deepEqual(coachCalendarDays([]), [])
})
