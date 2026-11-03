import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticDom } from '../sessionSyntheticDom.mjs'
import { mountTempoView } from './tempoView.mjs'

test('actual view: ordered explanation and planned pause, update clears stale content', () => {
  const { root } = syntheticDom()
  const view = mountTempoView(root, { enabled: true, tempo: '3-1-X-0', restSeconds: 90 })
  assert.equal(root.querySelector('section').getAttribute('aria-label'), 'Tempo og planlagt pause')
  assert.deepEqual(root.querySelectorAll('li').map(n => n.textContent), [
    'Sænkning: 3 sek.', 'Pause efter sænkning: 1 sek.', 'Løft: eksplosivt', 'Pause efter løft: 0 sek.',
  ])
  assert.match(root.textContent, /Planlagt pause mellem sæt: 1 min. 30 sek./)
  view.update({ enabled: true, tempo: 'bad', restSeconds: '1:60' })
  assert.equal(root.querySelectorAll('li').length, 0)
  assert.match(root.textContent, /Tempo kan ikke vises/)
  assert.match(root.textContent, /Planlagt pause kan ikke vises/)
  assert.doesNotMatch(root.textContent, /1 min. 30 sek./)
  view.update({ enabled: true, restSeconds: 0 })
  assert.match(root.textContent, /Tempo er ikke angivet/)
  assert.match(root.textContent, /Ingen planlagt pause \(0 sek.\)/)
  view.update({ enabled: true })
  assert.match(root.textContent, /Pause mellem sæt er ikke angivet/)
})

test('OFF touches no DOM; mounts, updates and disposal preserve host and other instances', () => {
  const off = mountTempoView(null)
  off.update({ enabled: 'true' }); off.dispose(); off.update({ enabled: true })
  const { root, doc, timers } = syntheticDom()
  const host = doc.createElement('p'); host.textContent = 'Host'; root.append(host)
  const props = Object.freeze({ enabled: true, tempo: '3-1-1-0', restSeconds: 60 })
  const first = mountTempoView(root, props)
  const second = mountTempoView(root, { enabled: true, tempo: '2-0-1-0', restSeconds: 120 })
  first.update({ enabled: false })
  assert.equal(root.children.length, 2)
  assert.match(root.textContent, /2-0-1-0/)
  first.update(props); first.dispose(); first.dispose(); first.update(props)
  assert.equal(root.children.length, 2)
  second.dispose()
  assert.deepEqual(root.children, [host])
  assert.equal(timers.size, 0)
})

test('hostile content is never rendered as markup; view has no controls or live countdown', () => {
  const { root } = syntheticDom()
  const view = mountTempoView(root, { enabled: true, tempo: '<script>alert(1)</script>', restSeconds: '<img onerror=x>' })
  assert.equal(root.querySelectorAll('script,img,input,button,[aria-live]').length, 0)
  assert.doesNotMatch(root.textContent, /alert|onerror/)
  view.dispose()
})
