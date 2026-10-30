import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { warmupLadder, sessionLadder, plateLoad, opvarmStigeEnabled } from '../opvarmStige.mjs'
import { createRegistry } from '../testModuleRegistry.mjs'

test('counterprobe: deeply frozen plan, aliases and explicit top precedence', () => {
  const rows = Object.freeze([
    Object.freeze({ name: 'Bench press backoff', recommended_weight: 50 }),
    Object.freeze({ name: 'Bench press top', recommended_weight: 87.7 }),
  ])
  assert.equal(sessionLadder(rows).lift, 'Bænkpres')
  assert.equal(sessionLadder(rows).plannedWeight, 87.7)
  assert.equal(sessionLadder([{name:'Squat',recommended_weight:100},{name:'Squat top',recommended_weight:null}]),null)
  assert.equal(sessionLadder([{name:'Squat',recommended_weight:100},{name:'Squat top',recommended_weight:120}]).plannedWeight,120)
  assert.equal(warmupLadder('Front squat', 100),null)
  assert.equal(sessionLadder([{name:'Leg press',recommended_weight:100}]),null)
})
test('counterprobe: hostile numeric inputs and query lookalikes never fabricate a ladder', () => {
  for (const kg of [{}, [], ['100'], '1e2', '0x64', '100junk', ' ', '100/110', 'Infinity']) assert.equal(plateLoad(kg),null)
  for (const search of ['?OpvarmStige=1','?opvarmStige=01','?opvarmStige=1&opvarmStige=1','?rel1030=true']) assert.equal(opvarmStigeEnabled(false,search),false)
  for (const kg of [20,20.01,21.25,21.26,23.75,24,25,31.24,99.99,100.01,142.35,225.8]) {
    const result = warmupLadder('Dødløft',kg)
    assert.equal(new Set(result.steps.map(step=>step.weight)).size,result.steps.length)
    for (const step of result.steps) assert.ok(step.weight <= result.topWeight)
  }
})
test('counterprobe: actual registry accepts final modules and rejects an unlisted importer', () => {
  const data=JSON.parse(readFileSync(new URL('../testModuleRegistry.json',import.meta.url),'utf8'))
  const root=new URL('../../',import.meta.url), registry=createRegistry(data,root)
  const loader=Object.keys(data.loaders)[0]
  for (const [parent,specifier,target] of [
    ['src/App.jsx','./opvarmStige.mjs','src/opvarmStige.mjs'],
    ['src/athlete/ProgramTab.jsx','./WarmupLadderView.mjs','src/athlete/WarmupLadderView.mjs'],
    ['src/athlete/WarmupLadderView.mjs','../opvarmStige.mjs','src/opvarmStige.mjs'],
  ]) assert.equal(registry.lookup(loader,specifier,new URL(parent,root).href).url,new URL(target,root).href)
  assert.equal(registry.lookup(loader,'./opvarmStige.mjs',new URL('src/Unlisted.jsx',root).href),null)
})
