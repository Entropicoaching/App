import test from 'node:test'
import assert from 'node:assert/strict'
import { friendlyReminders } from './reminderRules.mjs'

const base = (patch = {}) => ({ enabled: true, today: '2026-11-04', minuteOfDay: 600, ...patch })
const nutrition = (patch = {}) => ({ complete: true, observedFrom: '2026-11-01', loggedDays: [], ...patch })
const session = (patch = {}) => ({ id: 'synthetic-session', date: '2026-11-03', registered: false, ...patch })
const checkin = (patch = {}) => ({ complete: true, dueDate: '2026-11-04', submitted: false, ...patch })
const kinds = patch => friendlyReminders(base(patch)).map(r => r.kind)

test('OFF defaults and strict opt-in never inspect data', () => {
  assert.deepEqual(friendlyReminders(), [])
  assert.deepEqual(friendlyReminders(null), [])
  for (const enabled of [false, undefined, null, 1, 'true']) {
    assert.deepEqual(friendlyReminders({ enabled, get today() { throw Error('read while OFF') } }), [])
  }
})

test('daily window includes start and excludes end; quiet hours do not read snapshots', () => {
  for (const [minuteOfDay, expected] of [[539, 0], [540, 1], [1199, 1], [1200, 0], [1439, 0]]) {
    assert.equal(friendlyReminders(base({ minuteOfDay, checkin: checkin() })).length, expected)
  }
  assert.deepEqual(friendlyReminders({ ...base({ minuteOfDay: 0 }), get nutrition() { throw Error('quiet') } }), [])
  assert.deepEqual(friendlyReminders({ ...base({ paused: true }), get nutrition() { throw Error('paused') } }), [])
})

test('custom overnight window and invalid windows', () => {
  for (const [minuteOfDay, expected] of [[1319, 0], [1320, 1], [0, 1], [359, 1], [360, 0]]) {
    assert.equal(friendlyReminders(base({ minuteOfDay, window: { start: 1320, end: 360 }, checkin: checkin() })).length, expected)
  }
  for (const window of [null, {}, { start: 0, end: 0 }, { start: -1, end: 600 }, { start: 0, end: 1440 }]) {
    assert.deepEqual(kinds({ window, checkin: checkin() }), [])
  }
})

test('invalid or implicit local clock is quiet', () => {
  for (const today of [undefined, '', '2026-02-30', '2026-11-04T10:00:00Z', ' 2026-11-04', new Date()]) {
    assert.deepEqual(kinds({ today, checkin: checkin() }), [])
  }
  for (const minuteOfDay of [undefined, -1, 1440, NaN, 2.5, '600']) {
    assert.deepEqual(kinds({ minuteOfDay, checkin: checkin() }), [])
  }
})

test('nutrition requires coverage of three complete days; a log on any of those days or today suppresses it', () => {
  assert.deepEqual(kinds({ nutrition: nutrition() }), ['nutrition'])
  for (const day of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) {
    assert.deepEqual(kinds({ nutrition: nutrition({ loggedDays: [day] }) }), [])
  }
  assert.deepEqual(kinds({ nutrition: nutrition({ loggedDays: ['2026-10-31'] }) }), ['nutrition'])
  for (const patch of [{ observedFrom: '2026-11-02' }, { complete: false }, { loggedDays: null },
    { loggedDays: ['bad'] }, { loggedDays: ['2026-11-05'] }, { observedFrom: 'bad' }]) {
    assert.deepEqual(kinds({ nutrition: nutrition(patch) }), [])
  }
})

test('session window is the next three days after a planned session, never today or future', () => {
  for (const [date, expected] of [['2026-10-31', 0], ['2026-11-01', 1], ['2026-11-03', 1], ['2026-11-04', 0], ['2026-11-05', 0]]) {
    assert.equal(friendlyReminders(base({ sessions: { complete: true, items: [session({ date })] } })).length, expected)
  }
  for (const registered of [true, undefined, null, 0]) {
    assert.deepEqual(kinds({ sessions: { complete: true, items: [session({ registered })] } }), [])
  }
})

test('session selection is stable, one per type; unknown or malformed rows are quiet', () => {
  const items = [session(), session({ id: 'synthetic-earlier', date: '2026-11-02' }), null, session({ id: '' }), session({ date: 'bad' })]
  const result = friendlyReminders(base({ sessions: { complete: true, items } }))
  assert.equal(result.length, 1)
  assert.equal(result[0].sessionId, 'synthetic-earlier')
  assert.deepEqual(friendlyReminders(base({ sessions: { complete: true, items: [...items].reverse() } })), result)
  for (const sessions of [undefined, {}, { complete: false, items }, { complete: true, items: null }]) {
    assert.deepEqual(kinds({ sessions }), [])
  }
})

test('check-in has a seven-calendar-day window including due day', () => {
  for (const [dueDate, expected] of [['2026-10-28', 0], ['2026-10-29', 1], ['2026-11-04', 1], ['2026-11-05', 0]]) {
    assert.equal(friendlyReminders(base({ checkin: checkin({ dueDate }) })).length, expected)
  }
  for (const patch of [{ submitted: true }, { submitted: undefined }, { submitted: 0 }, { complete: false }, { dueDate: 'bad' }]) {
    assert.deepEqual(kinds({ checkin: checkin(patch) }), [])
  }
})

test('calendar arithmetic crosses month, leap day and daylight-saving changes', () => {
  for (const [today, observedFrom] of [['2026-11-01', '2026-10-29'], ['2024-03-02', '2024-02-28'],
    ['2026-03-30', '2026-03-27'], ['2026-10-26', '2026-10-23'], ['2027-01-02', '2026-12-30']]) {
    assert.deepEqual(kinds({ today, nutrition: nutrition({ observedFrom }) }), ['nutrition'])
  }
})

test('stable dismissals, deterministic order, neutral text, no mutation or output aliasing', () => {
  const input = base({ nutrition: nutrition(), sessions: { complete: true, items: [session()] }, checkin: checkin() })
  const before = structuredClone(input)
  const result = friendlyReminders(input)
  assert.deepEqual(result.map(r => r.kind), ['nutrition', 'session', 'checkin'])
  assert.deepEqual(friendlyReminders({ ...input, dismissedKeys: result.map(r => r.key) }), [])
  assert.deepEqual(friendlyReminders({ ...input, dismissedKeys: [result[1].key] }).map(r => r.kind), ['nutrition', 'checkin'])
  for (const row of result) assert.doesNotMatch(row.title + row.text, /skyld|burde|skal|glemt|mislykket/i)
  result[0].text = 'changed'
  assert.notEqual(friendlyReminders(input)[0].text, 'changed')
  assert.deepEqual(input, before)
})

test('absent data never implies missing activity', () => {
  assert.deepEqual(friendlyReminders(base()), [])
  for (const value of [null, {}, [], false, 'unknown']) {
    assert.deepEqual(kinds({ nutrition: value, sessions: value, checkin: value }), [])
  }
})
