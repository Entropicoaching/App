// Separate checks with literal expectations, independent of volumeModel's output.
import test from 'node:test'
import assert from 'node:assert/strict'
import Volume from './Volume.mjs'

const text = n => n == null || typeof n === 'boolean' ? '' : typeof n !== 'object' ? String(n) : [n.props.children].flat(Infinity).map(text).join('|')
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props.children].flat(Infinity).flatMap(nodes)]

test('review: rendering uses only the supplied snapshot; no I/O or scheduling', () => {
  const keys = ['fetch', 'localStorage', 'sessionStorage', 'setTimeout', 'setInterval']
  const original = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error(`Forbidden ${key}`) } })
    const props = { entropi2: true, volumeLoading: false, now: '2027-01-05', volumeLogs: [
      { exercises: { name: 'Squat' }, logged_at: '2027-01-04' },
      { exercises: { name: 'Squat' }, logged_at: '2027-01-03' },
      { exercises: { name: 'Squat' }, logged_at: '2027-01-03' },
    ] }
    const tree = Volume(props)
    const rows = nodes(tree).filter(n => n.type === 'tr').slice(1)
    assert.equal(rows.length, 4)
    assert.equal(text(rows[0]), 'Knæ-strækkere|1|2')
    assert.equal(text(rows[1]), 'Hoftestrækkere|1|2')
    assert.equal(text(rows[2]), 'Rygstrækkere|0,5|1')
    assert.equal(text(rows[3]), 'Læggen|0,5|1')
    assert.match(text(tree), /uge 1, 2027/)
    assert.match(text(tree), /uge 53, 2026/)
    assert.equal(text(Volume(props)), text(tree))
    assert.equal(nodes(tree).filter(n => typeof n.props?.onClick === 'function').length, 0)
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})

test('review: loading stale data never presents old totals or a false empty state', () => {
  const tree = Volume({ entropi2: true, volumeLoading: true, now: '2026-11-03', volumeLogs: [
    { exercises: { name: 'Squat' }, logged_at: '2026-11-03' },
  ] })
  assert.equal(nodes(tree).filter(n => n.type === 'table').length, 0)
  assert.equal(text(nodes(tree).find(n => n.props?.role === 'status')), 'Henter din volumen…')
  assert.doesNotMatch(text(tree), /Knæ|ikke gennemført/)
})


test('review: first render is loading, including an unconfirmed empty snapshot', () => {
  for (const props of [{}, { volumeLogs: [] }]) {
    const tree = Volume({ entropi2: true, ...props })
    assert.equal(text(nodes(tree).find(n => n.props?.role === 'status')), 'Henter din volumen…')
    assert.doesNotMatch(text(tree), /ikke gennemført/)
  }
})

test('review: failed reads show a safe alert and hide stale or empty history', () => {
  for (const volumeLogs of [[], [{ exercises: { name: 'Squat' }, logged_at: '2026-11-03' }]]) {
    const tree = Volume({ entropi2: true, volumeLogs, volumeLoading: false, volumeError: Error('synthetic private detail') })
    assert.equal(text(nodes(tree).find(n => n.props?.role === 'alert')), 'Din volumen kunne ikke hentes. Prøv at åbne fanen igen.')
    assert.equal(nodes(tree).filter(n => n.type === 'table').length, 0)
    assert.doesNotMatch(text(tree), /ikke gennemført|synthetic private detail/)
  }
})

import { initialVolumeState, volumeReadReducer } from './volumeReadState.mjs'
test('review: owner state transitions distinguish pending, empty success, failure and retry', () => {
  const view = state => text(Volume({ entropi2: true, ...state }))
  assert.equal(initialVolumeState.volumeLoading, true)
  assert.match(view(initialVolumeState), /Henter din volumen/)
  const empty = volumeReadReducer(initialVolumeState, { type: 'success', logs: [] })
  assert.equal(empty.volumeLoading, false)
  assert.match(view(empty), /ikke gennemført/)
  const failed = volumeReadReducer(empty, { type: 'error' })
  assert.equal(failed.volumeLoading, false)
  assert.match(view(failed), /kunne ikke hentes/)
  assert.doesNotMatch(view(failed), /ikke gennemført/)
  const retry = volumeReadReducer(failed, { type: 'start' })
  assert.deepEqual(retry, initialVolumeState)
  assert.match(view(retry), /Henter din volumen/)
  for (const logs of [null, undefined, {}]) {
    assert.match(view(volumeReadReducer(retry, { type: 'success', logs })), /kunne ikke hentes/)
  }
  const success = volumeReadReducer(retry, { type: 'success', logs: [
    { exercises: { name: 'Squat' }, logged_at: new Date().toISOString() },
  ] })
  assert.match(view(success), /Knæ-strækkere/)
  assert.equal(volumeReadReducer(success, { type: 'unknown' }), success)
})
