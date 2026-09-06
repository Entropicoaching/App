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

// ORDRE 64 — "de stille fejl, runde 2": F4-F7 fra ordre 41's fundliste (afsnit
// "Den fulde fundliste") havde alle samme mønster — rå Supabase-kald uden
// fejltjek — og er nu koblet gennem runGuardedWrite (se AthleteView.jsx).

test('F4 — skipSet/skipExercise/unskipSet: fejl giver besked og fetchExerciseLogs kaldes ikke', async () => {
  let flashed = null
  let refetched = false
  const ok = await runGuardedWrite(
    async () => ({ error: { message: 'network drop' } }),
    () => { flashed = 'Sættet kunne ikke springes over. Tjek din forbindelse og prøv igen.' },
  )
  if (ok) refetched = true // spejler "if (!ok) return" før fetchExerciseLogs i AthleteView.jsx
  assert.equal(ok, false)
  assert.equal(flashed, 'Sættet kunne ikke springes over. Tjek din forbindelse og prøv igen.')
  assert.equal(refetched, false, 'tilstanden må ikke genindlæses/ændres når skrivningen er fejlet')
})

test('F5 — markGoodAndSave: fejl fra update_competition_max giver besked og rører ikke athlete.squat/bench/deadlift', async () => {
  let athlete = { id: 'a1', squat: 100 }
  const before = athlete
  let flashed = null
  const ok = await runGuardedWrite(
    async () => ({ error: { message: 'rpc timeout' } }),
    () => { flashed = 'Stævnemakset blev ikke gemt. Tjek din forbindelse og prøv igen.' },
  )
  if (ok) athlete = { ...athlete, squat: 120 } // spejler "if (ok) setAthlete(...)" i AthleteView.jsx
  assert.equal(ok, false)
  assert.equal(flashed, 'Stævnemakset blev ikke gemt. Tjek din forbindelse og prøv igen.')
  assert.equal(athlete, before, 'skærmens stævnemaks må ikke ændres før RPC-kaldet har bekræftet')
})
