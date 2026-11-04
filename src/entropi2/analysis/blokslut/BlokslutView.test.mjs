import test from 'node:test'
import assert from 'node:assert/strict'
import BlokslutView from './BlokslutView.mjs'
import { renderTree } from '../testDom.mjs'
import { snapshot } from './blokslutFixture.mjs'
const view = extra => renderTree(BlokslutView(snapshot(extra)))

test('strict OFF never reads snapshot or clock', () => {
  for (const entropi2 of [undefined, false, null, 0, 1, 'true']) {
    const p = { entropi2 }
    for (const field of ['now', 'block', 'exerciseLogs', 'error', 'loading'])
      Object.defineProperty(p, field, { get() { throw Error('OFF read ' + field) } })
    assert.equal(BlokslutView(p), null)
  }
})

test('visible overview has strength, sessions, single focus and folded weekly volume', () => {
  const tree = view()
  assert.match(tree.textContent, /Pas gennemført: 3 af 3/)
  assert.match(tree.textContent, /Squat: 110 → 121 kg e1RM \(\+11 kg\)/)
  assert.match(tree.textContent, /Ét fokus til næste blok/)
  assert.match(tree.textContent, /Uge 1 .*1\.380 kg løftet/)
  assert.equal(tree.querySelectorAll('details').length, 1)
  assert.equal(tree.querySelectorAll('details')[0].getAttribute('open'), null)
  assert.match(tree.textContent, /Blokken er ikke afsluttet endnu/)
  assert.equal(tree.querySelectorAll('button').length, 0)
  assert.equal(tree.querySelectorAll('input').length, 0)
})

test('empty/missing/loading/error render honest states and no raw error', () => {
  const empty = view({ exerciseLogs: [] })
  assert.match(empty.textContent, /Ingen bekræftede træningssæt/)
  assert.doesNotMatch(empty.textContent, /→|\+11|0 kg e1RM/)
  for (const [extra, text] of [[{ exerciseLogs: undefined }, /logdata mangler/],
    [{ loading: true }, /Henter blokkens data/], [{ error: 'raw secret-free synthetic error' }, /kunne ikke hentes/]]) {
    const tree = view(extra)
    assert.match(tree.textContent, text); assert.doesNotMatch(tree.textContent, /raw secret|Pas gennemført|→/)
  }
  assert.equal(view({ error: true }).querySelectorAll('[role]')[0].getAttribute('role'), 'alert')
})
