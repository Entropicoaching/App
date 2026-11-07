// Actual copied grouping and calendar consumers; real React, syntax-only JSX bridge.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { coachCalendarDays } from './coachCalendarEvents.mjs'
import { meetSoonRows } from './coachMeetSoon.mjs'
import { entropi2CalendarRead, entropi2ReadContext } from '../entropi2/coachReadContext.mjs'
import { adaptCoachState } from '../entropi2/coach/coachModel.mjs'
import { installCalendarClarityLoader, calendarFixture } from './calendarClarityFixture.mjs'

const hooks = installCalendarClarityLoader(true)
test.after(() => hooks.deregister())
test.beforeEach(() => mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-25T12:00:00Z') }))
test.afterEach(() => mock.timers.reset())
const { default: Calendar } = await import('./KalenderView.jsx')
const { default: Events } = await import('./CoachCalendarEvents.jsx')
const row = (id, date = '2026-10-25', extra = {}) => Object.freeze({
  id, name: `Syntetisk ${id}`, competition_date: date, ...extra,
})
// Observe real React elements/markup, without substituting component or grouping logic.
function elements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)]
}
const section = html => html.match(/<section aria-label="Stævnedatoer"[\s\S]*?<\/section>/)?.[0] ?? ''
const buttons = html => [...section(html).matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1])
const render = props => renderToStaticMarkup(h(Calendar, calendarFixture({
  coachCalendarEvents: true, calendarWeeks: {}, ...props,
})))

test('pinned duplicate reproduction: one identical athlete ID/date, original row retained', () => {
  const athlete = row('synthetic-duplicate', '2026-10-25', { name: 'Syntetisk atlet' })
  const days = coachCalendarDays(Object.freeze([athlete, Object.freeze({ ...athlete }), athlete]))
  assert.equal(days.length, 1)
  assert.equal(days[0].athletes.length, 1)
  assert.strictEqual(days[0].athletes[0], athlete)
})

test('all six permutations: first conflicting row wins, first-seen athlete order is retained', () => {
  const rows = [
    row('synthetic-a', undefined, { name: 'Zulu', notes: 'first payload', hidden: false,
      user_id: 'synthetic-user-a', metadata: Object.freeze({ revision: 1 }) }),
    row('synthetic-a', undefined, { name: 'Alfa', notes: 'other payload', hidden: true,
      user_id: 'synthetic-user-b', metadata: Object.freeze({ revision: 2 }) }),
    row('synthetic-b'),
  ]
  const before = structuredClone(rows)
  for (const [order, kept] of [
    [[0, 1, 2], [0, 2]], [[0, 2, 1], [0, 2]], [[1, 0, 2], [1, 2]],
    [[1, 2, 0], [1, 2]], [[2, 0, 1], [2, 0]], [[2, 1, 0], [2, 1]],
  ]) {
    const input = Object.freeze(order.map(i => rows[i]))
    const days = coachCalendarDays(input)
    assert.deepEqual(days.map(d => d.date), ['2026-10-25'])
    assert.deepEqual(days[0].athletes, kept.map(i => rows[i]))
    kept.forEach((i, j) => assert.strictEqual(days[0].athletes[j], rows[i]))
    assert.deepEqual(input, order.map(i => before[i]))
  }
  assert.deepEqual(rows, before)
})

test('identity is athlete ID, not user ID/name; same ID on different days remains separate', () => {
  const late = row('synthetic-a', '2027-01-01', { name: 'Same', user_id: 'synthetic-user' })
  const early = row('synthetic-a', '2026-12-31', { name: 'Same', user_id: 'synthetic-user' })
  const other = row('synthetic-b', '2026-12-31', { name: 'Same', user_id: 'synthetic-user' })
  const days = coachCalendarDays(Object.freeze([late, early, other, late, early, other]))
  assert.deepEqual(days, [
    { date: '2026-12-31', athletes: [early, other] }, { date: '2027-01-01', athletes: [late] },
  ])
})

