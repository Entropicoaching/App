import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { planOriginalRetention, runOriginalRetention, RETENTION_MS } from './videoRetention.mjs'
const source = readFileSync(new URL('./videoRetention.mjs', import.meta.url), 'utf8')
const athleteId = '11111111-1111-1111-1111-111111111111'
const stem = athleteId + '/22222222-2222-2222-2222-222222222222'
const now = '2026-10-27T00:00:00Z'
function input(age) {
  return { athleteId, now, analyses: [{ id: 'synthetic', athlete_id: athleteId, video_path: stem + '.mp4',
    analysis_state: 'complete', session_context: { video_retention: { still_path: stem + '.jpg' } } }],
    objects: [{ bucket_id: 'videocoach-uploads', name: stem + '.mp4',
      created_at: new Date(Date.parse(now) - age).toISOString(), metadata: { size: 99 } },
      { bucket_id: 'videocoach-uploads', name: stem + '.jpg', metadata: { size: 1 } }] }
}
async function mutant(from, to) {
  assert.ok(source.includes(from))
  return import('data:text/javascript;base64,' + Buffer.from(source.replace(from, to)).toString('base64'))
}
test('counter: exact 30 days FAIL with >=, PASS with delivered strict >', async () => {
  const bad = await mutant('age > RETENTION_MS', 'age >= RETENTION_MS')
  const check = fn => assert.equal(fn(input(RETENTION_MS)).candidates.length, 0)
  assert.throws(() => check(bad.planOriginalRetention), assert.AssertionError)
  check(planOriginalRetention)
})
test('counter: default OFF FAIL when seeded ON, PASS in exact final', async () => {
  const bad = await mutant('VIDEO_SLET = false', 'VIDEO_SLET = true')
  const check = async fn => {
    let calls = 0
    await fn(input(RETENTION_MS + 1), { dryRun: false, adapter: {
      kind: 'synthetic', deleteOriginal: async () => { calls++; return { ok: true } },
    } })
    assert.equal(calls, 0)
  }
  await assert.rejects(check(bad.runOriginalRetention), assert.AssertionError)
  await check(runOriginalRetention)
})
test('counter: still size guard survives a bypassed existence guard', async () => {
  const bad = await mutant('stillObjects.length === 1', 'true')
  // Keep a zero-sized still object: a second independent guard must still reject it.
  const data = input(RETENTION_MS + 1)
  data.objects[1].metadata.size = 0
  assert.equal(bad.planOriginalRetention(data).candidates.length, 0)
  assert.equal(planOriginalRetention(data).candidates.length, 0)
})
