import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dayNumber, meetToday, readMeetSource } from './coachMeetSource.mjs'
import { assertPureGraph } from '../coachNoteDependencyGuard.mjs'
import { install } from './coachMeetLoader.mjs'
import { state, reset, walk, text } from './coachMeetFake.mjs'

const source = path => readFileSync(new URL('../' + path.slice(4), import.meta.url), 'utf8')

test('B1: actual pure module closure passes unchanged guard; React and host access fail closed', () => {
  assert.doesNotThrow(() => assertPureGraph('src/dashboard/coachMeetSource.mjs', source))
  for (const injected of ["import 'react'\n", 'globalThis.fetch()\n']) {
    assert.throws(() => assertPureGraph('src/dashboard/coachMeetSource.mjs', path =>
      source(path) + (path.endsWith('/coachMeetSource.mjs') ? injected : '')), /Unapproved|Impure/)
  }
  assert.throws(() => assertPureGraph('src/dashboard/coachMeetSource.mjs', path =>
    source(path) + (path.endsWith('/coachMeetSource.mjs') ? "\nimport './coachMeetSoon.mjs'" : '')), /Unapproved synthetic dependency react/)
})

test('B2: pure date helpers retain leap validation and Copenhagen DST midnight', () => {
  assert.equal(dayNumber('2026-02-29'), null)
  assert.equal(dayNumber('2028-02-29') + 1, dayNumber('2028-03-01'))
  assert.equal(meetToday(new Date('2026-03-29T22:30:00Z')), '2026-03-30')
  assert.equal(meetToday(new Date('2026-10-25T23:30:00Z')), '2026-10-26')
  assert.equal(meetToday(new Date(NaN)), null)
})

test('B3: OFF reader preserves promise identity and never inspects scope or setter', () => {
  const poison = new Proxy([], { get() { assert.fail('OFF accessed scope') } })
  for (const flag of [undefined, false, null, 0, 1, '1', 'true']) {
    const result = Promise.resolve({ data: [] })
    assert.equal(readMeetSource(flag, 'plan', poison, () => assert.fail('OFF setter'), () => result), result)
  }
})

test('B4: stale rejection cannot erase newer athlete scope or change returned error', async () => {
  let data = {}, rejectOld
  const setter = fn => { data = fn(data) }
  const old = readMeetSource(true, 'logs', ['old'], setter, () => new Promise((_, reject) => { rejectOld = reject }))
  const ids = ['new'], response = { data: [{ athlete_id: 'new' }], error: null }
  assert.equal(await readMeetSource(true, 'logs', ids, setter, () => response), response)
  ids.push('foreign')
  const problem = Error('synthetic old failure'); rejectOld(problem)
  await assert.rejects(old, error => error === problem)
  assert.deepEqual(data.logs.ids, ['new'])
  assert.equal(data.logs.state, 'ready')
  assert.equal(data.logs.rows, response.data)
})

install()
const facade = await import('./coachMeetSoon.mjs')
const { default: ForsideView } = await import('./ForsideView.jsx')

test('B5: facade retains exact pure function identities and default OFF', () => {
  assert.equal(facade.readMeetSource, readMeetSource)
  assert.equal(facade.meetToday, meetToday)
  assert.equal(facade.COACH_MEET_SOON_ENABLED, false)
  reset()
  assert.equal(facade.CoachMeetSoon({}), null)
  assert.equal(state.effects[0](), undefined)
})

test('B6: actual home preserves OFF DOM and filters hidden athlete before meet handler', () => {
  const a = { id: 'a', name: 'Visible', competition_date: '2026-10-28' }
  const b = { id: 'b', name: 'Hidden', competition_date: '2026-10-28' }
  const props = { athletes: [a, b], hiddenAthleteIds: new Set(['b']), calendarWeeks: {}, athleteCurrentWeek: {}, coachPriorityItems: [], coachBriefingSeen: {}, coachPriorityCount: 0, loading: true }
  const snapshot = tree => JSON.stringify(tree, (key, value) => typeof value === 'function' ? String(value) : value)
  assert.equal(snapshot(ForsideView(props)), snapshot(ForsideView({ ...props, coachMeetSoon: false })))
  const tree = ForsideView({ ...props, coachMeetSoon: true })
  const block = walk(tree, n => n.type === facade.CoachMeetSoon)
  assert.equal(block.length, 1)
  assert.deepEqual(block[0].props.athletes, [a])
})

test('B7: actual meet DOM passes original athlete, program tab and return view', () => {
  reset(); state.values = [new Date('2026-10-28T12:00:00Z')]
  const athlete = { id: 'a', name: '<synthetic>', competition_date: '2026-10-28' }, calls = []
  const tree = facade.CoachMeetSoon({ enabled: true, athletes: [athlete], openProfile: (...args) => calls.push(args) })
  const buttons = walk(tree, n => n.type === 'button')
  assert.equal(buttons.length, 1)
  assert.match(text(tree), /<synthetic>/)
  buttons[0].props.onClick()
  assert.deepEqual(calls, [[athlete, 'program', 'list']])
})
