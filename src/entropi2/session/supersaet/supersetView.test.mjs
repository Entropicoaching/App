import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticDom } from '../sessionSyntheticDom.mjs'
import { mountSupersetView } from './supersetView.mjs'

const exercises = [
  { id: 'a', name: '<img src=x onerror=bad()>', sets: 2, note: 'Supersæt: A; Pause 1 min' },
  { id: 'b', name: 'Træk', sets: 1, note: 'Supersæt: A' },
]

test('actual mounted view exposes ordered sets, planned pauses and plain text', () => {
  const { root } = syntheticDom()
  mountSupersetView(root, { enabled: true, exercises })
  assert.equal(root.querySelector('[data-e2-supersaet]').getAttribute('aria-label'), 'Øvelsesgrupper og rækkefølge')
  assert.equal(root.querySelector('h4').textContent, 'Supersæt A')
  assert.equal(root.querySelector('ol').getAttribute('aria-label'), 'Supersæt A: sæt i rækkefølge')
  assert.deepEqual(root.querySelectorAll('li').map(n => n.textContent), [
    'Runde 1: <img src=x onerror=bad()>, sæt 1. Fortsæt til næste øvelse.',
    'Runde 1: Træk, sæt 1. Pause 60 sek.',
    'Runde 2: <img src=x onerror=bad()>, sæt 2. Pause 60 sek.',
  ])
  assert.equal(root.querySelector('img'), null)
})

test('OFF is strictly inert even without a DOM, and only literal true enables', () => {
  const view = mountSupersetView(null)
  view.update({ enabled: 'true', exercises }); view.dispose(); view.update({ enabled: true })
  const { root } = syntheticDom()
  const host = root.ownerDocument.createElement('p'); host.textContent = 'Host'; root.append(host)
  const mounted = mountSupersetView(root, { enabled: 1 })
  assert.deepEqual(root.children, [host])
  mounted.update({ enabled: true, exercises }); mounted.update({ enabled: false })
  assert.deepEqual(root.children, [host])
})

test('update replaces stale data, handles empty/errors, dispose is terminal and instance scoped', () => {
  const { root } = syntheticDom()
  const first = mountSupersetView(root, { enabled: true, exercises })
  const second = mountSupersetView(root, { enabled: true })
  first.update({ enabled: true, exercises: [{ name: 'Ny', sets: 'bad', note: 'Cirkel: B' }] })
  assert.doesNotMatch(root.textContent, /Træk|Pause 60/)
  assert.match(root.textContent, /antal sæt kan ikke læses/)
  assert.match(root.textContent, /Ingen planlagte sæt/)
  assert.match(root.textContent, /Pause er ikke angivet/)
  first.update({ enabled: true })
  assert.doesNotMatch(root.textContent, /Ny|antal sæt kan ikke læses/)
  first.dispose(); first.dispose(); first.update({ enabled: true, exercises })
  assert.equal(root.querySelectorAll('[data-e2-supersaet]').length, 1)
  second.dispose(); assert.equal(root.children.length, 0)
})
