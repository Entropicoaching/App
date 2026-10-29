// Test-only additive source contract. Only concrete accepted control lines are protected; unrelated code may evolve.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const bytes = readFileSync(new URL('./analyse5ProtectedLines.json', import.meta.url))
export const protectedSources = Object.freeze(JSON.parse(bytes))
export function assertProtectedLines(actual, expected, label = 'protected source') {
  const lines = actual.replace(/\r\n/g, '\n').split('\n')
  const required = expected.replace(/\r\n/g, '\n').split('\n')
  // Each required fragment protects a control property; unrelated inline additions are allowed.
  // The last split item is an EOF marker, not a protected empty line.
  if (required.at(-1) === '') required.pop()
  let cursor = 0
  for (const line of required) {
    const found = lines.findIndex((actualLine, index) => index >= cursor && actualLine.includes(line))
    assert.notEqual(found, -1, label + ': missing or changed protected line ' + JSON.stringify(line))
    cursor = found + 1
  }
}
export function assertAcceptedSource(name, actual) {
  assert.ok(Object.hasOwn(protectedSources, name), 'undeclared protected source: ' + name)
  assertProtectedLines(actual, protectedSources[name], name)
}
