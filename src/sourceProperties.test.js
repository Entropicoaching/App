import test from 'node:test'
import assert from 'node:assert/strict'
import * as vm from 'node:vm'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertSourceProperties, sourceProperties } from './sourceProperties.mjs'
import { assertAcceptedSource, protectedSources } from './analyse5SourceContract.mjs'
import { syntheticModules } from './registrySyntheticFs.mjs'
import { snapshotFiles } from './registryTestFiles.mjs'

const root = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : new URL('../', import.meta.url)
const files = snapshotFiles(root)
const after = files.has(new URL('src/sourceProperties.mjs', root).href)
const read = path => files.get(new URL(path, root).href)
for (const [name, contract] of Object.entries(sourceProperties)) {
  test('bounded property contract permits unrelated LF/CRLF additions: ' + name, () => {
    const source = read(contract.path)
    assertSourceProperties(name, source)
    assertSourceProperties(name, '// independent addition\n' + source.replace(/\r?\n/g, '\n// independent addition\n') + '\nexport const unrelatedRegistryProbe = 1\n')
    assertSourceProperties(name, source.replace(/\r?\n/g, '\r\n'))
    for (const fragment of contract.required) {
      const removed = source.split(/\r?\n/).filter(line => !line.includes(fragment)).join('\n')
      assert.throws(() => assertSourceProperties(name, removed), /missing protected property/, name + ': ' + fragment)
    }
  })
}
for (const [path, expected] of Object.entries(protectedSources)) {
  test('bounded analysis controls reject each removed line: ' + path, () => {
    const source = read(path)
    assertAcceptedSource(path, source)
    assertAcceptedSource(path, '// unrelated\n' + source.replace(/\r?\n/g, '\n// unrelated\n'))
    for (const line of expected.trimEnd().split('\n')) {
      assert.throws(() => assertAcceptedSource(path, source.split(/\r?\n/).filter(actual => !actual.includes(line)).join('\n')), /missing or changed protected line/)
    }
  })
}
if (!vm.SourceTextModule) {
  test('actual pin-test callbacks and purity guard in isolated synthetic VM', () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
} else {
const cases = [
 ['src/lagerRebase.test.js', /^exact716/, ['inbox-storage']],
 ['src/nytExactFinal.test.js', /^fresh final gate/, ['release-off']],
 ['src/athlete/mobilityBeforeSession.test.js', /^catalog preserves/, ['mobility-catalog']],
 ['src/athlete/reb2HvileCounter.test.js', /^fresh: Program preserves/, ['program-rest']],
 ['src/dashboard/coachNotesReview.test.js', /^counter: exact pinned/, ['profile-mobility','hub-sections']],
 ['src/rebMob7.test.js', /^REB intentional profile/, ['profile-mobility']],
 ['src/dashboard/analyseConclusionReview.test.js', /^counterexample: baseline fixture/, ['analysis-evidence']],
 ['src/dashboard/queueRebase.test.js', /^queue flag contract/, ['queue-default']],
 ['src/dashboard/focusRegression.test.js', /^Keyboard focus/, ['keyboard-focus']],
]
for (const [path, title, names] of cases) {
  test('actual changed pin-test callback rejects each removed protected line: ' + path, { skip: !after }, async () => {
    const input = new Map(files), engine = syntheticModules(input, root)
    await engine.import(path)
    const selected = engine.tests.filter(entry => title.test(entry.name))
    assert.equal(selected.length, 1, 'exact changed test callback imported')
    const callback = selected[0].callback
    await callback()
    for (const name of names) {
      const contract = sourceProperties[name], target = new URL(contract.path, root).href, source = input.get(target)
      input.set(target, '// independent addition\n' + source.replace(/\r?\n/g, '\n// independent addition\n'))
      await callback()
      input.set(target, source)
      for (const fragment of contract.required) {
        input.set(target, source.split(/\r?\n/).filter(line => !line.includes(fragment)).join('\n'))
        await assert.rejects(async () => callback(), /missing protected property/, name + ': ' + fragment)
      }
      input.set(target, source)
    }
  })
}
const analysisCases = [
 ['src/rebMob7.test.js', /^REB follow closed-list remainder/, 'src/dashboard/followUpLoader.mjs'],
 ['src/rebMob7.test.js', /^REB rebase closed-list remainder/, 'src/rebaseHarness.mjs'],
 ['src/dashboard/analyseSamletReview.test.js', /^exact source boundary/, 'src/dashboard/AnalyseTab.jsx'],
 ['src/dashboard/rebaseControl.test.js', /^pinned baseline and accepted/, 'src/dashboard/analyseConclusion.mjs'],
]
for (const [path, title, protectedPath] of analysisCases) test('accepted-line consumer rejects removal: ' + path + ' -> ' + protectedPath, { skip: !after }, async () => {
  const input = new Map(files), engine = syntheticModules(input, root)
  await engine.import(path)
  const selected = engine.tests.filter(entry => title.test(entry.name)); assert.equal(selected.length, 1)
  const callback = selected[0].callback; await callback()
  const target = new URL(protectedPath, root).href, source = input.get(target)
  input.set(target, '// independent addition\n' + source.replace(/\r?\n/g, '\n// independent addition\n')); await callback()
  for (const line of protectedSources[protectedPath].trimEnd().split('\n')) {
    input.set(target, source.split(/\r?\n/).filter(actual => !actual.includes(line)).join('\n'))
    await assert.rejects(async () => callback(), /missing or changed protected line/)
  }
})
test('actual dependency guard permits pure additions and rejects removed release property or added host access', { skip: !after }, async () => {
  const engine = syntheticModules(files, root)
  const guard = await engine.import('src/coachNoteDependencyGuard.mjs')
  const source = read('src/dataEnough.mjs')
  const run = changed => guard.assertPureGraph('src/dataEnough.mjs', name => name === 'src/dataEnough.mjs' ? changed : read(name))
  run(source + '\nexport const unrelatedRegistryProbe = 1\n')
  assert.throws(() => run(source.replace("return trin1AppData2(globalThis.location?.search || '')", 'return false')), /missing protected property/)
  for (const addition of ['globalThis.fetch("synthetic")', 'window.location.href', 'localStorage.getItem("synthetic")', 'import("node:fs")']) {
    assert.throws(() => run(source + '\n' + addition), /Impure synthetic dependency/)
  }
})
}
