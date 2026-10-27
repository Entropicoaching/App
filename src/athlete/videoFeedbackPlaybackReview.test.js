import test from 'node:test'
import assert from 'node:assert/strict'
import { mountFeedbackPlayback, parsePlaybackDocument, adjacentMarker } from './videoFeedbackPlayback.mjs'
import { document, walk } from './epikDom.mjs'
// Independent counterexamples on the delivered modules, synthetic files/media only.
const scope = { athleteId: 'a', analysisId: 'b' }
const packet = () => ({ schema: 'vc-epik2-playback/v1', status: 'ready', ...scope,
  clip: { name: 's.webm', type: 'video/webm', size: 1, sha256: 'a'.repeat(64), duration: 5, width: 100, height: 100 },
  markers: [{ id: 'one', start: 0, end: 1, text: 'Start', strokes: [] },
    { id: 'two', start: 0, end: 2, text: 'Samme tid', strokes: [] },
    { id: 'end', start: 4, end: 5, text: 'Slut', strokes: [] }] })
function mounted(digest = async () => 'a'.repeat(64)) {
  const root = document.createElement('section'), urls = [], revoked = []
  const dispose = mountFeedbackPlayback(root, scope, { digest, urlApi: {
    createObjectURL: () => { const url = 'blob:test-' + urls.length; urls.push(url); return url },
    revokeObjectURL: url => revoked.push(url),
  } })
  const [json, media] = walk(root, 'input'), video = walk(root, 'video')[0]
  const load = async value => { json.files = [{ size: 100, text: async () => JSON.stringify(value) }]; await json.fire('change') }
  const select = async () => { media.files = [{ name: 's.webm', type: 'video/webm', size: 1 }]; await media.fire('change') }
  return { root, json, media, video, load, select, dispose, urls, revoked }
}
test('counterprobe: same-time markers are directly accessible; next goes to next distinct timestamp', () => {
  const data = parsePlaybackDocument(packet(), scope)
  assert.equal(adjacentMarker(data.markers, 0, 1).start, 4)
  assert.equal(adjacentMarker(data.markers, 4, -1).start, 0)
  assert.equal(adjacentMarker(data.markers, 0, -1), null)
})
test('counterprobe: oversized or malformed JSON never invokes text parser or enables video', async () => {
  const x = mounted(); let reads = 0
  x.json.files = [{ size: 500001, text: async () => { reads++; return '{}' } }]
  await x.json.fire('change'); assert.equal(reads, 0); assert.equal(x.media.disabled, true)
  x.json.files = [{ size: 10, text: async () => '{bad json' }]
  await x.json.fire('change'); assert.equal(x.media.disabled, true)
  assert.equal(x.urls.length, 0); x.dispose()
})
test('counterprobe: superseded digest cannot attach a video to a newer document', async () => {
  let resolve
  const x = mounted(() => new Promise(done => { resolve = done }))
  await x.load(packet()); const pending = x.select()
  await x.load({ ...packet(), markers: [{ id: 'new', start: 2, end: 3, text: 'Ny', strokes: [] }] })
  resolve('a'.repeat(64)); await pending
  assert.equal(x.urls.length, 0); assert.equal(x.video.src, '')
  assert.match(x.root.textContent, /Ny/); x.dispose()
})
test('counterprobe: repeated document loads retain exactly one delegated list listener', async () => {
  const x = mounted()
  for (let i = 0; i < 20; i++) await x.load(packet())
  const lists = walk(x.root, 'div').filter(n => n.attrs['aria-label'] === 'Alle markeringer')
  assert.equal(lists[0].listeners.get('click').size, 1)
  assert.equal(lists[0].children.length, 3)
  await x.select(); Object.assign(x.video, { duration: 5, videoWidth: 100, videoHeight: 100 })
  await x.video.fire('loadedmetadata')
  await lists[0].children[2].fire('click'); assert.equal(x.video.currentTime, 4)
  x.dispose(); assert.equal(lists[0].listeners.get('click').size, 0)
  assert.deepEqual(x.revoked, x.urls)
})
test('counterprobe: cancelled media selection clears ready controls and old overlays', async () => {
  const x = mounted(); await x.load(packet()); await x.select()
  Object.assign(x.video, { duration: 5, videoWidth: 100, videoHeight: 100 }); await x.video.fire('loadedmetadata')
  assert.equal(walk(x.root, 'button')[2].disabled, false)
  x.media.files = []; await x.media.fire('change')
  assert.equal(walk(x.root, 'button').every(b => b.disabled), true)
  assert.equal(x.video.parentNode.hidden, true); assert.deepEqual(x.revoked, x.urls)
  x.dispose()
})
