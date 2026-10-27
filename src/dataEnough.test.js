import test from 'node:test'
import assert from 'node:assert/strict'
import { dataEnoughEnabled, dataAllowed, hasEnoughData, readinessBasis, lowStreak,
  weightWindows, renderDataInsight, DATA_MESSAGES } from './dataEnough.mjs'
import { compareReadiness, readinessTrainingNote } from './readinessInsight.js'

const date = d => new Date(Date.UTC(2026, 9, 26 + d)).toISOString().slice(0, 10)
const row = d => ({ logged_date: date(d), readiness_score: 40, energy: 3,
  motivation: 3, stress: 3, soreness_level: 3, sleep_hours: 8 })
function withFlag(value, fn) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'location')
  try { Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: value ? '?appData2=1' : '' } }); return fn() }
  finally { if (before) Object.defineProperty(globalThis, 'location', before); else delete globalThis.location }
}
test('APP-DATA2 defaults off and leaves legacy readiness comparison unchanged', () => withFlag(false, () => {
  assert.equal(dataEnoughEnabled(), false)
  assert.equal(compareReadiness(80, [40, 40, 40, 40, 40]).status, 'over')
  for (const id of Object.keys(DATA_MESSAGES)) assert.equal(dataAllowed(id), true)
}))
test('APP-DATA2 unknown evidence cannot enable any interpretation', () => withFlag(true, () => {
  for (const id of Object.keys(DATA_MESSAGES)) assert.equal(dataAllowed(id, {}), false, id)
}))
test('APP-DATA2 compares five separate, comparable prior dates in fourteen days', () => withFlag(true, () => {
  const current = row(0), history = [-1, -2, -3, -4, -14].map(row)
  assert.equal(readinessBasis(current, history).length, 5)
  assert.equal(compareReadiness(40, [], current, history).status, 'normal')
  assert.equal(compareReadiness(40, [], current, history.slice(1)).status, 'insufficient')
  assert.equal(compareReadiness(40, [], current, history.map(r => ({ ...r, logged_date: date(-15) }))).status, 'insufficient')
  assert.equal(compareReadiness(40, [], current, history.map(r => ({ ...r, sleep_hours: null }))).status, 'insufficient')
  assert.equal(readinessTrainingNote('over'), null)
}))
test('APP-DATA2 a calendar hole or duplicate breaks a low streak', () => {
  assert.equal(lowStreak([-1, -2, -3].map(row)), 3)
  assert.equal(lowStreak([-1, -3, -4].map(row)), 1)
  assert.equal(lowStreak([-1, -1, -2].map(row)), 0)
})
test('APP-DATA2 plan and unknown RPE are excluded despite a large count', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ logged_at: date(-1), session_id: 's' + i,
    rpe_actual: 8, rpe_source: i % 2 ? 'plan' : undefined }))
  assert.equal(hasEnoughData('D12', { rows, today: date(0) }), false)
})
test('APP-DATA2 strength needs four qualified dates and twenty-one elapsed days', () => {
  const rows = [-1, -8, -15, -22].map(d => ({ dag: date(d), e1rm: 100, qualified: true, lift: 'Squat', repZone: 3 }))
  assert.equal(hasEnoughData('D18', { rows }), true)
  assert.equal(hasEnoughData('D18', { rows: rows.slice(1) }), false)
  assert.equal(hasEnoughData('D18', { rows: rows.map(r => ({ ...r, dag: date(-1) })) }), false)
})
test('APP-DATA2 weight compares distinct days in two completed disjoint windows', () => {
  const rows = [-1, -3, -7, -8, -10, -14].map(d => ({ logged_at: date(d), weight: 80 }))
  assert.equal(weightWindows(rows, date(0)).ready, true)
  assert.equal(weightWindows(rows.slice(1), date(0)).ready, false)
  assert.equal(weightWindows(rows.map(r => ({ ...r, logged_at: date(-1) })), date(0)).ready, false)
})
test('APP-DATA2 synthetic DOM fallback is text, and blocked value is not evaluated', () => withFlag(true, () => {
  let calls = 0
  const node = renderDataInsight((tagName, attrs, textContent) => ({ tagName, attrs, textContent }), 'D69', {}, () => { calls++; return 'forecast' })
  assert.equal(calls, 0)
  assert.equal(node.tagName, 'p')
  assert.match(node.textContent, /Grundlag ikke dokumenteret/)
}))
