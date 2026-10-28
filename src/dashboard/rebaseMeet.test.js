import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './coachMeetLoader.mjs'
install()
const { coachMeetSoonFlag, CoachMeetSoon, readMeetSource } = await import('./coachMeetSoon.mjs')

test('rebase counter: strict OFF never touches athlete data or capture state', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF touched data') } })
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    assert.equal(CoachMeetSoon({ enabled, athletes: poison }), null)
    const promise = Promise.resolve({ data: [] })
    assert.equal(readMeetSource(enabled, 'logs', poison, () => assert.fail('OFF captured'), () => promise), promise)
  }
  for (const search of ['', '?coachStaevne=1&coachStaevne=1', '?rel1030=1', '?coachStaevne=true']) assert.equal(coachMeetSoonFlag(search), false)
})

test('rebase counter: third capture wins over two late responses and preserves return values', async () => {
  let state = {}, finishA, finishB
  const update = fn => { state = fn(state) }
  const first = readMeetSource(true, 'logs', ['a'], update, () => new Promise(resolve => { finishA = resolve }))
  const second = readMeetSource(true, 'logs', ['b'], update, () => new Promise(resolve => { finishB = resolve }))
  const response = { data: [{ athlete_id: 'c' }], error: null }
  assert.equal(await readMeetSource(true, 'logs', ['c'], update, () => response), response)
  finishB({ data: [], error: Error('late') }); finishA({ data: [] })
  await Promise.all([first, second])
  assert.equal(state.logs.state, 'ready')
  assert.deepEqual(state.logs.ids, ['c'])
  assert.equal(state.logs.rows, response.data)
})

test('rebase counter: test-loader UI hooks stay fail closed', async () => {
  // The reader-only legacy adapter must import real meet code without permitting UI execution.
  const source = await import('./testLoader.mjs')
  assert.equal(typeof source.resolve, 'function')
  const result = source.resolve('react', { parentURL: new URL('./coachMeetSoon.mjs', import.meta.url).href }, () => assert.fail('unscoped resolver'))
  const react = await import(result.url)
  assert.throws(() => react.useEffect(() => {}), /Unexpected meet UI hook/)
  assert.throws(() => react.useState(1), /Unexpected legacy hook/)
})
