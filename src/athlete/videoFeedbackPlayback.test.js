import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mountFeedbackPlayback, parsePlaybackDocument, activeMarkers, adjacentMarker,
  videoFeedbackPlaybackEnabled, sha256File, DEFAULT_VIDEO_FEEDBACK_PLAYBACK } from './videoFeedbackPlayback.mjs'
import { document, walk } from './epikDom.mjs'
const bytes = new TextEncoder().encode('synthetic media fixture, not a video')
const hash = createHash('sha256').update(bytes).digest('hex')
const scope = { athleteId: 'athlete-1', analysisId: 'analysis-1' }
const fixture = () => ({ schema: 'vc-epik2-playback/v1', status: 'ready', ...scope,
  clip: { name: 'fixture.webm', type: 'video/webm', size: bytes.length, sha256: hash, duration: 10, width: 640, height: 360 },
  markers: [
    { id: 'later', start: 6, end: 8, text: 'Se knÃƒÂ¦et', strokes: [] },
    { id: 'first', start: 1, end: 4, text: '<img src=x onerror=alert(1)>', strokes: [{ color: '#ffcc00', points: [[0,0], [1,1]] }] },
    { id: 'overlap', start: 2, end: 3, text: 'Hold fokus', strokes: [] },
  ] })
const clip = () => ({ name: 'fixture.webm', type: 'video/webm', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer })
async function setup() {
  const root = document.createElement('section'), revoked = [], created = []
  const dispose = mountFeedbackPlayback(root, scope, { urlApi: { createObjectURL: file => { created.push(file); return 'blob:synthetic-' + created.length }, revokeObjectURL: url => revoked.push(url) } })
  const [json, file] = walk(root, 'input'), video = walk(root, 'video')[0]
  const loadDocument = async value => { const text = JSON.stringify(value); json.files = [{ size: text.length, text: async () => text }]; await json.fire('change') }
  const loadVideo = async (value = clip()) => { file.files = [value]; await file.fire('change') }
  const metadata = async (duration = 10, width = 640, height = 360) => { Object.assign(video, { duration, videoWidth: width, videoHeight: height }); await video.fire('loadedmetadata') }
  const buttons = () => walk(root, 'button')
  return { root, json, file, video, dispose, revoked, created, loadDocument, loadVideo, metadata, buttons }
}
test('flag defaults OFF, exact opt-in only, unavailable storage fails closed', () => {
  assert.equal(DEFAULT_VIDEO_FEEDBACK_PLAYBACK, false)
  for (const value of [null, 'true', true, 1, '0']) assert.equal(videoFeedbackPlaybackEnabled({ getItem: () => value }), false)
  assert.equal(videoFeedbackPlaybackEnabled({ getItem: key => key === 'vc-epik2-playback' ? '1' : null }), true)
  assert.equal(videoFeedbackPlaybackEnabled({ getItem() { throw Error() } }), false)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked') } })
  assert.equal(videoFeedbackPlaybackEnabled(), false)
  delete globalThis.localStorage
})
test('contract sorts detached markers, half-open intervals and backwards navigation', () => {
  const f = fixture(), parsed = parsePlaybackDocument(f, scope)
  assert.deepEqual(parsed.markers.map(m => m.id), ['first', 'overlap', 'later'])
  f.markers[1].strokes[0].points[0][0] = 0.5
  assert.equal(parsed.markers[0].strokes[0].points[0][0], 0)
  assert.equal(activeMarkers(parsed.markers, 0).length, 0)
  assert.deepEqual(activeMarkers(parsed.markers, 2).map(m => m.id), ['first', 'overlap'])
  assert.deepEqual(activeMarkers(parsed.markers, 3).map(m => m.id), ['first'])
  assert.equal(activeMarkers(parsed.markers, 4).length, 0)
  assert.equal(activeMarkers(parsed.markers, NaN).length, 0)
  assert.equal(adjacentMarker(parsed.markers, 1, -1), null)
  assert.equal(adjacentMarker(parsed.markers, 6, -1).id, 'overlap')
  assert.equal(adjacentMarker(parsed.markers, 6, 1), null)
})
test('reject wrong scope, unready/versioned data and malformed coordinates/times', () => {
  for (const change of [f => f.athleteId = 'other', f => f.analysisId = 'other', f => f.status = 'draft',
    f => f.schema = 'unknown', f => f.clip.sha256 = 'x', f => f.clip.duration = Infinity,
    f => f.markers[0].start = '6', f => f.markers[0].end = 11,
    f => f.markers[0].end = 6, f => f.markers[1].strokes[0].points[0][0] = -1,
    f => f.markers[1].strokes[0].color = 'url(https://invalid)', f => f.markers.push(f.markers[0]),
    f => f.markers = [], f => f.clip.width = 0]) {
    const f = fixture(); change(f); assert.throws(() => parsePlaybackDocument(f, scope), TypeError)
  }
})
test('actual DOM handlers import JSON + hashed local clip, synchronize comments/lines, seek both ways', async () => {
  const x = await setup()
  assert.equal(x.file.disabled, true)
  await x.loadDocument(fixture()); assert.equal(x.file.disabled, false)
  await x.loadVideo(); assert.equal(x.created.length, 1)
  assert.equal(x.buttons()[2].disabled, true)
  await x.metadata()
  assert.equal(x.video.parentNode.style.aspectRatio, '640 / 360')
  await x.buttons()[1].fire('click'); assert.equal(x.video.currentTime, 1)
  assert.equal(walk(x.root, 'polyline').length, 1)
  assert.equal(walk(x.root, 'polyline')[0].attrs.points, '0,0 1,1')
  assert.equal(walk(x.root, 'img').length, 0)
  x.video.currentTime = 2.5; await x.video.fire('timeupdate')
  assert.equal(x.buttons().filter(b => b.attrs['aria-pressed'] === 'true').length, 2)
  await x.buttons()[0].fire('click'); assert.equal(x.video.currentTime, 2)
  await x.buttons()[4].fire('click'); assert.equal(x.video.currentTime, 6)
  assert.equal(walk(x.root, 'polyline').length, 0)
  x.video.currentTime = 9; await x.video.fire('seeking')
  assert.equal(x.buttons()[1].disabled, true)
  x.video.currentTime = 1; await x.video.fire('seeked')
  assert.equal(walk(x.root, 'polyline').length, 1)
  x.video.currentTime = 10; await x.video.fire('ended')
  assert.equal(walk(x.root, 'polyline').length, 0)
  x.dispose(); assert.deepEqual(x.revoked, ['blob:synthetic-1']); assert.equal(x.root.children.length, 0)
  assert.equal([...x.video.listeners.values()].reduce((n, v) => n + v.size, 0), 0)
})
test('different bytes with identical metadata never open; duration/dimensions mismatch and media errors clear overlays', async () => {
  const x = await setup(); await x.loadDocument(fixture())
  await x.loadVideo({ ...clip(), arrayBuffer: async () => new Uint8Array(bytes.length).buffer })
  assert.equal(x.created.length, 0)
  await x.loadVideo(); await x.metadata(9)
  assert.equal(x.video.src, ''); assert.equal(x.revoked.length, 1)
  await x.loadVideo(); await x.metadata(10, 360, 640)
  assert.equal(x.video.src, '')
  await x.loadVideo(); await x.metadata(); x.video.currentTime = 1; await x.video.fire('timeupdate')
  await x.video.fire('error'); assert.equal(walk(x.root, 'polyline').length, 0); assert.equal(x.buttons()[2].disabled, true)
  x.dispose()
})
test('replacing document clears clip and scope rejection leaves no old annotations', async () => {
  const x = await setup(); await x.loadDocument(fixture()); await x.loadVideo(); await x.metadata()
  x.video.currentTime = 1; await x.video.fire('timeupdate')
  await x.loadDocument({ ...fixture(), athleteId: 'wrong' })
  assert.equal(x.video.src, ''); assert.equal(x.file.disabled, true)
  assert.equal(walk(x.root, 'polyline').length, 0); assert.equal(x.buttons().length, 4)
  assert.equal(x.revoked.length, 1); x.dispose()
})
test('late file reads and digests after replacement/unmount cannot create stale URLs or controls', async () => {
  const x = await setup(); let finish
  x.json.files = [{ size: 100, text: () => new Promise(resolve => { finish = resolve }) }]
  const pending = x.json.fire('change')
  await x.loadDocument(fixture()); finish(JSON.stringify({ ...fixture(), athleteId: 'old' })); await pending
  assert.equal(x.file.disabled, false)
  let finishBytes
  const pendingVideo = x.loadVideo({ ...clip(), arrayBuffer: () => new Promise(resolve => { finishBytes = resolve }) })
  x.dispose(); finishBytes(bytes.slice().buffer); await pendingVideo
  assert.equal(x.created.length, 0); assert.equal(x.root.children.length, 0)
})
test('real SHA-256 function validates synthetic bytes', async () => assert.equal(await sha256File(clip()), hash))
