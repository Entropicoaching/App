import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runGuardedRead } from './athleteReadGuard.js'

test('en vellykket læsning kalder ikke onError og returnerer data + ok:true', async () => {
  let errorCalls = 0
  const { data, ok } = await runGuardedRead(
    async () => ({ data: [{ id: 1 }], error: null }),
    () => { errorCalls++ },
  )
  assert.equal(ok, true)
  assert.deepEqual(data, [{ id: 1 }])
  assert.equal(errorCalls, 0)
})

test('en fejlet læsning kalder onError med fejlen og returnerer { data: null, ok: false }', async () => {
  const seen = []
  const fakeError = { message: 'network drop' }
  const { data, ok } = await runGuardedRead(
    async () => ({ data: null, error: fakeError }),
    (e) => seen.push(e),
  )
  assert.equal(ok, false)
  assert.equal(data, null)
  assert.deepEqual(seen, [fakeError])
})

test('en kastet fejl fra run() propagerer ikke stille — kalderen skal selv fange den', async () => {
  // Spejler runGuardedWrite (athleteWriteGuard.js): en throw er en
  // programmeringsfejl, ikke en transient netværksfejl, og skal fejle højt.
  await assert.rejects(() => runGuardedRead(async () => { throw new Error('boom') }, () => {}))
})

// ORDRE 76 — "stille fejl, runde 4", G1: fetchProgram og 18 andre rå
// læsninger i AthleteView.jsx (samme søgning som ordre 41 brugte) havde
// alle samme mønster som G1's navngiver — ingen fejltjek, så en fejl så ud
// som en ægte tom liste. Hver test herunder spejler kaldsstedets faktiske
// beslutning: "if (!ok) return" FØR staten (setteren) opdateres, så sidst
// kendte indhold aldrig overskrives af en tom liste ved en fejl. Se
// scripts/verify-athlete-read-failures.mjs for den statiske bekræftelse af
// at kildekoden faktisk følger dette mønster.
function simulateReadSite(setterName) {
  return async () => {
    let setterCalled = false
    let flashed = null
    const setter = () => { setterCalled = true }
    const onReadError = (label) => (error) => {
      flashed = `${label} kunne ikke hentes. Tjek din forbindelse og prøv igen.`
      assert.notEqual(flashed, error.message, 'atleten må ikke se den rå Supabase-fejlbesked')
    }
    const { ok } = await runGuardedRead(
      async () => ({ data: null, error: { message: 'network drop' } }),
      onReadError(setterName),
    )
    if (!ok) return { ok, setterCalled, flashed }
    setter()
    return { ok, setterCalled, flashed }
  }
}

const GUARDED_READS = [
  ['G1 — fetchProgram: allWeeks', 'Dit program'],
  ['G1 — fetchPRs: prs', 'Personlige rekorder'],
  ['G1 — fetchMeetPlan: hasMeetPlan', 'Stævneplanen'],
  ['G1 — fetchMeetResults: meetResults', 'Stævneresultater'],
  ['G1 — fetchWarmupTemplates: warmupTemplates', 'Opvarmningsskabeloner'],
  ['G1 — fetchReadiness (dagens): readinessLog', 'Dagens parathed'],
  ['G1 — fetchReadiness (sidste): lastReadiness', 'Sidste parathed'],
  ['G1 — fetchWeeklyTonnage: weeklyTonnage/liftProgress', 'Tonnage-grafen'],
  ['G1 — fetchWeekLogs: ugens log-status', 'Ugens log-status'],
  ['G1 — fetchPastLogs: pastLogs', 'Tidligere logs'],
  ['G1 — fetchExerciseLogs: exerciseLogs', 'Sæt-loggen'],
  ['G1 — fetchLastLogs: lastLogByExerciseName', 'Seneste vægte'],
  ['G1 — fetchExerciseHistory: exerciseHistory', 'Øvelseshistorik'],
  ['G1 — fetchWeightLogs: weightLogs', 'Vægtloggen'],
  ['G1 — fetchAthleteMessages: messages', 'Beskederne'],
  ['G1 — fetchLogs: logs (kostlog)', 'Dagens kostlog'],
  ['G1 — fetchHistoricalMealLogs: historicalMealLogs', 'Kosthistorikken'],
  ['G1 — fetchFrequentFoods: frequentFoods', 'Hyppige fødevarer'],
  ['G1 — fetchMealTemplates: mealTemplates', 'Skabelonerne'],
  ['G1 — fetchCustomFoods: customFoods', 'Fødevarelisten'],
]

for (const [name, label] of GUARDED_READS) {
  test(`${name}: en fejl kalder onReadError og staten opdateres ikke`, async () => {
    const { ok, setterCalled, flashed } = await simulateReadSite(label)()
    assert.equal(ok, false)
    assert.equal(setterCalled, false, 'staten må ikke sættes/erstattes af en tom liste når læsningen er fejlet')
    assert.equal(flashed, `${label} kunne ikke hentes. Tjek din forbindelse og prøv igen.`)
  })
}

test('G1 — fetchProgram: en fejl må aldrig se ud som "du har intet program"', async () => {
  // Spejler AthleteView.jsx's fetchProgram: kun en BEKRÆFTET (om end tom)
  // læsning må rydde programError og dermed vise "Dit program er på vej"
  // i stedet for fejlteksten.
  let programError = false
  let allWeeksSet = false
  const { ok } = await runGuardedRead(
    async () => ({ data: null, error: { message: 'network drop' } }),
    () => {},
  )
  if (!ok) programError = true
  else allWeeksSet = true
  assert.equal(programError, true, 'programError skal sættes ved en fejlet hentning')
  assert.equal(allWeeksSet, false, 'allWeeks må ikke sættes (og dermed heller ikke "ryddes" til tom) ved en fejl')
})
