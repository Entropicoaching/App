// Ordre 1526 (QA 1519 fund 2 paa 1516): JS-reglen og SQL v3 holdes ens af den almindelige suite.
// Koerer proeve-scriptet (lokal pglite, opdigtede data, ingen netvaerk/Supabase) og kraever groen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'

test('migration v3: JS og SQL giver samme stagnationssignal for alle proeve-atleter', { timeout: 120000 }, () => {
  const r = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'scripts', 'proeve-migration-v3.mjs')], { encoding: 'utf8', timeout: 110000 })
  assert.equal(r.status, 0, `proeve-scriptet fejlede:\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /Proeven er groen: JS og SQL v3 ens for alle \d+ atleter/)
})
