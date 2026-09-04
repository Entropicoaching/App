import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runGuardedWrite } from './athleteWriteGuard.js'

test('en vellykket skrivning kalder ikke onError og returnerer true', async () => {
  let errorCalls = 0
  const ok = await runGuardedWrite(async () => ({ data: { id: 1 }, error: null }), () => { errorCalls++ })
  assert.equal(ok, true)
  assert.equal(errorCalls, 0)
})

test('en fejlet skrivning kalder onError med fejlen og returnerer false', async () => {
  const seen = []
  const fakeError = { message: 'network drop' }
  const ok = await runGuardedWrite(async () => ({ data: null, error: fakeError }), (e) => seen.push(e))
  assert.equal(ok, false)
  assert.deepEqual(seen, [fakeError])
})

test('en kastet fejl fra run() propagerer ikke stille — kalderen skal selv fange den', async () => {
  // runGuardedWrite antager `run` returnerer { error }, som queueWrite og alle
  // rå supabase-kald gør. Den sluger ikke en throw — det er bevidst: en throw
  // er en programmeringsfejl, ikke en transient netværksfejl, og skal fejle højt.
  await assert.rejects(() => runGuardedWrite(async () => { throw new Error('boom') }, () => {}))
})
