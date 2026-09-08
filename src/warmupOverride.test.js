import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyWarmupCorrection, saveWarmupOverride, loadWarmupOverride, suggestWarmupOverride } from './warmupOverride.js'

// In-memory fake af localStorage's API-flade — samme mønster som
// readinessDraft.test.js.
function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

const MODEL_SETS = [
  { weight: 20, reps: 5, pct: 'Stang' },
  { weight: 60, reps: 3, pct: '60%' },
  { weight: 90, reps: 2, pct: '90%' },
]

test('applyWarmupCorrection retter vægten på ét sæt og lader resten stå', () => {
  const næste = applyWarmupCorrection(MODEL_SETS, 1, { weight: 55 })
  assert.equal(næste.length, 3)
  assert.equal(næste[1].weight, 55)
  assert.deepEqual(næste[1].warmupOverride, { anbefalet: 60, faktisk: 55 })
  assert.equal(næste[0].weight, 20)
  assert.equal(næste[2].weight, 90)
})

test('applyWarmupCorrection: spring-over fjerner sættet fra rampen', () => {
  const næste = applyWarmupCorrection(MODEL_SETS, 1, { skipped: true })
  assert.equal(næste.length, 2)
  assert.deepEqual(næste.map((s) => s.weight), [20, 90])
})

test('applyWarmupCorrection: ugyldig vægt (0, negativ, NaN) ændrer intet', () => {
  for (const bad of [0, -5, NaN, undefined]) {
    const næste = applyWarmupCorrection(MODEL_SETS, 1, { weight: bad })
    assert.equal(næste[1].weight, 60)
    assert.equal(næste[1].warmupOverride, undefined)
  }
})

test('rettelse gemmes og kan hentes igen', () => {
  const storage = fakeStorage()
  const rettet = applyWarmupCorrection(MODEL_SETS, 1, { weight: 57.5 })
  assert.equal(saveWarmupOverride('athlete-1', 'Squat', 100, rettet, storage), true)
  const gemt = loadWarmupOverride('athlete-1', 'Squat', storage)
  assert.equal(gemt.workingWeight, 100)
  assert.equal(gemt.sets[1].weight, 57.5)
})

test('forslag genbruges når arbejdsvægten ligger inden for 5 %', () => {
  const storage = fakeStorage()
  const rettet = applyWarmupCorrection(MODEL_SETS, 1, { weight: 57.5 })
  saveWarmupOverride('athlete-1', 'Squat', 100, rettet, storage)
  // 104 kg er 4 % over 100 — stadig inden for 5 %.
  const forslag = suggestWarmupOverride('athlete-1', 'Squat', 104, storage)
  assert.ok(forslag)
  assert.equal(forslag[1].weight, 57.5)
})

test('uden for 5 % gælder modellen igen — suggestWarmupOverride svarer null', () => {
  const storage = fakeStorage()
  const rettet = applyWarmupCorrection(MODEL_SETS, 1, { weight: 57.5 })
  saveWarmupOverride('athlete-1', 'Squat', 100, rettet, storage)
  // 106 kg er 6 % over 100 — uden for tolerancen.
  assert.equal(suggestWarmupOverride('athlete-1', 'Squat', 106, storage), null)
})

test('forslag er pr. atlet og pr. øvelse — ingen krydssmitte', () => {
  const storage = fakeStorage()
  const rettet = applyWarmupCorrection(MODEL_SETS, 1, { weight: 57.5 })
  saveWarmupOverride('athlete-1', 'Squat', 100, rettet, storage)
  assert.equal(suggestWarmupOverride('athlete-2', 'Squat', 100, storage), null)
  assert.equal(suggestWarmupOverride('athlete-1', 'Bænkpres', 100, storage), null)
})

test('øvelsesnavne matches ASCII-uafhængigt af store/små bogstaver og mellemrum', () => {
  const storage = fakeStorage()
  const rettet = applyWarmupCorrection(MODEL_SETS, 1, { weight: 57.5 })
  saveWarmupOverride('athlete-1', '  Squat ', 100, rettet, storage)
  assert.ok(suggestWarmupOverride('athlete-1', 'squat', 100, storage))
})

test('ingen tidligere rettelse for øvelsen giver null — modellen gælder', () => {
  const storage = fakeStorage()
  assert.equal(suggestWarmupOverride('athlete-1', 'Squat', 100, storage), null)
})

test('en fejlende storage (fx privat vindue) vælter ikke', () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(saveWarmupOverride('athlete-1', 'Squat', 100, MODEL_SETS, throwingStorage), false)
  assert.equal(loadWarmupOverride('athlete-1', 'Squat', throwingStorage), null)
  assert.equal(suggestWarmupOverride('athlete-1', 'Squat', 100, throwingStorage), null)
})
