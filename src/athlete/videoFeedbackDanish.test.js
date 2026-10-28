import test from 'node:test'
import assert from 'node:assert/strict'
import { mountFeedbackPlayback } from './videoFeedbackPlayback.mjs'
import { document, walk } from './epikDom.mjs'
const scope = { athleteId: 'a', analysisId: 'b' }
const packet = () => ({ schema: 'vc-epik2-playback/v1', status: 'ready', ...scope,
  clip: { name: 'fake.webm', type: 'video/webm', size: 1, sha256: 'a'.repeat(64), duration: 1, width: 1, height: 1, frameTimes: [0, 0.5] },
  markers: [{ id: 'm', start: 0.5, end: 1, text: 'Syntetisk', strokes: [] }] })
function setup() {
  const root = document.createElement('section')
  const dispose = mountFeedbackPlayback(root, scope, { digest: async () => 'a'.repeat(64),
    urlApi: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} } })
  const [json, media] = walk(root, 'input'), video = walk(root, 'video')[0]
  const status = walk(root, 'p').find(n => n.attrs.role === 'status')
  const load = async () => { json.files = [{ size: 100, text: async () => JSON.stringify(packet()) }]; await json.fire('change') }
  const select = async () => { media.files = [{ name: 'fake.webm', type: 'video/webm', size: 1 }]; await media.fire('change') }
  const ready = async () => { await load(); await select(); Object.assign(video, { duration: 1, videoWidth: 1, videoHeight: 1 }); await video.fire('loadedmetadata') }
  return { root, json, media, video, status, load, select, ready, dispose }
}
test('K1: Danish DOM help, navigation and initial/cancelled status use exact Unicode', async () => {
  const x = setup()
  assert.equal(x.status.textContent, 'V\u00e6lg markeringsfilen f\u00f8rst.')
  assert.equal(walk(x.root, 'p')[0].textContent, 'Lokal visning: v\u00e6lg coachens markeringsfil og det tilh\u00f8rende videoklip. Filerne uploades ikke.')
  assert.ok(walk(x.root, 'button').some(n => n.textContent === 'N\u00e6ste markering'))
  assert.ok(x.root.textContent.includes('Billedtrin er ikke tilg\u00e6ngelige: klippets billedtidspunkter er ukendte. Du kan stadig v\u00e6lge halv eller kvart fart.'))
  x.json.files = []; await x.json.fire('change')
  assert.equal(x.status.textContent, 'V\u00e6lg markeringsfilen f\u00f8rst.')
  x.dispose()
})
test('K1: selected, checking, ready and error statuses preserve Danish', async () => {
  const x = setup()
  await x.load(); assert.equal(x.status.textContent, 'V\u00e6lg det tilh\u00f8rende videoklip.')
  await x.select(); assert.equal(x.status.textContent, 'Kontrollerer videoklippet\u2026')
  Object.assign(x.video, { duration: 1, videoWidth: 1, videoHeight: 1 }); await x.video.fire('loadedmetadata')
  assert.equal(x.status.textContent, 'Klar. Afspil videoen eller v\u00e6lg en markering.')
  await x.video.fire('error'); assert.equal(x.status.textContent, 'Videoen kunne ikke afspilles. V\u00e6lg klippet igen.')
  x.media.files = []; await x.media.fire('change'); assert.equal(x.status.textContent, 'V\u00e6lg det tilh\u00f8rende videoklip.')
  x.media.files = [{ name: 'wrong.webm' }]; await x.media.fire('change')
  assert.equal(x.status.textContent, 'Videoklippet passer ikke til markeringerne. V\u00e6lg det oprindelige klip.')
  x.dispose()
})
test('K1: speed rejection and both seek handlers retain exact Danish error text', async () => {
  const x = setup(); await x.ready()
  Object.defineProperty(x.video, 'playbackRate', { configurable: true, get: () => 1, set() { throw Error('fake unsupported rate') } })
  const speed = walk(x.root, 'select')[0]; speed.value = '0.5'; await speed.fire('change')
  assert.equal(x.status.textContent, 'Denne afspiller kunne ikke \u00e6ndre farten.')
  Object.defineProperty(x.video, 'playbackRate', { configurable: true, writable: true, value: 1 })
  for (const label of ['Et billede frem', 'N\u00e6ste markering']) {
    await x.ready()
    Object.defineProperty(x.video, 'currentTime', { configurable: true, get: () => 0, set() { throw Error('fake failed seek') } })
    x.video.load = () => {}
    await walk(x.root, 'button').find(n => n.textContent === label).fire('click')
    assert.equal(x.status.textContent, 'Videoen kunne ikke spoles. V\u00e6lg klippet igen.')
    Object.defineProperty(x.video, 'currentTime', { configurable: true, writable: true, value: 0 })
  }
  x.dispose()
})
