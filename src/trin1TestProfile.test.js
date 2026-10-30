import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { useTestRelease } from './trin1TestProfile.mjs'

// Independent probes use actual imports in a copied src/ layout, never a flat harness.
// Retain synthetic fixtures inside the repository copy; no external temp directory.
const root = new URL('../', import.meta.url)
function fixture(step, ending = '\n', broken = false) {
  const directory = mkdtempSync(fileURLToPath(new URL('../.trin1-profile-', import.meta.url)))
  const base = pathToFileURL(directory + '/')
  for (const name of ['trin1TestProfile.mjs', 'udgivelseTrin.mjs', 'dataEnough.mjs',
    'rpeEvidence.mjs', 'calendarDate.js', 'athlete/kostNumbers.mjs']) {
    const target = new URL('src/' + name, base)
    mkdirSync(new URL('./', target), { recursive: true })
    let source = readFileSync(new URL('src/' + name, root), 'utf8').replace(/\r\n/g, '\n')
    if (name === 'udgivelseTrin.mjs') source = source.replace(/^export const UDGIVELSE_TRIN = [01]$/m, `export const UDGIVELSE_TRIN = ${step}`)
    if (name === 'dataEnough.mjs' && broken) source = source.replace("return trin1AppData2(globalThis.location?.search || '')", 'return false')
    writeFileSync(target, source.replace(/\n/g, ending))
  }
  writeFileSync(new URL('package.json', base), '{"type":"module"}\n')
  return base
}
function probe(base, selected) {
  const code = `import assert from 'node:assert/strict';
    const { useTestRelease } = await import(${JSON.stringify(new URL('src/trin1TestProfile.mjs', base).href)});
    useTestRelease(${selected});
    const { UDGIVELSE_TRIN, trin1AppData2 } = await import(${JSON.stringify(new URL('src/udgivelseTrin.mjs', base).href)});
    const data = await import(${JSON.stringify(new URL('src/dataEnough.mjs', base).href)});
    assert.equal(UDGIVELSE_TRIN, ${selected});
    for (const search of ['', '?appData2=0', '?appData2=true', '?appData2=1']) {
      globalThis.location = { search };
      assert.equal(data.dataEnoughEnabled(), ${selected} === 1 || search === '?appData2=1', 'effective imported gate');
      assert.equal(trin1AppData2(search), data.dataEnoughEnabled());
    }`;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], { encoding: 'utf8', cwd: fileURLToPath(base) })
}
for (const step of [0, 1]) for (const [label, ending] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  test(`real imports: source step ${step}, ${label}, explicitly selected OFF and ON`, () => {
    const base = fixture(step, ending)
    for (const selected of [0, 1]) {
      const result = probe(base, selected)
      assert.equal(result.error, undefined)
      assert.equal(result.status, 0, result.stdout + result.stderr)
    }
    // Selecting a profile cannot rewrite the source on disk.
    assert.match(readFileSync(new URL('src/udgivelseTrin.mjs', base), 'utf8').replace(/\r\n/g, '\n'), new RegExp('^export const UDGIVELSE_TRIN = ' + step + '$', 'm'))
  })
}
test('counterexample: ambiguous profile arguments cannot select ON', () => {
  for (const value of [undefined, null, true, false, '1', 2]) assert.throws(() => useTestRelease(value), /Unknown synthetic release step/)
})
test('counterexample: unsupported source declaration fails closed', () => {
  const result = probe(fixture(2), 0)
  assert.notEqual(result.status, 0)
  assert.match(result.stdout + result.stderr, /Expected one supported release declaration/)
})
test('counterexample: disconnected real gate is detected despite explicit selection', () => {
  const result = probe(fixture(0, '\n', true), 1)
  assert.notEqual(result.status, 0)
  assert.match(result.stdout + result.stderr, /effective imported gate/)
})
