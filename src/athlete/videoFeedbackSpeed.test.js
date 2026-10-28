import test from 'node:test'
import assert from 'node:assert/strict'
import { mountFeedbackPlayback, parsePlaybackDocument, adjacentFrameTime } from './videoFeedbackPlayback.mjs'
import { document, walk } from './epikDom.mjs'
const scope = { athleteId: 'a', analysisId: 'b' }
const packet = () => ({ schema: 'vc-epik2-playback/v1', status: 'ready', ...scope,
  clip: { name: 'fake.webm', type: 'video/webm', size: 1, sha256: 'a'.repeat(64), duration: 1, width: 100, height: 100,
    frameTimes: [0, 0.04, 0.1, 0.18, 0.3, 0.7] },
  markers: [{ id: 'm', start: 0.1, end: 0.3, text: 'Se her',
    strokes: [{ color: '#ffcc00', points: [[0,0], [1,1]] }] }] })
async function setup(data = packet()) {
  const root = document.createElement('section')
  const dispose = mountFeedbackPlayback(root, scope, { digest: async () => 'a'.repeat(64),
    urlApi: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} } })
  const [json, media] = walk(root, 'input'), video = walk(root, 'video')[0]
  const load = async value => { json.files = [{ size: 100, text: async () => JSON.stringify(value) }]; await json.fire('change') }
  await load(data)
  media.files = [{ name: 'fake.webm', type: 'video/webm', size: 1 }]; await media.fire('change')
  Object.assign(video, { duration: 1, videoWidth: 100, videoHeight: 100 }); await video.fire('loadedmetadata')
  const button = label => walk(root, 'button').find(b => b.textContent === label)
  return { root, json, media, video, dispose, load, speed: walk(root, 'select')[0],
    back: button('Et billede tilbage'), next: button('Et billede frem') }
}
test('speed handlers set half and quarter speed without changing marker media time', async () => {
  const x = await setup()
  for (const value of ['0.5', '0.25', '1']) {
    x.speed.value = value; await x.speed.fire('change'); assert.equal(x.video.playbackRate, Number(value))
    x.video.currentTime = 0.18; await x.video.fire('timeupdate')
    assert.equal(walk(x.root, 'polyline').length, 1)
  }
  x.speed.value = '7'; await x.speed.fire('change'); assert.equal(x.video.playbackRate, 1)
  x.dispose()
})
test('variable timestamp steps pause and cross both marker boundaries in both directions', async () => {
  const x = await setup()
  x.video.currentTime = 0.04; x.video.paused = false
  await x.next.fire('click'); assert.equal(x.video.currentTime, 0.1); assert.equal(x.video.paused, true)
  assert.equal(walk(x.root, 'polyline').length, 1)
  await x.next.fire('click'); assert.equal(x.video.currentTime, 0.18)
  await x.next.fire('click'); assert.equal(x.video.currentTime, 0.3)
  assert.equal(walk(x.root, 'polyline').length, 0)
  await x.back.fire('click'); assert.equal(x.video.currentTime, 0.18)
  assert.equal(walk(x.root, 'polyline').length, 1)
  await x.back.fire('click'); await x.back.fire('click')
  assert.equal(x.video.currentTime, 0.04); assert.equal(walk(x.root, 'polyline').length, 0)
  x.dispose()
})
test('unknown timestamps disable frame controls and explain limitation, speed still works', async () => {
  const data = packet(); delete data.clip.frameTimes
  const x = await setup(data)
  assert.equal(x.back.disabled, true); assert.equal(x.next.disabled, true)
  assert.match(x.root.textContent, /billedtidspunkter er ukendte/)
  x.speed.value = '0.25'; await x.speed.fire('change'); assert.equal(x.video.playbackRate, 0.25)
  x.dispose()
})
test('index validation rejects malformed timing and detaches mutable input', () => {
  for (const times of [[], [0, 0], [0, -1], [0, NaN], [0, Infinity], [0, '0.1'], [0.1], [0, 1], [0, 0.3, 0.2], {}]) {
    const data = packet(); data.clip.frameTimes = times
    assert.throws(() => parsePlaybackDocument(data, scope), TypeError)
  }
  const data = packet(), parsed = parsePlaybackDocument(data, scope)
  data.clip.frameTimes[1] = 0.9; assert.equal(parsed.clip.frameTimes[1], 0.04)
})
test('counterprobe: between frames, at duration and at zero never invent or wrap frames', () => {
  const times = packet().clip.frameTimes
  assert.equal(adjacentFrameTime(times, 0, -1), null)
  assert.equal(adjacentFrameTime(times, 0.15, -1), 0.04)
  assert.equal(adjacentFrameTime(times, 0.15, 1), 0.18)
  assert.equal(adjacentFrameTime(times, 1, -1), 0.3)
  assert.equal(adjacentFrameTime(times, 1, 1), null)
  assert.equal(adjacentFrameTime(times, NaN, 1), null)
  assert.equal(adjacentFrameTime(times, 0, 0), null)
})
test('counterprobe: replacement and errors reset rate and disable controls; cleanup removes handlers', async () => {
  const x = await setup()
  x.speed.value = '0.25'; await x.speed.fire('change')
  await x.video.fire('error'); assert.equal(x.video.playbackRate, 1)
  assert.equal(x.speed.disabled, true); assert.equal(x.next.disabled, true)
  await x.load({ ...packet(), athleteId: 'wrong' }); assert.equal(x.media.disabled, true)
  x.dispose()
  for (const node of [x.video, x.speed, x.back, x.next])
    assert.equal([...node.listeners.values()].reduce((n, set) => n + set.size, 0), 0)
})
test('counterprobe: seek failure clears overlays and does not leave usable frame controls', async () => {
  const x = await setup()
  x.video.currentTime = 0.1; await x.video.fire('seeked')
  Object.defineProperty(x.video, 'currentTime', { configurable: true, get: () => 0.1, set() { throw Error('seek failed') } })
  // Allow fake load() to reset after the deliberate seek failure.
  x.video.load = () => {}
  await x.next.fire('click')
  assert.equal(x.next.disabled, true); assert.equal(walk(x.root, 'polyline').length, 0)
  x.dispose()
})
