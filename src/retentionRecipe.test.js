import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { app } from './retentionAppHarness.mjs'
import { createRegistry, wrapRegistryHooks } from './testModuleRegistry.mjs'

test('retention gate and missing evidence share the exact synthetic dataEnough module', async () => {
  await app()
  const gate = await import('retention-1://app/analyseDataGate.mjs')
  const enough = await import('retention-1://app/dataEnough.mjs')
  const missing = await import('retention-1://app/dataMissing.mjs')
  const { default: Missing } = await import('retention-1://app/analyseMissingData.mjs')
  for (const key of ['dataEnoughEnabled', 'dataAllowed', 'dataMessage']) assert.equal(gate[key], enough[key])
  assert.equal(gate.dataAllowed('D21', {}), false)
  assert.equal(missing.missingRequirement('D21', {}), 'synthetic missing')
  const legacy = { type: 'p', children: ['legacy'] }
  assert.equal(Missing({ enabled: false, legacy }), legacy)
  await assert.rejects(import('retention-1://app/unknown.mjs'), /ENOENT|Forbidden/)
})

test('recipe precedence is confined to retention virtual parents; real and other loader edges stay managed', () => {
  const data = JSON.parse(readFileSync(new URL('./testModuleRegistry.json', import.meta.url)))
  const root = new URL('../', import.meta.url)
  const rules = createRegistry(data, root)
  const gateURL = new URL('src/dashboard/analyseDataGate.mjs', root).href
  for (const loader of ['src/retentionAppHarness.mjs', 'src/dashboard/analyseConclusionLoader.mjs']) {
    let legacy = 0
    const hooks = wrapRegistryHooks(new URL(loader, root).href, {
      resolve() { legacy++; return { url: 'synthetic://stub', shortCircuit: true } },
    }, { registry: rules, readSource: () => 'export const marker=1' })
    const parentURL = new URL('src/dashboard/AnalyseTab.jsx', root).href
    assert.equal(hooks.resolve('./analyseDataGate.mjs', { parentURL }).url, gateURL)
    assert.equal(legacy, 0)
    assert.equal(hooks.load(gateURL, {}).source, 'export const marker=1')
    assert.throws(() => hooks.resolve('node:fs', { parentURL: gateURL }), /Closed registry import/)
  }
})
