import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseHelpLookup } from './exerciseHelpLookup.mjs'
import { oevelsesForklaringer } from './oevelsesForklaringer.mjs'

test('all documented exact names return the existing variant and unchanged content', () => {
  const before = JSON.stringify(oevelsesForklaringer)
  for (const item of oevelsesForklaringer) {
    assert.equal(exerciseHelpLookup(item.name), item)
    assert.equal(item.fokuspunkter.length, 3)
  }
  assert.equal(JSON.stringify(oevelsesForklaringer), before)
})

test('Danish exact names retain accents and do not guess ambiguous or custom variants', () => {
  assert.equal(exerciseHelpLookup('Bænkpres med håndvægte').id, 'haandvaegt-baenkpres')
  assert.equal(exerciseHelpLookup('Stående lægløft').id, 'staaende-laegloeft')
  for (const name of ['Bænkpres', 'Squat', 'Dødløft', 'baenkpres', 'squat',
    'Bænkpres med håndvægte (pause)', 'Skrå bænkpres', 'Siddende lægløft',
    'bænkpres med håndvægte', ' Bænkpres med håndvægte', 'Bænkpres med håndvægte ',
    'Bænkpres med haandvaegte', 'Min egen variant', '__proto__', 'constructor']) {
    assert.equal(exerciseHelpLookup(name), null, name)
  }
})

test('missing, non-string and ID-shaped inputs never supply a name match', () => {
  for (const value of [undefined, null, '', false, 0, [], {},
    { id: 'baenkpres', name: 'Bænkpres med stang' }]) assert.equal(exerciseHelpLookup(value), null)
})
