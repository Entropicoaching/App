import test from 'node:test'
import assert from 'node:assert/strict'
import { mountProteinDistribution } from './proteinDistributionView.mjs'
import { Element, syntheticHost } from '../synthetic-dom.mjs'

// Add standard parent/removal behavior to the pinned minimal DOM fixture.
function hostFixture() {
  const host = syntheticHost()
  const create = host.ownerDocument.createElement.bind(host.ownerDocument)
  host.ownerDocument.createElement = tag => {
    const node = create(tag)
    node.removeChild = child => { node.children = node.children.filter(n => n !== child); child.parentNode = null }
    node.append = (...children) => {
      Element.prototype.append.call(node, ...children)
      for (const child of children) child.parentNode = node
    }
    return node
  }
  const root = host.ownerDocument.createElement('div')
  return root
}

test('default OFF and non-true flags do not access host or input', () => {
  const host = new Proxy({}, { get() { throw new Error('host touched while OFF') } })
  mountProteinDistribution(host)()
  for (const enabled of [false, null, 0, 1, 'true']) {
    mountProteinDistribution(host, { enabled, get meals() { throw new Error('input touched') } })()
  }
})

test('actual mounted view: semantic list, text-only labels, unknown versus zero; own subtree cleanup', () => {
  const host = hostFixture(), sibling = host.ownerDocument.createElement('p')
  sibling.textContent = 'Bevar'; host.append(sibling)
  const dispose = mountProteinDistribution(host, { enabled: true, meals: [
    { meal: '<img src=x onerror=alert(1)>', protein: 0 },
    { meal: 'Frokost', protein: '25,5' }, { meal: 'Aften', protein: null },
  ] })
  assert.equal(host.querySelectorAll('section')[0].getAttribute('aria-label'), 'Dagens proteinfordeling')
  assert.equal(host.querySelectorAll('li').length, 3)
  assert.match(host.textContent, /3–5 måltider med 20–40 g/)
  assert.match(host.textContent, /0 g protein/)
  assert.match(host.textContent, /25,5 g protein/)
  assert.match(host.textContent, /Protein ikke angivet/)
  assert.match(host.textContent, /Kendt protein: 25,5 g/)
  assert.match(host.textContent, /Dagen kan være ufuldstændig/)
  assert.equal(host.querySelectorAll('img').length, 0)
  assert.match(host.textContent, /<img src=x onerror=alert\(1\)>/)
  dispose(); dispose()
  assert.deepEqual(host.children, [sibling])
})

test('unavailable, empty, complete and overflow states render separately; mounts remain independent', () => {
  for (const [meals, expected] of [[undefined, 'ikke tilgængelige'], [[], 'Ingen måltider'],
    [[{ protein: 20 }, { protein: 40 }], 'Registreret protein: 60 g'],
    [[{ protein: Number.MAX_VALUE }, { protein: Number.MAX_VALUE }], 'kan ikke vises samlet']]) {
    const host = hostFixture()
    const dispose = mountProteinDistribution(host, { enabled: true, meals })
    assert.ok(host.textContent.includes(expected)); dispose()
    assert.equal(host.children.length, 0)
  }
  const host = hostFixture()
  const first = mountProteinDistribution(host, { enabled: true, meals: [{ protein: 20 }] })
  const second = mountProteinDistribution(host, { enabled: true, meals: [{ protein: 40 }] })
  first(); assert.equal(host.querySelectorAll('section').length, 1)
  assert.match(host.textContent, /Registreret protein: 40 g/)
  second(); assert.equal(host.children.length, 0)
})
