// Test-only additive source contract. Snapshots are the pinned accepted REB-ANALYSE5.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const bytes = readFileSync(new URL('./analyse5ProtectedSources.json', import.meta.url))
assert.equal(createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex'), 'c8219db0a798d147153a8b19982b01706a058cf1e154daaf917110401cafedf9')
export const protectedSources = Object.freeze(JSON.parse(bytes))
export function assertProtectedLines(actual, expected, label = 'protected source') {
  const lines = actual.replace(/\r\n/g, '\n').split('\n')
  const required = expected.replace(/\r\n/g, '\n').split('\n')
  // The last split item is an EOF marker, not a protected empty line.
  if (required.at(-1) === '') required.pop()
  let cursor = 0
  for (const line of required) {
    const found = lines.indexOf(line, cursor)
    assert.notEqual(found, -1, label + ': missing or changed protected line ' + JSON.stringify(line))
    cursor = found + 1
  }
}
export function assertAcceptedSource(name, actual) {
  assert.ok(Object.hasOwn(protectedSources, name), 'undeclared protected source: ' + name)
  assertProtectedLines(actual, protectedSources[name], name)
}
