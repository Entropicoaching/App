import test from 'node:test'
import assert from 'node:assert/strict'
import { createRegistry } from '../testModuleRegistry.mjs'
import { readFileSync } from 'node:fs'
import { snapshotFiles } from '../registryTestFiles.mjs'

test('count helper is an explicit leaf in the existing closed test registry', () => {
  const registry = createRegistry()
  const entry = registry.data.modules.find(row => row.path === 'src/entropi2/antalOrd.mjs')
  assert.ok(entry)
  assert.deepEqual(entry.imports, {})
  assert.equal(entry.legacyImporters, undefined)
  const loader = 'src/athlete/prog3Loader.mjs'
  const parent = new URL('./ProgramTab.jsx', import.meta.url).href
  const target = new URL('../entropi2/antalOrd.mjs', import.meta.url).href
  assert.equal(registry.lookup(loader, '../entropi2/antalOrd.mjs', parent).url, target)
  for (const specifier of ['../entropi2/antalOrd', '../entropi2/antalOrd.mjs?x', '../entropi2/antalOrd.mjs#x',
    '../athlete/../entropi2/antalOrd.mjs', '../entropi2/ANTALORD.mjs', 'node:fs']) {
    assert.equal(registry.lookup(loader, specifier, parent), null, specifier)
  }
  assert.equal(registry.lookup(loader, '../entropi2/antalOrd.mjs', new URL('./KostKort.jsx', import.meta.url).href), null)
  for (const specifier of ['node:fs', '../calendarDate.js', 'react']) assert.equal(registry.lookup(loader, specifier, target), null)
})

test('closed fixture copies include the actual count helper without admitting its directory', () => {
  const root = new URL('../../', import.meta.url)
  const graph = JSON.parse(readFileSync(new URL('src/trin1Imports.json', root), 'utf8'))
  const helper = 'src/entropi2/antalOrd.mjs'
  assert.deepEqual(graph[helper], {}, 'trin1 counterexamples must copy the dependency leaf')
  const files = snapshotFiles(root)
  const url = new URL(helper, root).href
  assert.equal(files.get(url), readFileSync(new URL(helper, root), 'utf8'))
  assert.equal(files.has(new URL('src/entropi2/antalTekstCases.mjs', root).href), false,
    'the closed snapshot must not recursively admit the count helper directory')
})
