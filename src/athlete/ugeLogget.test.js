import { useTestRelease } from '../trin1TestProfile.mjs'
// Explicit legacy profile, loaded before the component/handler fixture.
useTestRelease(0)
await import('../udgivelseTrin.mjs')
import { test } from 'node:test'
import assert from 'node:assert/strict'
const { install } = await import('./uge4Loader.mjs')
const { mount, nodes, text, createElement: h } = await import('./uge4Dom.mjs')
install()
const { renderUgeLogget } = await import('./ugeLogget.mjs')
const { default: UgensStatusKort } = await import('./UgensStatusKort.jsx')
const { default: EnkelHjemTab } = await import('./EnkelHjemTab.jsx')
const { previewNavigation } = await import('./enkelPrototype.mjs')
const session = (id, weekday, sets = 2) => ({ id, weekday, title: id, exercises: [{ id: 'ex-' + id, sets }] })
const week = { id: 'w1', week_number: 1, start_date: '2026-10-19', sessions: [session('a', 0), session('b', 1), session('c', 2)] }
const logs = [{ exercise_id: 'ex-a', set_number: 1 }, { exercise_id: 'ex-a', set_number: 2, skipped: true }, { exercise_id: 'ex-b', set_number: 1 }]
const cells = tree => nodes(tree, n => n.props['data-uge-dag'])
const render = overrides => renderUgeLogget(h, { enabled: true, week, exerciseLogs: logs, onOpenSession() {}, ...overrides })

test('strict default OFF does not read week or logs', () => {
  for (const enabled of [undefined, false, 1, 'true', null]) {
    assert.equal(renderUgeLogget(h, { enabled, get week() { throw Error('read') } }), null)
  }
  assert.equal(render({ week: null }), null)
})

test('seven days show all four states using the existing completion rule', () => {
  const tree = render()
  assert.deepEqual(cells(tree).map(n => n.props['data-uge-dag']), ['logget', 'delvist', 'mangler', 'hvile', 'hvile', 'hvile', 'hvile'])
  assert.match(cells(tree)[0].props['aria-label'], /Logget/)
  assert.match(cells(tree)[1].props['aria-label'], /Delvist logget/)
  assert.match(cells(tree)[2].props['aria-label'], /Ikke logget/)
  assert.match(text(tree), /Oversprungne sæt tæller som logget/)
})

test('click opens the first unfinished session, completed days remain openable, rest is disabled', () => {
  const calls = []
  const sameDay = { ...week, sessions: [session('a', 0), session('d', 0)] }
  const tree = render({ week: sameDay, onOpenSession: id => calls.push(id) })
  assert.equal(cells(tree)[0].props['data-uge-dag'], 'delvist')
  cells(tree)[0].props.onClick()
  cells(render({ onOpenSession: id => calls.push(id) }))[0].props.onClick()
  assert.deepEqual(calls, ['d', 'a'])
  assert.equal(cells(tree)[1].props.disabled, true)
  cells(tree)[1].props.onClick()
  assert.deepEqual(calls, ['d', 'a'])
})

test('local calendar dates cross both DST transitions and year boundary without mutating start', () => {
  for (const [start, dates] of [
    ['2026-03-23T12:00:00', [23,24,25,26,27,28,29]],
    ['2026-10-19T12:00:00', [19,20,21,22,23,24,25]],
    ['2026-12-28T12:00:00', [28,29,30,31,1,2,3]],
  ]) {
    const weekStart = new Date(start), before = weekStart.getTime()
    assert.deepEqual(cells(render({ weekStart })).map(n => Number(text(n.props.children[1]))), dates)
    assert.equal(weekStart.getTime(), before)
  }
})

test('actual week card rerenders with new week, logs and dates, and keeps strip above all views', () => {
  const props = { week, exerciseLogs: logs, ugeLogget: true, weekStart: new Date(2026,9,19,12), onOpenSession() {}, onAabnForloeb() {} }
  const card = mount(UgensStatusKort, props)
  const tree = card.render()
  assert.equal(tree.props.children[0].props['data-uge-logget'], 'w1')
  assert.equal(cells(tree)[0].props['data-uge-dag'], 'logget')
  const next = { id: 'w2', week_number: 2, sessions: [session('new', 0)] }
  const changed = card.render({ ...props, week: next, weekStart: new Date(2026,9,26,12) })
  assert.equal(changed.props.children[0].props['data-uge-logget'], 'w2')
  assert.equal(cells(changed)[0].props['data-uge-dag'], 'mangler')
  assert.match(cells(changed)[0].props['aria-label'], /26/)
  nodes(changed, n => n.type === 'button' && text(n) === 'Sidste uge')[0].props.onClick()
  assert.equal(cells(card.render()).length, 7)
  assert.equal(cells(card.render({ ...props, ugeLogget: false })).length, 0)
})

test('actual simple week view forwards explicit flag and uses the existing navigate handler', () => {
  const calls = []
  const setTab = previewNavigation(true, tab => calls.push(['tab', tab]), route => calls.push(['route', route]))
  const props = { enkelDel: 'uge', tab: 'hjem', allWeeks: [week], currentWeek: week,
    exerciseLogs: logs, athlete: { id: 'synthetic' }, setTab, openSession: id => calls.push(['session', id]) }
  const home = mount(EnkelHjemTab, props)
  assert.equal(cells(home.render()).length, 0)
  const tree = home.render({ ...props, ugeLogget: true })
  assert.equal(cells(tree).length, 7)
  cells(tree)[1].props.onClick()
  assert.deepEqual(calls, [['route', 'program'], ['tab', 'program'], ['session', 'b']])
})
