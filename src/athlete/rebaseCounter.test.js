import test from 'node:test'
import assert from 'node:assert/strict'
import * as vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { syntheticModules } from '../registrySyntheticFs.mjs'
import { snapshotFiles } from '../registryTestFiles.mjs'
if (!vm.SourceTextModule) {
  test('isolated synthetic ESM counterexamples', () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
} else {
const root = new URL('../../', import.meta.url)
const files = snapshotFiles(root)

for (const prefix of ['fokus', 'frem3']) for (const dependency of ['node:fs', '../other/inputValues.js', '../calendarDate.js?alias']) {
  test(`${prefix}: actual module import rejects ${dependency}`, async () => {
    const input = new Map(files)
    const target = new URL('src/athlete/repRecords.mjs', root).href
    input.set(target, `import ${JSON.stringify(dependency)};\n` + input.get(target))
    const engine = syntheticModules(input, root)
    const loader = await engine.import('src/athlete/' + prefix + 'Loader.mjs'); loader.install()
    await assert.rejects(engine.import('src/athlete/repRecords.mjs'), error => {
      assert.match(error.message, /Forbidden synthetic dependency:/)
      assert.ok(error.message.includes(dependency))
      return true
    })
  })
}
}
