import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './nytTestLoader.mjs'
import { mount, text, button } from './nytTestDom.mjs'
install()
const { default: NytIAppen, nytStorageKey } = await import('./nytIAppen.mjs')
const { nytIAppenText: copy } = await import('./nytIAppenText.mjs')
const base = { search: '?rel1030=1', role: 'athlete', profileId: 'synthetic-A', onNavigate() {} }

test('OFF, malformed flags and missing identity never touch even a throwing storage getter', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let reads = 0
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { reads++; throw Error('denied') } })
  try {
    for (const search of ['', '?rel1030=0', '?rel1030=true', '?rel1030=1&rel1030=1', '?rel1030=1&rel1030=0']) {
      assert.equal(mount(NytIAppen, { ...base, search }).render(), null)
    }
    for (const change of [{ profileId: '' }, { profileId: null }, { role: null }, { role: 'preview' }]) {
      assert.equal(mount(NytIAppen, { ...base, ...change }).render(), null)
    }
    assert.equal(reads, 0)
    const ui = mount(NytIAppen, base)
    button(ui.render(), copy.close).onClick()
    assert.equal(ui.render(), null)
  } finally {
    Object.defineProperty(globalThis, 'localStorage', descriptor || { configurable: true, value: undefined })
  }
})

test('storage read/write failures close in memory, without contaminating another identity', () => {
  let writes = 0
  const storage = { getItem() { throw Error('read denied') }, setItem() { writes++; throw Error('quota') } }
  const p = { ...base, storage }, ui = mount(NytIAppen, p)
  assert.match(text(ui.render()), /Nyt i appen/)
  button(ui.render(), copy.close).onClick()
  assert.equal(writes, 1)
  assert.equal(ui.render(), null)
  assert.match(text(ui.render({ ...p, profileId: 'synthetic-B' })), /Nyt i appen/)
  assert.match(text(mount(NytIAppen, p).render()), /Nyt i appen/)
})

test('arbitrary storage values cannot dismiss the card and keys cannot collide', () => {
  for (const value of ['true', '1', '{}', '', null]) {
    assert.match(text(mount(NytIAppen, { ...base, storage: { getItem: () => value } }).render()), /Nyt i appen/)
  }
  assert.notEqual(nytStorageKey('athlete', 'a:coach:b'), nytStorageKey('coach', 'a:athlete:b'))
})

test('empty coach picker navigates nowhere and another destination replaces the pending choice', () => {
  const calls = [], p = { ...base, role: 'coach', storage: null, athletes: [], onNavigate: (...args) => calls.push(args) }
  const ui = mount(NytIAppen, p)
  button(ui.render(), copy.items.find(i => i.id === 'analyse').label).onClick()
  assert.match(text(ui.render()), /Ingen atleter/)
  assert.deepEqual(calls, [])
  button(ui.render(), copy.items.find(i => i.id === 'fremgang').label).onClick()
  button(ui.render({ ...p, athletes: [{ id: 'synthetic-B', name: 'B' }] }), 'B').onClick()
  assert.deepEqual(calls, [['fremgang', { id: 'synthetic-B', name: 'B' }]])
})
