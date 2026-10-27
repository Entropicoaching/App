import test from 'node:test'
import assert from 'node:assert/strict'
import { install, sourceURL } from '../fremgangLoader.mjs'
install()
const { readMorningSource, coachMorningFlag } = await import(sourceURL('coachMorningSource.mjs').href)
const { lavLaesninger } = await import(sourceURL('coachLaesninger.js').href)

test('K-R1 regression: fremgang loader imports the real pure capture and coach handler', async () => {
  assert.equal(typeof lavLaesninger, 'function')
  assert.equal(coachMorningFlag(''), false)
  assert.equal(coachMorningFlag('?coachMorgen=1'), true)
  const promise = Promise.resolve({ data: [], error: null })
  assert.equal(readMorningSource(false, 'logs', [], () => assert.fail('OFF wrote state'), () => promise), promise)
  let state = {}
  await readMorningSource(true, 'logs', ['synthetic-a'], fn => { state = fn(state) }, () => promise)
  assert.equal(state.logs.state, 'ready')
  assert.deepEqual(state.logs.ids, ['synthetic-a'])
  assert.deepEqual(state.logs.rows, [])
})

test('counter: actual capture under fremgang loader retains failed reads as unknown', async () => {
  let state = {}
  await readMorningSource(true, 'videos', ['synthetic-a'], fn => { state = fn(state) }, () => { throw Error('synthetic read failure') })
  assert.equal(state.videos.state, 'error')
  assert.deepEqual(state.videos.rows, [])
})
