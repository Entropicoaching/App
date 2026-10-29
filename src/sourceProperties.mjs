// Source contracts protect named properties rather than whole production files.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
export const sourceProperties = Object.freeze(JSON.parse(readFileSync(new URL('./sourceProperties.json', import.meta.url), 'utf8')))
export function assertSourceProperties(name, actual) {
  assert.ok(Object.hasOwn(sourceProperties, name), 'undeclared source property contract: ' + name)
  assert.equal(typeof actual, 'string', 'source must be text')
  const normalized = actual.replace(/\r\n/g, '\n')
  for (const fragment of sourceProperties[name].required) {
    assert.ok(normalized.includes(fragment), name + ': missing protected property ' + JSON.stringify(fragment))
  }
}
