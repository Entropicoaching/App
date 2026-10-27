import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// Fresh, private synthetic FS graphs inside this test's own reconstructed copy.
for (const [kind, leaf] of [
  ['net', "import 'node:https'"],
  ['storage', "export const read = () => localStorage.getItem('synthetic')"],
]) test(`frisk FS-modproeve: ${kind} afvises foer mutationsmodulet kan evalueres`, () => {
  const base = mkdtempSync(fileURLToPath(new URL('./kandFix2-mutation-', import.meta.url)))
  const src = join(base, 'src'); mkdirSync(src)
  writeFileSync(join(base, 'package.json'), '{"type":"module"}\n')
  for (const file of ['coachNoteDependencyGuard.mjs', 'e2eTestFlags.mjs']) {
    copyFileSync(new URL('./' + file, import.meta.url), join(src, file))
  }
  const original = readFileSync(new URL('./coachNoteSignal.js', import.meta.url), 'utf8')
  writeFileSync(join(src, 'coachNoteSignal.js'), original + "\nexport * from './bridge.mjs'\n")
  writeFileSync(join(src, 'bridge.mjs'), "export * from './leaf.mjs'\n")
  writeFileSync(join(src, 'leaf.mjs'), leaf + "\nthrow Error('MUTATION_EXECUTED')\n")
  const run = spawnSync(process.execPath, ['--input-type=module', '-e',
    "await import('./src/coachNoteDependencyGuard.mjs'); await import('./src/coachNoteSignal.js')"],
    { cwd: base, encoding: 'utf8' })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /(?:Impure|Unapproved) synthetic dependency/)
  assert.doesNotMatch(run.stderr, /MUTATION_EXECUTED/)
})
