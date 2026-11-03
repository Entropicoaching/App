// Separate boundary checks against the exported module; synthetic data only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { friendlyReminders } from './reminderRules.mjs'

test('independent minute sweep matches the documented [09:00,20:00) window', () => {
  for (let minuteOfDay = 0; minuteOfDay < 1440; minuteOfDay++) {
    const result = friendlyReminders({ enabled: true, today: '2026-11-04', minuteOfDay,
      checkin: { complete: true, dueDate: '2026-11-04', submitted: false } })
    assert.equal(result.length, minuteOfDay >= 540 && minuteOfDay < 1200 ? 1 : 0, `${minuteOfDay}`)
  }
})

test('independent calendar-day sweep matches session and check-in expiry', () => {
  for (let age = -1; age <= 10; age++) {
    const today = `2026-11-${String(10 + age).padStart(2, '0')}`
    const result = friendlyReminders({ enabled: true, today, minuteOfDay: 540,
      sessions: { complete: true, items: [{ id: 'synthetic-id', date: '2026-11-10', registered: false }] },
      checkin: { complete: true, dueDate: '2026-11-10', submitted: false } })
    assert.equal(result.some(r => r.kind === 'session'), age >= 1 && age <= 3)
    assert.equal(result.some(r => r.kind === 'checkin'), age >= 0 && age <= 6)
  }
})

test('deep-frozen snapshots work, arbitrary session ID stays data, repeat calls are stable', () => {
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  const input = freeze({ enabled: true, today: '2026-11-04', minuteOfDay: 600,
    nutrition: { complete: true, observedFrom: '2026-11-01', loggedDays: [] },
    sessions: { complete: true, items: [{ id: '\ud800:synthetic', date: '2026-11-03', registered: false }] },
    checkin: { complete: true, dueDate: '2026-11-01', submitted: false } })
  const result = friendlyReminders(input)
  assert.equal(result.length, 3)
  assert.deepEqual(friendlyReminders(input), result)
  assert.equal(new Set(result.map(row => row.key)).size, 3)
})

test('calendar gaps do not mean elapsed 72 hours, and today cancels nutrition reminder', () => {
  const input = { enabled: true, today: '2026-03-30', minuteOfDay: 540,
    nutrition: { complete: true, observedFrom: '2026-03-27', loggedDays: [] } }
  assert.equal(friendlyReminders(input).length, 1)
  for (const loggedDays of [['2026-03-27'], ['2026-03-30']]) {
    assert.deepEqual(friendlyReminders({ ...input, nutrition: { ...input.nutrition, loggedDays } }), [])
  }
})
