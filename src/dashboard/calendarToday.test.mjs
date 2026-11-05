import './coachCalendarLoader.mjs'
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import * as dates from './calendarWeekDate.mjs'
const { calendarToday, createWeekDate, createTimelineScale, focusTimelineToday } = dates
import { mount, nodes, text } from './coachCalendarDom.mjs'
const { default: Calendar } = await import('./KalenderView.jsx')
const props = extra => ({ athletes: [{ id: 'synthetic-a', name: 'Syntetisk atlet' }], hiddenAthleteIds: new Set(),
  athleteCurrentWeek: {}, athleteLastLogs: {}, snoozedAthletes: {}, blockPlan: [], blockSequenceRows: [],
  calendarWeeks: { 'synthetic-a': [{ week_number: 1, start_date: '2026-11-02', exercise_count: 1 }] }, ...extra })
const at = (instant, run) => {
  mock.timers.enable({ apis: ['Date'], now: new Date(instant) })
  try { return run() } finally { mock.timers.reset() }
}
const render = extra => mount(Calendar, props(extra)).render()
const day = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

test('Danish midnight, summer time and year boundary select the displayed date', () => {
  for (const [instant, expected] of [
    ['2026-11-04T22:59:00Z', '2026-11-04'], ['2026-11-04T23:00:00Z', '2026-11-05'],
    ['2026-03-28T23:30:00Z', '2026-03-29'], ['2026-10-24T22:30:00Z', '2026-10-25'],
    ['2026-12-31T23:15:00Z', '2027-01-01'],
  ]) assert.equal(day(calendarToday(new Date(instant))), expected)
})

test('actual calendar shows one day line above every row and one current-week column at both widths', () => {
  at('2026-11-04T23:05:00Z', () => {
    for (const isMobile of [true, false]) {
      const tree = render({ isMobile })
      assert.match(text(tree), /I dag.*torsdag 5. november/)
      const [line] = nodes(tree, n => n.props['data-calendar-today'])
      assert.equal(line.props['data-calendar-today'], '2026-11-05')
      assert.equal(nodes(tree, n => n.props['data-calendar-today']).length, 1)
      assert.equal(line.props.style.pointerEvents, 'none')
      assert.equal(line.props.style.width, 2)
      assert.equal(line.props.style.zIndex, 2)
      const [week] = nodes(tree, n => n.props['data-calendar-current-week'])
      assert.equal(week.props['data-calendar-current-week'], '2026-11-02')
      assert.equal(nodes(tree, n => n.props['aria-current'] === 'date').length, 1)
      assert.equal(line.props.style.left, (1 + 3.5 / 7) * (isMobile ? 40 : 48))
      const [track] = nodes(tree, n => n.props['aria-label'] === 'Kalenderens tidslinje')
      const element = { clientWidth: 100, scrollWidth: 1000, scrollLeft: 0 }
      track.props.ref(element)
      assert.ok(element.scrollLeft > 0)
      element.scrollLeft = 250
      track.props.ref(null); track.props.ref(element)
      assert.equal(element.scrollLeft, 250, 'reattaching on hover does not undo manual scrolling')
      const reopened = { clientWidth: 100, scrollWidth: 1000, scrollLeft: 0 }
      track.props.ref(reopened)
      assert.ok(reopened.scrollLeft > 0, 'opening a new track focuses today again')
    }
  })
})

test('bounded history and distant future keep today visible and preserve stored input', () => {
  for (const dates of [['2020-01-06'], ['2035-01-01'], ['2020-01-06', '2035-01-01']]) {
    const wks = dates.map((start_date, i) => ({ week_number: i + 1, start_date }))
    const before = structuredClone(wks)
    const scale = createTimelineScale([{ wks, weekDate: createWeekDate(wks) }], new Date('2026-11-05T12:00:00'), 40)
    assert.equal(scale.nCols, 60)
    assert.ok(scale.todayCol >= 0 && scale.todayCol < 60)
    assert.ok(scale.todayLeft > 0 && scale.todayLeft < scale.trackW)
    scale.cols.forEach((date, i) => assert.equal(scale.colOf(date), i))
    assert.deepEqual(wks, before)
  }
})

test('empty, undated, invalid and hidden calendars do not invent dated rows', () => {
  for (const extra of [{ athletes: [] }, { calendarWeeks: {} },
    { calendarWeeks: { 'synthetic-a': [{ week_number: 1 }] } }, { hiddenAthleteIds: new Set(['synthetic-a']) }]) {
    const tree = render(extra)
    assert.match(text(tree), /Ingen atleter med datoer endnu/)
    assert.equal(nodes(tree, n => n.props['data-calendar-today']).length, 0)
    const modern = render({ entropi2: true, loading: false, calendarStatus: 'ready', calendarReady: true, ...extra })
    assert.match(text(modern), extra.athletes?.length === 0 || extra.hiddenAthleteIds
      ? /Ingen synlige atleter/ : /Ingen atleter med datoer endnu/)
    assert.equal(nodes(modern, n => n.props['data-calendar-today']).length, 0)
  }
  for (const start_date of ['bad', '2026-02-30', '2026-11-05T12:00:00Z']) {
    const tree = render({ calendarWeeks: { 'synthetic-a': [{ week_number: 1, start_date }] } })
    assert.match(text(nodes(tree, n => n.props.role === 'alert')[0]), /Startdato kunne ikke vises/)
    assert.equal(nodes(tree, n => n.props['data-calendar-today']).length, 0)
  }
  assert.ok(createWeekDate([{ week_number: 1, start_date: '2028-02-29' }]))
})

test('tasks-only inbox never mounts a scrolling timeline; event flag remains strict OFF', () => {
  assert.equal(nodes(render({ tasksOnly: true }), n => typeof n.props.ref === 'function').length, 0)
  for (const coachCalendarEvents of [undefined, false, 1, 'true']) {
    assert.equal(nodes(render({ coachCalendarEvents }), n => n.props['aria-label'] === 'Stævnedatoer').length, 0)
  }
})

test('scrolling clamps at both ends, waits for layout, and refocuses on a new day', () => {
  focusTimelineToday(null, 100, '2026-11-05')
  const node = { clientWidth: 0, scrollWidth: 400, scrollLeft: 0 }
  focusTimelineToday(node, 200, '2026-11-05')
  node.clientWidth = 100
  focusTimelineToday(node, 200, '2026-11-05'); assert.equal(node.scrollLeft, 150)
  focusTimelineToday(node, 5, '2026-11-05'); assert.equal(node.scrollLeft, 0)
  focusTimelineToday(node, 999, '2026-11-06'); assert.equal(node.scrollLeft, 300)
  node.scrollWidth = 40
  focusTimelineToday(node, 5, '2026-11-07'); assert.equal(node.scrollLeft, 0)
})
