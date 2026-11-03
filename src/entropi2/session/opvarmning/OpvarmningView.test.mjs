import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpvarmning } from './OpvarmningView.mjs'
import { syntheticDom } from '../sessionSyntheticDom.mjs'

test('strict OFF reads no work set and never accesses DOM', () => {
  const doc = new Proxy({}, { get() { throw Error('OFF DOM access') } })
  for (const enabled of [undefined, false, 0, 1, 'true'])
    assert.equal(createOpvarmning(doc, { enabled,
      get firstWorkSet() { throw Error('OFF data access') } }), null)
  assert.equal(createOpvarmning(doc), null)
})

test('actual view module produces accessible ordered suggestions with Danish kg', () => {
  const { doc, root, timers } = syntheticDom()
  const input = Object.freeze({ enabled: true, firstWorkSet: Object.freeze({ weight: 52.5 }) })
  const view = createOpvarmning(doc, input)
  assert.equal(view.getAttribute('aria-label'), 'Forslag til opvarmning')
  assert.equal(view.getAttribute('class'), 'e2-opvarmning')
  assert.equal(view.querySelectorAll('h2').length, 1)
  assert.equal(view.querySelectorAll('ol').length, 1)
  assert.deepEqual(view.querySelectorAll('li').map(n => n.textContent), [
    '20 kg × 5 gentagelser (38 % af arbejdsvægten)',
    '32,5 kg × 3 gentagelser (62 % af arbejdsvægten)',
    '42,5 kg × 1 gentagelse (81 % af arbejdsvægten)',
  ])
  assert.match(view.textContent, /første arbejdssæt på 52,5 kg/)
  assert.match(view.textContent, /registreres ikke som arbejdssæt/)
  assert.equal(root.children.length, 0) // Caller owns mounting.
  assert.equal(timers.size, 0)
  assert.equal(view.querySelectorAll('button,input,form').length, 0)
})

test('four/five row views and missing or light loads are honest', () => {
  const { doc } = syntheticDom()
  for (const [weight, count] of [[100, 4], [200, 5]])
    assert.equal(createOpvarmning(doc, { enabled: true, firstWorkSet: { weight } }).querySelectorAll('li').length, count)
  for (const firstWorkSet of [undefined, {}, { weight: 0 }, { weight: 7.5 }, { weight: NaN }]) {
    const view = createOpvarmning(doc, { enabled: true, firstWorkSet })
    assert.equal(view.querySelectorAll('li').length, 0)
    assert.match(view.textContent, /Intet beregnet forslag/)
    assert.doesNotMatch(view.textContent, /NaN|undefined|Infinity/)
  }
})
