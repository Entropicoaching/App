import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobility-loader.mjs'
import { dom, button, nodes } from './synthetic-dom.mjs'
const hooks = install()
const { nextMobilitySession, mobilityModel } = await import('./mobility-model.mjs')
const { mountMobility } = await import('./mobility-screen.mjs')
const { findDagensPas } = await import('./public-nextSet.mjs')

const session = (id, weekday, order, name) => ({ id, weekday, session_order: order,
  exercises: [{ id: id + '-lift', name, sets: 2 }] })
const fixed = session('actual-first', 3, 1, 'Bench press')
const flexible = session('flexible-second', null, 2, 'Squat')
function options(sessions, changes = {}) {
  const week = { id: 'week', start_date: '2026-10-26', week_number: 1, sessions }
  return { enabled: true, athlete: { id: 'athlete' }, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], now: new Date('2026-10-29T12:00:00Z'), ...changes }
}
function check(p, expected, lift) {
  const before = JSON.stringify(p)
  const selected = nextMobilitySession(p)
  assert.equal(selected.session.id, expected)
  assert.equal(mobilityModel(p).lift, lift)
  const root = dom()
  const dispose = mountMobility(root, p)
  assert.equal(nodes(root, 'h2')[0].textContent, `Forbered din ${lift.toLowerCase()}`)
  button(root, 'Start mobilitet').click()
  assert.match(root.textContent, /1 af 2/)
  dispose()
  assert.equal(JSON.stringify(p), before)
  return selected
}

test('review reproduction: Thursday fixed before flexible keeps public selector priority', () => {
  const p = options([fixed, flexible])
  const expected = findDagensPas(p.allWeeks, p.currentWeek, p.exerciseLogs)
  assert.equal(expected.session.id, 'actual-first')
  assert.equal(check(p, expected.session.id, 'Bænkpres').date, '2026-10-29')
})

test('review positive: flexible first in supplied order stays first even with different order fields', () => {
  // The public selector consumes the supplied session order, not a new numeric sort.
  const p = options([flexible, fixed])
  const expected = findDagensPas(p.allWeeks, p.currentWeek, [])
  assert.equal(expected.session.id, flexible.id)
  assert.equal(check(p, expected.session.id, 'Squat').date, null)
})

test('review positive: completed first eligible session yields next eligible session', () => {
  for (const skipped of [false, true]) {
    const p = options([fixed, flexible], { exerciseLogs: [1, 2].map(set_number => ({
      exercise_id: 'actual-first-lift', set_number, skipped })) })
    const expected = findDagensPas(p.allWeeks, p.currentWeek, p.exerciseLogs)
    check(p, expected.session.id, 'Squat')
  }
})

test('review boundary: old and future sessions cannot displace today; zero sets do not hide it', () => {
  const empty = { ...session('zero', 3, 0, 'Squat'), exercises: [{ id: 'z', name: 'Squat', sets: 0 }] }
  const p = options([session('old', 0, 0, 'Squat'), session('future', 5, 0, 'Squat'), empty, fixed, flexible])
  check(p, fixed.id, 'Bænkpres')
})

test('review boundary: future/rest keeps calendar priority over supplied array order', () => {
  const p = options([session('sunday', 6, 1, 'Squat'), session('friday', 4, 2, 'Bench press')])
  assert.equal(check(p, 'friday', 'Bænkpres').date, '2026-10-30')
})

test('review boundary: Copenhagen midnight determines eligible day before applying session order', () => {
  const wednesday = session('wednesday', 2, 0, 'Squat')
  const p = options([wednesday, fixed, flexible], { now: new Date('2026-10-28T23:00:00Z') })
  check(p, fixed.id, 'Bænkpres')
  check({ ...p, now: new Date('2026-10-28T22:59:59Z') }, wednesday.id, 'Squat')
})

test('review boundary: strict OFF bypasses selector and handler inputs', () => {
  const poisoned = new Proxy({}, { get() { assert.fail('OFF read') } })
  for (const enabled of [undefined, false, 0, 'true']) {
    const p = { enabled, athlete: poisoned, allWeeks: poisoned, storage: poisoned }
    assert.equal(mobilityModel(p), null)
    const root = dom(); root.textContent = 'kept'
    mountMobility(root, p)()
    assert.equal(root.textContent, 'kept')
  }
})
test.after(() => hooks.deregister())
