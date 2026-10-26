// Ordre 1526 (QA 1519 fund 2 paa 1516): JS-reglen og SQL v3 holdes ens af den almindelige suite.
// Koerer proeve-scriptet (lokal pglite, opdigtede data, ingen netvaerk/Supabase) og kraever groen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'
import { mkdtempSync, openSync, closeSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

test('migration v3: JS og SQL giver samme stagnationssignal for alle proeve-atleter', { timeout: 120000 }, () => {
  // Capture to a regular file: some Node 24 runtimes lose asynchronous console
  // writes when a synchronous parent captures the child's output through pipes.
  const dir = mkdtempSync(join(tmpdir(), 'entropi-migration-'))
  const path = join(dir, 'result.log')
  const fd = openSync(path, 'w')
  try {
    const r = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'scripts', 'proeve-migration-v3.mjs')], { timeout: 110000, stdio: ['ignore', fd, fd] })
    const output = readFileSync(path, 'utf8')
    assert.equal(r.status, 0, `proeve-scriptet fejlede:\n${output}`)
    assert.match(output, /Proeven er groen: JS og SQL v3 ens for alle \d+ atleter/)
  } finally {
    closeSync(fd)
    rmSync(dir, { recursive: true, force: true })
  }
})
