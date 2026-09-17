import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldNudgeCheckin } from './checkinReminder.js'

const base = { weekStartStr: '2026-09-07', weekEndStr: '2026-09-13', loggedDates: [] }

test('ingen log denne uge, sidste dag af ugen → nudge', () => {
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-13' }), true)
})

test('ingen log denne uge, næstsidste dag af ugen → nudge', () => {
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-12' }), true)
})

test('ingen log denne uge, midt i ugen → ingen nudge endnu', () => {
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-09' }), false)
})

test('log findes allerede denne uge → aldrig nudge, selv sidste dag', () => {
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-13', loggedDates: ['2026-09-08'] }), false)
})

test('log fra en TIDLIGERE uge tæller ikke med', () => {
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-13', loggedDates: ['2026-08-30'] }), true)
})

test('i dag ligger uden for ugen (før eller efter) → ingen nudge', () => {
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-06' }), false)
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-14' }), false)
})

test('manglende ugedatoer → ingen nudge (ingen dato at regne ud fra)', () => {
  assert.equal(shouldNudgeCheckin({ weekStartStr: null, weekEndStr: null, todayStr: '2026-09-13', loggedDates: [] }), false)
})

test('log på præcis ugens sidste dag tæller med (inklusiv grænse)', () => {
  assert.equal(shouldNudgeCheckin({ ...base, todayStr: '2026-09-13', loggedDates: ['2026-09-13'] }), false)
})
