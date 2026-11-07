// Independent synthetic fixtures for local same-engine Codex self-check.
// This file does not constitute a fresh, separate reviewer context.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { coachCalendarDays } from './coachCalendarEvents.mjs'
import { installCalendarClarityLoader } from './calendarClarityFixture.mjs'

const hook = installCalendarClarityLoader(true)
test.after(() => hook.deregister())
const { default: Events } = await import('./CoachCalendarEvents.jsx')

test('control: conflicting rows retain first object with no field merge in either order', () => {
  const x = Object.freeze({ id: 'control-x', name: 'Second alphabetically',
    competition_date: '2028-02-29', notes: null })
  const y = Object.freeze({ id: 'control-x', name: 'Alphabetically first',
    competition_date: '2028-02-29', notes: 'newer-looking', updated_at: '2030-01-01' })
  for (const input of [Object.freeze([x, y, x]), Object.freeze([y, x, y])]) {
    const before = structuredClone(input)
    const result = coachCalendarDays(input)
    assert.equal(result.length, 1)
    assert.equal(result[0].athletes.length, 1)
    assert.strictEqual(result[0].athletes[0], input[0])
    assert.deepEqual(input, before)
  }
})

test('control: interleaved IDs and dates keep chronological days and encounter order per day', () => {
  const a = Object.freeze({ id: 'control-a', competition_date: '2026-03-30' })
  const b = Object.freeze({ id: 'control-b', competition_date: '2026-03-29' })
  const c = Object.freeze({ id: 'control-a', competition_date: '2026-03-29' })
  const d = Object.freeze({ id: 'control-b', competition_date: '2026-03-30' })
  assert.deepEqual(coachCalendarDays(Object.freeze([a, b, a, c, b, d, c, d])), [
    { date: '2026-03-29', athletes: [b, c] }, { date: '2026-03-30', athletes: [a, d] },
  ])
})

test('control: missing identifiers and invalid earlier dates cannot suppress a later valid row', () => {
  const valid = Object.freeze({ id: 'control-valid', competition_date: '2026-10-25' })
  const input = Object.freeze([
    null, Object.freeze({ competition_date: valid.competition_date }),
    Object.freeze({ id: '', competition_date: valid.competition_date }),
    Object.freeze({ id: valid.id, competition_date: null }),
    Object.freeze({ id: valid.id, competition_date: '2026-02-30' }), valid, valid,
  ])
  assert.deepEqual(coachCalendarDays(input), [{ date: valid.competition_date, athletes: [valid] }])
  assert.deepEqual(coachCalendarDays([]), [])
  assert.equal(coachCalendarDays([valid])[0].athletes.length, 1)
})

test('control: actual Events renders one native button per ID/date with original profile target', () => {
  const first = Object.freeze({ id: 'control-a', name: 'Original', competition_date: '2026-10-25' })
  const duplicate = Object.freeze({ ...first, name: 'Discarded conflict' })
  const other = Object.freeze({ id: 'control-b', name: 'Other', competition_date: '2026-10-25' })
  const following = Object.freeze({ ...first, competition_date: '2026-10-26' })
  const calls = []
  const props = { athletes: Object.freeze([first, duplicate, other, following]),
    openProfile: (...args) => calls.push(args) }
  const html = renderToStaticMarkup(createElement(Events, props))
  assert.equal([...html.matchAll(/<button\b/g)].length, 3)
  assert.deepEqual([...html.matchAll(/<time dateTime="([^"]+)"/g)].map(m => m[1]), ['2026-10-25', '2026-10-26'])
  assert.doesNotMatch(html, /Discarded conflict/)
  const tree = Events(props)
  // Follow only this component's emitted React elements; grouping remains product code.
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!node || typeof node !== 'object') return
    if (node.type === 'button') node.props.onClick()
    visit(node.props?.children)
  }
  visit(tree)
  assert.equal(calls.length, 3)
  const targets = [first, other, following]
  targets.forEach((athlete, index) => {
    assert.strictEqual(calls[index][0], athlete)
    assert.deepEqual(calls[index].slice(1), ['stævne'])
  })
})
