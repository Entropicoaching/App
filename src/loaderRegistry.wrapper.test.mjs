import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const wrapperURL = new URL('./loaderRegistry.test.js', import.meta.url).href

// Evaluate the actual, unmodified wrapper with synthetic imports in a VM. Only
// its child command is redirected to a real local fixture; capture options and
// assertions come from the mounted wrapper. The real registry VM tests run via
// loaderRegistry.test.js separately, without these synthetic imports.
const harness = String.raw`
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import process from 'node:process'

const { wrapperURL, scenario } = JSON.parse(readFileSync(0, 'utf8'))
let callback, result, thrown
const unexpected = () => { throw new Error('VM body must not run in wrapper fixture') }
const fixture = [
  "const { writeSync } = require('node:fs')",
  "writeSync(1, 'stdout-BEGIN\\n'); writeSync(2, 'stderr-BEGIN\\n')",
  'const chunk = Buffer.alloc(64 * 1024, 120)',
  'for (let n = 0; n < ' + scenario.stdoutChunks + '; n++) writeSync(1, chunk)',
  'for (let n = 0; n < ' + scenario.stderrChunks + '; n++) writeSync(2, chunk)',
  "writeSync(1, 'stdout-END\\n'); writeSync(2, 'stderr-END\\n')",
  'process.exitCode = ' + scenario.exitCode,
].join(';')
const dependencies = {
  'node:test': { default: (name, fn) => {
    assert.equal(name, 'registry synthetic ESM checks in isolated VM-capable process')
    assert.equal(callback, undefined)
    callback = fn
  } },
  'node:assert/strict': { default: assert },
  'node:vm': {},
  'node:child_process': { spawnSync: (command, args, options) => {
    assert.equal(command, process.execPath)
    assert.deepEqual(Array.from(args), ['--test-concurrency=1', '--experimental-vm-modules', fileURLToPath(wrapperURL)])
    if (scenario.kind === 'null-status') {
      result = { status: null, signal: 'SIGTERM', stdout: 'stdout-null', stderr: 'stderr-null' }
    } else {
      const executable = scenario.kind === 'spawn-error'
        ? fileURLToPath(new URL('./registry-child-does-not-exist', wrapperURL)) : command
      result = spawnSync(executable, ['--test-concurrency=1', '-e', fixture], options)
    }
    return result
  } },
  'node:fs': { readFileSync },
  'node:path': { resolve },
  'node:url': { fileURLToPath, pathToFileURL },
  './testModuleRegistry.mjs': { createRegistry: unexpected, wrapRegistryHooks: unexpected },
  './registrySyntheticFs.mjs': { syntheticModules: unexpected },
  './registryTestFiles.mjs': { snapshotFiles: unexpected },
}
const mod = new SourceTextModule(readFileSync(new URL(wrapperURL), 'utf8'), {
  identifier: wrapperURL,
  initializeImportMeta(meta) { meta.url = wrapperURL },
})
await mod.link(specifier => {
  assert.ok(Object.hasOwn(dependencies, specifier), 'explicit synthetic import: ' + specifier)
  const values = dependencies[specifier]
  return new SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value)
  })
})
await mod.evaluate()
assert.equal(typeof callback, 'function')
try { await callback() } catch (error) { thrown = error }
assert.ok(result, 'actual wrapper spawned its child')
if (scenario.kind === 'success') {
  assert.ifError(result.error)
  assert.equal(result.status, 0)
  assert.ifError(thrown)
  assert.ok(result.stdout.endsWith('stdout-END\n'))
  assert.ok(result.stderr.endsWith('stderr-END\n'))
} else if (scenario.kind === 'failure' || scenario.kind === 'null-status') {
  assert.ifError(result.error)
  assert.equal(result.status, scenario.kind === 'failure' ? 7 : null)
  assert.equal(thrown?.code, 'ERR_ASSERTION')
  assert.equal(thrown.actual, result.status)
  assert.equal(thrown.expected, 0)
  assert.ok(thrown.message.includes(result.stdout + result.stderr), 'both child streams remain visible')
} else {
  const code = scenario.kind === 'buffer-error' ? 'ENOBUFS' : 'ENOENT'
  assert.equal(result.error?.code, code)
  assert.equal(thrown?.cause, result.error, 'original child error propagates as cause')
  assert.ok(thrown.message.includes(code), 'error type is visible')
  assert.ok(thrown.message.includes(result.error.message), 'original error message is visible')
  assert.ok(thrown.message.includes(result.stdout ?? ''), 'captured stdout is visible')
  assert.ok(thrown.message.includes(result.stderr ?? ''), 'captured stderr is visible')
}
if (scenario.kind === 'success' || scenario.kind === 'failure') {
  for (const stream of ['stdout', 'stderr']) {
    assert.equal(Buffer.byteLength(result[stream]), scenario[stream + 'Chunks'] * 64 * 1024 + 24)
  }
}
console.log(JSON.stringify({ kind: scenario.kind, status: result.status,
  error: result.error?.code, stdoutBytes: Buffer.byteLength(result.stdout ?? ''),
  stderrBytes: Buffer.byteLength(result.stderr ?? '') }))
`

const scenarios = [
  ['accepts oversized stdout', 'success', 32, 0, 0],
  ['accepts oversized stderr', 'success', 0, 32, 0],
  ['accepts both oversized streams', 'success', 32, 32, 0],
  ['retains a real failing child and both oversized streams', 'failure', 32, 32, 7],
  ['reports stdout exceeding the fixed capture limit', 'buffer-error', 272, 0, 0],
  ['reports stderr exceeding the fixed capture limit', 'buffer-error', 0, 272, 0],
  ['reports a missing executable distinctly', 'spawn-error', 0, 0, 0],
  ['rejects null status even without a spawn error', 'null-status', 0, 0, 0],
]

for (const [name, kind, stdoutChunks, stderrChunks, exitCode] of scenarios) {
  test('registry wrapper ' + name, () => {
    const result = spawnSync(process.execPath, ['--test-concurrency=1', '--experimental-vm-modules', '--input-type=module', '-e', harness], {
      input: JSON.stringify({ wrapperURL, scenario: { kind, stdoutChunks, stderrChunks, exitCode } }),
      encoding: 'utf8',
      // The harness emits one short summary, never the fixture payload. Keep
      // diagnostics bounded even if its own assertions regress.
      maxBuffer: 256 * 1024,
    })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(JSON.parse(result.stdout).kind, kind)
  })
}
