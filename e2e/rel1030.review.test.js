import { test } from 'node:test'
import assert from 'node:assert/strict'
import { install } from './rel1030Harness.mjs'
const hook=install()
const { rel1030Enabled, rel1030Mobility } = await import('../src/rel1030.mjs')
const { videoFeedbackPlaybackEnabled } = await import('../src/athlete/videoFeedbackPlayback.mjs')
const { analyseSamletEnabled } = await import('../src/dashboard/analyseSamlet.mjs')
hook.deregister()

test('counterexample: closing a selected URL cannot persist release activation', () => {
  const storage={getItem:() => null,setItem:() => {throw Error('Write forbidden')}}
  globalThis.window={location:{search:'?rel1030=1'}}
  assert.equal(videoFeedbackPlaybackEnabled(storage),true)
  globalThis.window={location:{search:''}}
  assert.equal(videoFeedbackPlaybackEnabled(storage),false)
  assert.equal(analyseSamletEnabled(''),false)
  delete globalThis.window
  assert.equal(videoFeedbackPlaybackEnabled(storage),false)
})

test('counterexample: unrelated parameters, encoded values and ambiguous duplicates do not opt in', () => {
  for (const search of ['?next=%3Frel1030%3D1','?rel1030=1%20','?rel1030=%31%00','?rel1030=1&rel1030=', '?rel1030=01']) assert.equal(rel1030Enabled(search),false,search)
  assert.equal(rel1030Enabled('?other=1&rel1030=%31'),true)
})

test('counterexample: bundle does not mutate caller props or activate unrelated flags', () => {
  const before=Object.freeze({mobilitetHjalp:false,programUgeFoerst:false,kostPerAtlet:false,forenklinger:false})
  const next=rel1030Mobility(before,'?rel1030=1')
  assert.equal(before.mobilitetHjalp,false)
  assert.deepEqual(Object.keys(next).sort(), [...Object.keys(before),'mobilitetFokus','mobilitetFoerPas'].sort())
  assert.equal(next.programUgeFoerst,false)
  assert.equal(next.kostPerAtlet,false)
  assert.equal(next.forenklinger,false)
})
