import test from 'node:test'
import assert from 'node:assert/strict'
import * as vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { syntheticModules } from './registrySyntheticFs.mjs'
import { snapshotFiles } from './registryTestFiles.mjs'
if (!vm.SourceTextModule) {
  test('isolated synthetic ESM counterexamples', () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
} else {
const root = new URL('../', import.meta.url)
const files = snapshotFiles(root)

for (const [kind, leaf] of [
  ['net', "import 'node:https'"],
  ['storage', "export const read = () => localStorage.getItem('synthetic')"],
]) test(`frisk FS-modproeve: ${kind} afvises foer mutationsmodulet kan evalueres`, async () => {
  const input = new Map(files)
  const signal = new URL('src/coachNoteSignal.js', root).href
  input.set(signal, input.get(signal) + "\nexport * from './bridge.mjs'\n")
  input.set(new URL('src/bridge.mjs', root).href, "export * from './leaf.mjs'\n")
  input.set(new URL('src/leaf.mjs', root).href, leaf + "\nthrow Error('MUTATION_EXECUTED')\n")
  const engine = syntheticModules(input, root)
  await assert.rejects(engine.import('src/coachNoteDependencyGuard.mjs'), error => {
    assert.match(error.message, /(?:Impure|Unapproved) synthetic dependency/)
    assert.doesNotMatch(error.message, /MUTATION_EXECUTED/)
    return true
  })
})
}
