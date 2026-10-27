import test from 'node:test'
import assert from 'node:assert/strict'
import { ui, dom, bridge } from './uploadRetryFakes.mjs'

test('counterexample: concurrent UI Send shares one operation; abort never offers retry', async () => {
  const f = dom()
  const status = ui.mountUploadRetry(f.document, () => assert.fail('automatic retry'), () => ({ getItem: () => '1' }))
  let reject
  let calls = 0
  const send = () => { calls++; return new Promise((_, no) => { reject = no }) }
  const first = status.run(send)
  assert.equal(status.run(send), first)
  await Promise.resolve()
  assert.equal(calls, 1)
  reject(Object.assign(Error('cancel'), { vcAborted: true }))
  await assert.rejects(first, /cancel/)
  const [text, retry] = f.document.body.children[0].children
  assert.match(text.textContent, /Annulleret/)
  assert.equal(retry.hidden, true)
  retry.onclick()
})

test('counterexample: upload complete but row failed; duplicate path lets explicit retry save row', async () => {
  let uploads = 0
  let saves = 0
  const f = await bridge({ upload: async () => ++uploads === 1 ? {} : { error: { statusCode: '409' } },
    save: async () => ++saves === 1 ? { error: { message: 'synthetic row failure' } } : { data: { id: 'saved' } } })
  try {
    await f.send()
    assert.equal(f.replies[0].ok, false)
    await f.send({ ...f.message, requestId: 'retry' })
    assert.equal(f.replies[1].ok, true)
    assert.equal(f.rows[0].client_analysis_id, f.rows[1].client_analysis_id)
    assert.equal(f.uploads[0].path, f.uploads[1].path)
  } finally { f.restore() }
})

test('counterexample: abort after transport success creates no analysis row', async () => {
  let release
  const f = await bridge({ upload: () => new Promise(resolve => { release = resolve }) })
  try {
    const pending = f.send()
    await f.send({ type: 'test:vc:abort-upload', requestId: f.message.requestId })
    release({})
    await pending
    assert.equal(f.replies[0].aborted, true)
    assert.equal(f.rows.length, 0)
    assert.equal(f.aborts.size, 0)
  } finally { f.restore() }
})

test('counterexample: wrong origin, unregistered source, invalid payload cannot upload', async () => {
  const f = await bridge()
  try {
    await f.send(f.message, 'https://other.invalid')
    await f.send(f.message, 'https://synthetic.invalid', { postMessage() {} })
    await f.send({ ...f.message, variation: '../invalid' })
    assert.equal(f.uploads.length, 0)
    assert.equal(f.rows.length, 0)
  } finally { f.restore() }
})
