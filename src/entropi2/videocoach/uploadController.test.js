import test from 'node:test'
import assert from 'node:assert/strict'
import { createUploadController } from './uploadController.mjs'

const clock = { set: () => 0, clear: () => {} }
function ready(callbacks) {
  const c = createUploadController({ enabled: true, options: [{ key: 'squat', label: 'Squat' }], callbacks,
    uuid: () => 'op-1', getScope: () => 'local', clock })
  assert.equal(c.choose('squat'), true); assert.equal(c.next(), true)
  assert.equal(c.select({ id: 'v1', label: 'Syntetisk video', duration: 10 }), true); assert.equal(c.next(), true)
  return c
}
test('UDGIVELSE1 fund 4: prepare and upload are called as methods and keep the adapter receiver', async () => {
  const adapter = {
    artifact: 'syntetisk-artefakt', seen: [],
    prepare(request) { this.seen.push('prepare'); return { artifact: this.artifact, duration: request.window.end - request.window.start } },
    upload(request) { this.seen.push('upload:' + request.artifact); return { ok: true, uploaded: true, clientAnalysisId: request.clientAnalysisId } },
  }
  const c = ready(adapter)
  assert.equal(await c.send(), true)
  assert.equal(c.snapshot().phase, 'sent')
  assert.deepEqual(adapter.seen, ['prepare', 'upload:syntetisk-artefakt'])
})
test('UDGIVELSE1 fund 4: plain function callbacks still work and a failing upload stays an error', async () => {
  const c = ready({ prepare: request => ({ artifact: 'a', duration: request.window.end - request.window.start }),
    upload: () => { throw Error('Netfejl') } })
  assert.equal(await c.send(), false)
  assert.equal(c.snapshot().phase, 'error')
  assert.equal(c.snapshot().error, 'Netfejl')
})
