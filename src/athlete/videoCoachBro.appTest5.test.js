import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
// The app uses two extensionless imports. Resolve only those two pinned pure
// dependencies explicitly for native Node, without altering the module body.
const bridgeURL = new URL('./videoCoachBro.js', import.meta.url)
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === bridgeURL.href && ['../videoCoachSubmission', '../videoCoachVersion'].includes(specifier))
    return next(new URL(specifier + '.js', bridgeURL).href, context)
  return next(specifier, context)
} })
let bridge
try { bridge = await import(bridgeURL) } finally { hook.deregister() }
const { validateAthleteVideoCoachRow: validate, athleteVideoPathPreview: preview, isUuid } = bridge

const id = '00000000-0000-4000-8000-000000000001'
const row = (n = 1) => ({ client_analysis_id: id, athlete_id: 'athlete1', schema_version: 3, schema_v: 3,
  status: 'draft', source_mode: 'athlete_submission', lift: 'squat', variation: 'competition_squat',
  reps_count: n, reps: Array(n).fill(1), rep_details: Array.from({ length: n }, (_, i) => ({ start_s: i * 2, end_s: i * 2 + 1, valid_ratio: 1, confidence: 1 })),
  metrics: {}, findings: [] })
test('APP-TEST5 Bro: valid empty angle package, one rep and many reps are accepted', () => {
  for (const n of [1, 20]) assert.equal(validate(row(n), 'athlete1'), null)
  assert.equal(typeof validate(row(0), 'athlete1'), 'string')
  assert.equal(isUuid(id), true)
  for (const value of [null, '', 1, id + 'x']) assert.equal(isUuid(value), false)
})
test('APP-TEST5 Bro: foreign athlete, unknown fields, invalid lift and non-draft are rejected', () => {
  for (const patch of [{ athlete_id: 'other' }, { extra_field: true }, { lift: 'unknown' }, { status: 'shared' }, { variation: '../x' }])
    assert.equal(typeof validate({ ...row(), ...patch }, 'athlete1'), 'string')
})
test('APP-TEST5 Bro: nonfinite rep values must not cross the athlete bridge', () => {
  for (const value of [NaN, Infinity, -Infinity])
    assert.equal(typeof validate({ ...row(), reps: [value] }, 'athlete1'), 'string', String(value))
})
test('APP-TEST5 Bro: rep vector and details must describe the same count', () => {
  assert.equal(typeof validate({ ...row(), reps: [] }, 'athlete1'), 'string')
  assert.equal(typeof validate({ ...row(), reps: [1, 2] }, 'athlete1'), 'string')
})
test('APP-TEST5 Bro: missing, unequal, oversized and nonfinite paths give no preview', () => {
  for (const value of [undefined, {}, { x0: 0, y0: 0, dx: [], dy: [] },
    { x0: 0, y0: 0, dx: [1], dy: [] }, { x0: Infinity, y0: 0, dx: [1], dy: [1] },
    { x0: 0, y0: 0, dx: [NaN], dy: [1] }, { x0: 0, y0: 0, dx: Array(241).fill(1), dy: Array(241).fill(1) }])
    assert.equal(preview(value), null)
})
test('APP-TEST5 Bro: synthetic path preview preserves endpoints without changing input', () => {
  const value = { x0: 10, y0: 30, dx: [2, -1], dy: [-5, -4] }, before = structuredClone(value)
  const result = preview(value)
  assert.deepEqual(result.start, { x: 10, y: 30 })
  assert.deepEqual(result.end, { x: 11, y: 21 })
  assert.equal(result.points, '10,30 12,25 11,21')
  assert.equal(result.referenceX, 10)
  assert.deepEqual(value, before)
})
