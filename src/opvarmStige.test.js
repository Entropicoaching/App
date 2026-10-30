import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPVARM_STIGE, opvarmStigeEnabled, plateLoad, warmupLadder, sessionLadder, PLATES_KG } from './opvarmStige.mjs'

test('default OFF; strict prop/query and release opt-in', () => {
  assert.equal(DEFAULT_OPVARM_STIGE, false)
  for (const prop of [undefined, false, null, 1, 'true']) assert.equal(opvarmStigeEnabled(prop), false)
  for (const search of ['', '?opvarmStige=0', '?opvarmStige=true', '?opvarmStige=1&opvarmStige=0', '?rel1030=1&rel1030=1']) assert.equal(opvarmStigeEnabled(false, search), false)
  assert.equal(opvarmStigeEnabled(true), true)
  assert.equal(opvarmStigeEnabled(false, '?opvarmStige=1'), true)
  assert.equal(opvarmStigeEnabled(false, '?rel1030=1'), true)
})
test('squat, bench and deadlift have deterministic ascending loads, reps and paired plates', () => {
  for (const [lift, weight] of [['Squat', 140], ['Bænkpres', 80], ['Dødløft', 200], ['Sumo dødløft', 180]]) {
    const result = warmupLadder(lift, weight)
    assert.deepEqual(result, warmupLadder(lift, weight))
    assert.equal(result.steps[0].weight, 20)
    for (const [index, step] of result.steps.entries()) {
      assert.ok(step.weight < weight)
      assert.ok(step.reps >= 1)
      if (index) assert.ok(result.steps[index - 1].weight < step.weight)
      assert.equal(20 + 2 * step.plates.reduce((sum, plate) => sum + plate.kg * plate.count, 0), step.weight)
      for (const plate of step.plates) assert.ok(PLATES_KG.includes(plate.kg))
    }
  }
  assert.deepEqual(warmupLadder('Squat', 100).steps.map(s => [s.weight, s.reps]), [[20,8],[40,5],[60,3],[80,2],[90,1]])
})
test('nearest load, tie down, decimal comma, deduplication and underbar', () => {
  assert.deepEqual(warmupLadder('Squat', 101.3).steps.map(s=>s.weight), [20,40,60,80,90])
  assert.equal(plateLoad(101).weight, 100)
  assert.equal(plateLoad(102).weight, 102.5)
  assert.equal(plateLoad('101,25').weight, 100)
  assert.deepEqual(plateLoad(102.5).plates, [{kg:25,count:1},{kg:15,count:1},{kg:1.25,count:1}])
  assert.equal(warmupLadder('Bænkpres', 19), null)
  assert.equal(warmupLadder('Bænkpres', 20).steps.length, 1)
  assert.equal(warmupLadder('Bænkpres', 22.5).steps.length, 1)
})
test('no guessed weight, lift, neighbouring topset or historical fallback; input unchanged', () => {
  for (const value of [undefined, null, '', '80-90', '80 kg', '80%', true, -1, 0, NaN, Infinity]) assert.equal(warmupLadder('Squat', value), null)
  assert.equal(warmupLadder('Leg press', 100), null)
  for (const rows of [[], null, [{name:'Topset',recommended_weight:100}], [{name:'Squat backoff',recommended_weight:80}], [{name:'Squat',intensity:'80 kg'}], [{name:'Squat'}, {name:'Bænkpres top',recommended_weight:100}]]) assert.equal(sessionLadder(rows), null)
  const rows = [{name:'Squat backoff',recommended_weight:80},{name:'Squat top',recommended_weight:'102,5'}]
  const before = JSON.stringify(rows)
  assert.equal(sessionLadder(rows).plannedWeight, 102.5)
  assert.equal(JSON.stringify(rows), before)
  assert.equal(sessionLadder([{name:'Squat top'}, {name:'Squat',recommended_weight:120}]), null)
})
test('nearest grid and plate sum property over 4000 odd loads', () => {
  for (let i = 0; i < 4000; i++) {
    const kg = 20 + i * 0.127, load = plateLoad(kg)
    assert.ok(Math.abs(kg - load.weight) <= 1.25000001)
    assert.equal(20 + 2 * load.plates.reduce((sum, plate) => sum + plate.kg * plate.count, 0), load.weight)
  }
})