test('missing IDs and null/invalid dates do not reserve a key or create markers', () => {
  const valid = row('synthetic-a')
  const input = Object.freeze([
    null, undefined, row(undefined), row(null), row(''), row(0), row(false),
    ...[undefined, null, '', 'bad', '2026-02-29', '2026-04-31', '2026-10-25T00:00:00Z']
      .map(date => Object.freeze({ id: valid.id, competition_date: date })),
    valid, row(valid.id), row('synthetic-leap', '2028-02-29'),
  ])
  assert.deepEqual(coachCalendarDays(input), [
    { date: '2026-10-25', athletes: [valid] },
    { date: '2028-02-29', athletes: [input.at(-1)] },
  ])
  assert.deepEqual(coachCalendarDays(), [])
})

test('no per-call cache and no mutation of caller arrays or athlete payloads', () => {
  const a = row('synthetic-a'), b = row('synthetic-a', '2026-10-26')
  const input = Object.freeze([a, row(a.id), b])
  const before = structuredClone(input)
  const result = coachCalendarDays(input)
  result[0].athletes.length = 0
  result.reverse()
  assert.deepEqual(coachCalendarDays(input), [
    { date: '2026-10-25', athletes: [a] }, { date: '2026-10-26', athletes: [b] },
  ])
  assert.deepEqual(input, before)
  assert.deepEqual(coachCalendarDays([]), [])
  assert.strictEqual(coachCalendarDays([b])[0].athletes[0], b)
})

for (const isMobile of [false, true]) {
  test(`real Calendar/Events boundary: duplicates collapse and callbacks keep the first row (${isMobile})`, () => {
    const first = row('synthetic-a', undefined, { name: 'First' })
    const other = row('synthetic-b', undefined, { name: 'Other' })
    const next = row('synthetic-a', '2026-10-26', { name: 'Next day' })
    const calls = []
    const props = calendarFixture({ isMobile, coachCalendarEvents: true, calendarWeeks: {},
      athletes: Object.freeze([first, row(first.id, undefined, { name: 'Conflict' }), other, next]),
      openProfile: (...args) => calls.push(args) })
    assert.deepEqual(buttons(render(props)), ['First · Stævne', 'Other · Stævne', 'Next day · Stævne'])
    const [event] = elements(Calendar(props), n => n.type === Events)
    assert.ok(event)
    const controls = elements(event.type(event.props), n => n.type === 'button')
    assert.equal(controls.length, 3)
    controls.forEach(button => button.props.onClick())
    assert.equal(calls.length, 3)
    for (const [index, athlete] of [first, other, next].entries()) {
      assert.strictEqual(calls[index][0], athlete)
      assert.equal(calls[index][1], 'stævne')
    }
    assert.deepEqual(buttons(render({ ...props, athletes: [] })), [])
  })
}

test('actual consumer excludes missing IDs/null dates and applies hidden scope before grouping', () => {
  const a = row('synthetic-a'), b = row('synthetic-b')
  const athletes = Object.freeze([a, row(a.id), b, row(undefined), row('synthetic-null', null)])
  assert.deepEqual(buttons(render({ athletes, hiddenAthleteIds: new Set([a.id]) })), ['Syntetisk synthetic-b · Stævne'])
  assert.equal(section(render({ athletes, hiddenAthleteIds: new Set([a.id, b.id]) })), '')
})

test('actual Calendar guard still requires literal true and excludes tasks-only view', () => {
  const athletes = Object.freeze([row('synthetic-a'), row('synthetic-a')])
  const baseline = render({ athletes, coachCalendarEvents: false })
  for (const flag of [undefined, false, 1, 'true', {}]) {
    assert.equal(render({ athletes, coachCalendarEvents: flag }), baseline)
  }
  assert.equal(section(render({ athletes, tasksOnly: true })), '')
})

