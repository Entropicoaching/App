// Ordre 2344: polyfills.js udfylder kun det, der mangler, og opfører sig som de rigtige.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const url = new URL('./polyfills.js', import.meta.url)
const fil = fileURLToPath(url)
const importer = `await import(${JSON.stringify(url.href)})`

// Hver prøve kører i en ny node-proces, hvor API'erne er slettet før filen importeres.
function kor(kode) {
  const sletter = `
    delete Object.hasOwn; delete Array.prototype.at; delete String.prototype.at
    delete Array.prototype.findLast; delete Array.prototype.findLastIndex; delete globalThis.structuredClone
  `
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `${sletter}
    const out = {}; ${importer}; ${kode}
    console.log(JSON.stringify(out))`], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

test('uden API\'erne findes de efter import', () => {
  const o = kor(`out.a = [typeof Object.hasOwn, typeof [].at, typeof ''.at, typeof [].findLast, typeof [].findLastIndex, typeof structuredClone]`)
  assert.deepEqual(o.a, Array(6).fill('function'))
})

test('Object.hasOwn og at opfører sig som de rigtige', () => {
  const o = kor(`
    out.own = [Object.hasOwn({ a: 1 }, 'a'), Object.hasOwn({ a: 1 }, 'toString'), Object.hasOwn([1], 0)]
    out.at = [[1, 2].at(-1), [1, 2].at(0), [1, 2].at(5) ?? null, [1, 2].at(-3) ?? null, 'abc'.at(-1), [].at(-1) ?? null]
    out.nul = (() => { try { Object.hasOwn(null, 'a') } catch (e) { return e.name } })()`)
  assert.deepEqual(o.own, [true, false, true])
  assert.deepEqual(o.at, [2, 1, null, null, 'c', null])
  assert.equal(o.nul, 'TypeError')
})

test('findLast og findLastIndex', () => {
  const o = kor(`out.r = [[1, 2, 3, 4].findLast(x => x % 2), [1, 2, 3, 4].findLastIndex(x => x % 2), [1].findLast(x => x > 5) ?? null, [1].findLastIndex(x => x > 5)]`)
  assert.deepEqual(o.r, [3, 2, null, -1])
})

test('structuredClone kopierer dybt, bevarer typer og afviser funktioner', () => {
  const o = kor(`
    const kilde = { a: [1, { b: 2 }], d: new Date(5), m: new Map([[1, { x: 1 }]]), s: new Set([1]), u: undefined, n: null }
    kilde.selv = kilde
    const k = structuredClone(kilde)
    out.uafhaengig = k !== kilde && k.a !== kilde.a && k.a[1] !== kilde.a[1] && k.m.get(1) !== kilde.m.get(1)
    out.vaerdier = [k.a[1].b, k.d instanceof Date, k.d.getTime(), k.m.get(1).x, k.s.has(1), 'u' in k, k.n, k.selv === k]
    k.a[1].b = 9; out.original = kilde.a[1].b
    out.fn = (() => { try { structuredClone({ f() {} }) } catch (e) { return e.name } })()
    out.prim = [structuredClone(3), structuredClone('x'), structuredClone(null)]`)
  assert.equal(o.uafhaengig, true)
  assert.deepEqual(o.vaerdier, [2, true, 5, 1, true, true, null, true])
  assert.equal(o.original, 2)
  assert.equal(o.fn, 'DataCloneError')
  assert.deepEqual(o.prim, [3, 'x', null])
})

test('de rigtige API\'er røres ikke, når de findes', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const f = [Object.hasOwn, Array.prototype.at, globalThis.structuredClone]
    ${importer}
    console.log(f[0] === Object.hasOwn && f[1] === Array.prototype.at && f[2] === globalThis.structuredClone)`], { encoding: 'utf8' })
  assert.equal(r.stdout.trim(), 'true')
})

test('polyfills.js er første import i main.jsx og har ingen egne imports', async () => {
  const { readFileSync } = await import('node:fs')
  const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8')
  assert.equal(main.split('\n')[0].trim(), "import './polyfills.js'")
  assert.doesNotMatch(readFileSync(fil, 'utf8'), /^\s*import\s/m)
})
