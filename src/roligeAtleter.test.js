import test from 'node:test'
import assert from 'node:assert/strict'
import { roligeAtleter, roligLinje } from './roligeAtleter.js'

const atleter = [
  { id: 'a', name: 'Alfa Testsen' }, { id: 'b', name: 'Bravo Testsen' },
  { id: 'c', name: 'Charlie Testsen' }, { id: 'd', name: 'Delta Testsen' },
  { id: 'e', name: 'Echo Testsen' }, { id: 'f', name: 'Foxtrot Testsen' },
]
const status = new Map([
  ['a', { pasLogget: 3, stemme: { laveste: 4 } }],
  ['b', { pasLogget: 2, stemme: { laveste: 5 } }],
  ['c', { pasLogget: 0, stemme: null }],
  ['d', { pasLogget: 2, stemme: { laveste: 2 } }],
  ['e', { pasLogget: 1, stemme: null }],
])

test('rolig: logget, ingen aaben ting, vurdering 3 eller mere eller ingen', () => {
  const r = roligeAtleter({ atleter, aabneIds: [], ugeStatus: status })
  assert.deepEqual(r.map(a => a.id), ['a', 'b', 'e'])
})

test('en aaben ting goer atleten urolig', () => {
  const r = roligeAtleter({ atleter, aabneIds: ['a'], ugeStatus: status })
  assert.deepEqual(r.map(a => a.id), ['b', 'e'])
})

test('ikke-startet (0 pas) og ukendt atlet er aldrig rolig', () => {
  const r = roligeAtleter({ atleter, aabneIds: [], ugeStatus: status })
  assert.ok(!r.some(a => a.id === 'c' || a.id === 'f'))
})

test('vurdering 2 er ikke rolig, 3 er', () => {
  const s = new Map([['a', { pasLogget: 1, stemme: { laveste: 3 } }], ['b', { pasLogget: 1, stemme: { laveste: 2 } }]])
  assert.deepEqual(roligeAtleter({ atleter, ugeStatus: s }).map(a => a.id), ['a'])
})

test('RPE spiller ingen rolle', () => {
  const s = new Map([['a', { pasLogget: 1, stemme: null, rpeDrift: 3 }]])
  assert.equal(roligeAtleter({ atleter, ugeStatus: s }).length, 1)
})

test('fejlede sæt, færre reps end planlagt eller skip gør atleten ikke rolig (1588)', () => {
  const ok = { pasLogget: 2, stemme: { laveste: 4 } }
  const s = new Map([
    ['a', { ...ok, saetUnderPlan: 1 }],
    ['b', { ...ok, sprungneSaet: 2 }],
    ['c', { ...ok, saetUnderPlan: 0, sprungneSaet: 0 }],
    ['d', ok],
  ])
  assert.deepEqual(roligeAtleter({ atleter, ugeStatus: s }).map(a => a.id), ['c', 'd'])
})

test('linjen: intet naar ingen, fornavne, maks tre og rest som tal', () => {
  assert.equal(roligLinje([], 6), null)
  assert.equal(roligLinje([atleter[0], atleter[1]], 6), 'Set igennem, intet kræver dig: Alfa, Bravo (2 af 6)')
  assert.equal(roligLinje(atleter.slice(0, 5), 6), 'Set igennem, intet kræver dig: Alfa, Bravo, Charlie og 2 til (5 af 6)')
  assert.ok(!roligLinje(atleter, 6).includes('—'))
})
