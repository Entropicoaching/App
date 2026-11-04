import test from 'node:test'
import assert from 'node:assert/strict'
import { homeCheckInScope } from './homeCheckInModel.mjs'
import { friendlyReminders } from '../paamindelser/reminderRules.mjs'
const props = { enabled: true, athleteId: 'synthetic-a', now: new Date('2026-11-04T12:00:00Z') }

test('local check-in uses Copenhagen Monday, independently of a training week', () => {
  assert.deepEqual(homeCheckInScope(props), { key: 'entropi2:checkin:v1:synthetic-a:2026-11-02',
    today: '2026-11-04', weekStart: '2026-11-02', minuteOfDay: 780 })
  assert.equal(homeCheckInScope({ ...props, now: new Date('2026-11-08T23:00:00Z') }).weekStart, '2026-11-09')
  assert.equal(homeCheckInScope({ ...props, now: new Date('2026-10-25T01:00:00Z') }).minuteOfDay, 120)
  for (const now of [null, undefined, 'bad', new Date('bad')]) assert.equal(homeCheckInScope({ ...props, now }), null)
  assert.notEqual(homeCheckInScope(props).key, homeCheckInScope({ ...props, athleteId: 'synthetic-b' }).key)
})

test('OFF, holiday and missing identity are inert', () => {
  const trap = { get now() { assert.fail('OFF clock access') }, get athleteId() { assert.fail('OFF identity access') } }
  assert.equal(homeCheckInScope({ enabled: false, get now() { return trap.now }, get athleteId() { return trap.athleteId } }), null)
  for (const extra of [{ enabled: false }, { enabled: 1 }, { onHoliday: true }, { athleteId: '' }])
    assert.equal(homeCheckInScope({ ...props, ...extra }), null)
  assert.deepEqual(friendlyReminders({ enabled: false, get localCheckin() { return trap.now } }), [])
})

test('only known empty local drafts produce one gentle reminder in the current week/window', () => {
  const base = { enabled: true, today: '2026-11-04', minuteOfDay: 780,
    localCheckin: { complete: true, status: 'empty', weekStart: '2026-11-02' } }
  assert.equal(friendlyReminders(base).length, 1)
  assert.equal(friendlyReminders(base)[0].title, 'Lyst til ugens check-in?')
  for (const status of ['saved', 'unavailable', undefined])
    assert.deepEqual(friendlyReminders({ ...base, localCheckin: { ...base.localCheckin, status } }), [])
  for (const extra of [{ paused: true }, { minuteOfDay: 1200 }, { today: '2026-11-09' },
    { today: '2026-11-01' }, { localCheckin: { ...base.localCheckin, weekStart: '2026-11-03' } },
    { localCheckin: { ...base.localCheckin, complete: false } }]) assert.deepEqual(friendlyReminders({ ...base, ...extra }), [])
  assert.deepEqual(friendlyReminders({ ...base, dismissedKeys: ['local-checkin:2026-11-02'] }), [])
})
