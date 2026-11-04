import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hvileLoader.mjs'
import { mount, nodes, text, button } from './hvileDom.mjs'
import { restDays, REST_DAY_TEXT, restDate } from './restDays.mjs'
install()
const { default: ProgramUtenFlag } = await import('./ProgramTab.jsx')
const Program = p => ProgramUtenFlag({ entropi2: false, hviledageListe: true, ...p })
const { default: CalendarUtenFlag } = await import('./WeekCalendar.jsx')
const Calendar = p => CalendarUtenFlag({ hviledageListe: true, ...p })
const helpers = await import('./ugeHjaelp.js')
const restRows = tree => nodes(tree, n => n.props['data-hviledag'] !== undefined)
const session = (weekday, exercises = [{ id: `ex-${weekday}`, name: 'Squat', sets: 2 }]) => ({ id: `s-${weekday}`, title: `Pas ${weekday}`, weekday, exercises })
const week = (sessions = [session(0)], coach_note) => ({ id: 'w0', week_number: 1, start_date: '2026-10-19', sessions, coach_note })
function propsFor(weeks = [week()]) {
  const p = { ...helpers, allWeeks: weeks, currentWeek: weeks[0], viewingWeekIdx: 0,
    athlete: { id: 'synthetic' }, exerciseLogs: [], pastLogs: [], progOpenSession: null,
    readinessLog: { readiness_score: 90 }, sessionRefs: { current: {} },
    dismissedFeedback: new Set(), feedbackInputs: {}, logInputs: {},
  }
  p.setViewingWeekIdx = n => { p.viewingWeekIdx = n }
  p.setProgOpenSession = n => { p.progOpenSession = n }
  p.setPastLogs = n => { p.pastLogs = n }
  p.fetchPastLogs = () => { throw Error('Unexpected historical read') }
  p.openSession = id => { p.progOpenSession = id }
  return p
}
const program = p => mount(Program, p).render()
const calendar = w => mount(Calendar, { week: w, weekStart: w ? helpers.weekStartDate([w], w.week_number) : null, exerciseLogs: [], onOpenSession() {} }).render()

test('known rest day: both actual views show the same neutral or coach text', () => {
  for (const note of [undefined, '', '   ', 'Rolig gåtur, hvis du har lyst.']) {
    const w = week([session(0), session(2, [])], note)
    for (const tree of [program(propsFor([w])), calendar(w)]) {
      const rows = restRows(tree)
      assert.equal(rows.length, 6)
      assert.ok(rows.every(row => text(row).includes(note?.trim() || REST_DAY_TEXT)))
      assert.ok(rows.every(row => !nodes(row, n => n.props.onClick || n.type === 'input' || n.type === 'button').length))
      assert.ok(rows.every(row => text(row).includes('Hviledag')))
    }
    assert.equal(nodes(calendar(w), n => n.props['data-dag'] === 'hvile').length, 6)
    assert.ok(!text(program(propsFor([w]))).includes('Pas 2'))
  }
})
test('seven training days produce no rest boxes; empty known week has seven rest days', () => {
  for (const [w, count] of [[week(Array.from({ length: 7 }, (_, i) => session(i))), 0], [week([]), 7]]) {
    assert.equal(restRows(program(propsFor([w]))).length, count)
    assert.equal(restRows(calendar(w)).length, count)
  }
})
test('missing program and failed fetch retain their own states and retry handler', () => {
  for (const failed of [false, true]) {
    const p = propsFor([]); p.programError = failed
    let retried = 0; p.fetchProgram = id => { assert.equal(id, 'synthetic'); retried++ }
    const tree = program(p)
    assert.equal(restRows(tree).length, 0)
    assert.match(text(tree), failed ? /Dit program kunne ikke hentes/ : /Dit program er på vej/)
    if (failed) { button(tree, 'Prøv igen').props.onClick(); assert.equal(retried, 1) }
  }
  assert.equal(calendar(undefined), null)
})
test('incomplete data, invalid weekdays and flexible sessions cannot establish calendar rest', () => {
  for (const w of [{}, { sessions: null }, week([session(0, null)]), week([session(0, undefined), { id: 'missing', weekday: 1 }]), week([session(null)]), week([session(8)]), week([session('0')])]) {
    assert.deepEqual(restDays(w), [])
    assert.equal(restRows(calendar(w)).length, 0)
    assert.equal(nodes(calendar(w), n => n.props['data-dag'] === 'hvile').length, 0)
  }
})
for (const start of ['2026-03-23', '2026-10-19']) test(`DST and next week keep calendar dates and actual navigation: ${start}`, t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(start + 'T12:00:00').getTime() })
  const w = { ...week(), start_date: start }
  const next = { ...week([session(1)]), id: 'w1', week_number: 2, start_date: null, coach_note: 'Næste uges rolige dage.' }
  const p = propsFor([w, next])
  const first = helpers.weekStartDate(p.allWeeks, 1)
  const second = helpers.weekStartDate(p.allWeeks, 2)
  const expected = new Date(first); expected.setDate(expected.getDate() + 7)
  assert.equal(second.getTime(), expected.getTime())
  assert.equal(restDate(first, 6), new Date(start + 'T12:00:00').getMonth() === 2 ? '29. mar.' : '25. okt.')
  for (const flag of [undefined, false, true]) {
    p.programUgeFoerst = flag; p.viewingWeekIdx = 0
    button(program(p), 'Næste uge →').props.onClick()
    assert.equal(p.viewingWeekIdx, 1)
    const tree = program(p)
    assert.match(text(tree), /Næste uges rolige dage/)
    assert.deepEqual(restRows(tree).map(n => n.props['data-hviledag']), [0, 2, 3, 4, 5, 6])
    assert.ok(text(restRows(tree)[0]).includes(restDate(second, 0)))
    assert.match(text(tree), /Pas 1/)
    const card = nodes(tree, n => n.type === 'div' && n.props.onClick && text(n).includes('Pas 1'))[0]
    card.props.onClick(); assert.equal(p.progOpenSession, 's-1')
    button(tree, '↩ Tilbage til denne uge').props.onClick(); assert.equal(p.viewingWeekIdx, 0)
  }
})
test('same-day training overrides an empty session and input data stays unchanged', () => {
  const w = week([session(0), session(0, [])], '<script>literal coach text</script>')
  const before = JSON.stringify(w)
  const tree = calendar(w)
  assert.ok(!restDays(w).some(day => day.weekday === 0))
  assert.equal(nodes(tree, n => n.type === 'script').length, 0)
  assert.ok(text(tree).includes(w.coach_note))
  assert.equal(JSON.stringify(w), before)
})