test('owner/read scope stays upstream and no markers survive a foreign owner or stale read', () => {
  const now = new Date('2026-10-25T12:00:00Z')
  const a = row('synthetic-a'), foreign = row('synthetic-foreign')
  const athletes = Object.freeze([a, row(a.id), foreign])
  const calendarWeeks = { [a.id]: [] }
  let status = { calendar: 'ready' }
  const setStatus = update => { status = update(status) }
  const read = entropi2CalendarRead({ enabled: true, coachId: 'synthetic-owner-a',
    athleteIds: [a.id, a.id, foreign.id], setStatus })
  read.done(calendarWeeks)
  const contextProps = { enabled: true, loading: false, loadError: false,
    coachId: 'synthetic-owner-a', athletes, calendarWeeks, coachActionsStatus: status }
  const readContext = entropi2ReadContext(contextProps)
  assert.ok(readContext)
  const state = { session: { user: { id: 'synthetic-owner-a' } }, readContext,
    athletes, hiddenAthleteIds: new Set([foreign.id]), calendarWeeks, coachActionsStatus: status }
  const own = adaptCoachState(state, now)
  assert.deepEqual(own.athletes.map(a => a.id), [a.id])
  assert.equal(buttons(render({ athletes: own.athletes })).length, 1)
  for (const patch of [
    { session: { user: { id: 'synthetic-owner-b' } } },
    { readContext: { ...readContext, day: '2026-10-24' } },
    { readContext: undefined },
  ]) {
    const closed = adaptCoachState({ ...state, ...patch }, now)
    assert.equal(section(render({ athletes: closed.athletes })), '')
  }
  assert.equal(entropi2ReadContext({ ...contextProps, coachId: 'synthetic-owner-b' }), undefined)
  // Grouping has no owner state of its own, including after a different roster call.
  assert.deepEqual(coachCalendarDays([foreign])[0].athletes, [foreign])
  assert.deepEqual(coachCalendarDays([a, a])[0].athletes, [a])
})

for (const [label, instants, dates] of [
  ['spring DST', ['2026-03-29T00:59:59.999Z', '2026-03-29T01:00:00Z'], ['2026-03-28', '2026-03-29', '2026-03-30']],
  ['autumn DST', ['2026-10-25T00:59:59.999Z', '2026-10-25T01:00:00Z'], ['2026-10-24', '2026-10-25', '2026-10-26']],
  ['year boundary', ['2026-12-31T22:59:59.999Z', '2026-12-31T23:00:00Z'], ['2026-12-31', '2027-01-01']],
]) {
  test(`${label}: actual grouping and consumer retain civil dates on either side of the instant`, () => {
    const rows = Object.freeze(dates.flatMap(date => [row('synthetic-a', date), row('synthetic-a', date)]).reverse())
    for (const instant of instants) {
      mock.timers.setTime(new Date(instant).getTime())
      assert.deepEqual(coachCalendarDays(rows).map(d => [d.date, d.athletes.length]), dates.map(d => [d, 1]))
      const html = section(render({ athletes: rows }))
      assert.deepEqual([...html.matchAll(/data-coach-event-day="([^"]+)"/g)].map(m => m[1]), dates)
      assert.deepEqual([...html.matchAll(/<time dateTime="([^"]+)"/g)].map(m => m[1]), dates)
      assert.equal(buttons(html).length, dates.length)
    }
  })
}

test('meetSoonRows keeps its distinct last-row-per-ID contract across dates and null dates', () => {
  const early = row('synthetic-a'), later = row('synthetic-a', '2026-10-26')
  const none = row('synthetic-a', null), now = new Date('2026-10-25T12:00:00Z')
  assert.deepEqual(coachCalendarDays([early, later]).map(d => d.date), ['2026-10-25', '2026-10-26'])
  for (const [input, winner, days] of [[[early, later], later, 1], [[later, early], early, 0]]) {
    const result = meetSoonRows({ athletes: Object.freeze(input), now })
    assert.equal(result.length, 1)
    assert.strictEqual(result[0].athlete, winner)
    assert.equal(result[0].days, days)
  }
  assert.deepEqual(meetSoonRows({ athletes: [early, none], now }), [])
  assert.deepEqual(coachCalendarDays([early, none])[0].athletes, [early])
})
