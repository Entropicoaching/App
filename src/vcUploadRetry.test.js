import test from 'node:test'
import assert from 'node:assert/strict'
import { ui, dom, bridge } from './uploadRetryFakes.mjs'
import { readFileSync, existsSync } from 'node:fs'
import vm from 'node:vm'

test('OFF and inaccessible storage leave DOM and Send alone', () => {
  for (const storage of [() => ({ getItem: () => null }), () => ({ getItem: () => 'true' }), () => { throw Error('blocked') }]) {
    const f = dom()
    assert.equal(ui.mountUploadRetry(f.document, () => assert.fail('send'), storage), null)
    assert.equal(f.document.body.children.length, 0)
  }
})

test('DOM: explicit retry retains file, shows full-restart fallback, never auto sends', async () => {
  const f = dom()
  let calls = 0
  const file = new Blob(['synthetic'])
  let seen
  let status
  const send = () => status.run(async () => { calls++; seen = file; if (calls === 1) throw Error('offline'); return 'saved' })
  status = ui.mountUploadRetry(f.document, send, () => ({ getItem: () => '1' }))
  const panel = f.document.body.children[0]
  const [text, retry] = panel.children
  assert.equal(calls, 0)
  assert.equal(text.attrs.role, 'status')
  assert.equal(text.attrs['aria-live'], 'polite')
  await assert.rejects(send(), /offline/)
  assert.match(text.textContent, /Ikke sendt/)
  assert.equal(retry.hidden, false)
  assert.equal(calls, 1)
  await retry.onclick()
  assert.equal(calls, 2)
  assert.equal(seen, file)
  assert.match(text.textContent, /Sendt til Marc ✓ kl. /)
  assert.equal(retry.hidden, true)
  status.reset()
  assert.equal(panel.hidden, true)
})

test('actual athlete bridge replies after thrown network error; manual retry keeps path and Blob', async () => {
  let attempts = 0
  const f = await bridge({ upload: async () => { if (++attempts === 1) throw Error('offline'); return {} } })
  try {
    await f.send()
    assert.equal(f.replies[0].ok, false)
    assert.match(f.replies[0].error, /Prøv igen/)
    assert.equal(f.rows.length, 0)
    assert.equal(f.aborts.size, 0)
    assert.equal(attempts, 1)
    await f.send({ ...f.message, requestId: 'attempt2' })
    assert.equal(f.replies[1].ok, true)
    assert.equal(f.rows.length, 1)
    assert.equal(f.uploads[0].path, f.uploads[1].path)
    assert.equal(f.uploads[0].file, f.uploads[1].file)
    assert.equal(f.uploads[1].options.upsert, false)
    assert.equal(f.rows[0].athlete_id, '11111111-1111-4111-8111-111111111111')
    assert.equal(f.rows[0].analysis_state, 'awaiting_analysis')
    assert.equal(f.markers.filter(x => x[0] === 'clear').length, 2)
  } finally { f.restore() }
})

test('actual HTML Send handler, request bridge and DOM retry survive a synthetic network failure together', async () => {
  const html = existsSync(new URL('./videocoach-part0.bytes', import.meta.url))
    ? Buffer.concat([0, 1, 2].map(i => readFileSync(new URL(`./videocoach-part${i}.bytes`, import.meta.url)))).toString('utf8')
    : readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
  const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)))
  let attempts = 0
  const f = await bridge({ upload: async () => { if (++attempts === 1) throw Error('lost network'); return {} } })
  try {
    const d = dom()
    const inputs = { liftSel: { value: 'squat' }, variationSel: { value: 'competition' }, loadInput: { value: '' }, athleteNoteInput: { value: '' }, athleteStatus: {} }
    d.document.getElementById = id => inputs[id]
    const pending = new Map()
    let uuid = 0
    const state = { value: 'ready' }
    const context = vm.createContext({ document: d.document, Promise, Error,
      VC_V3_ATHLETE_BRIDGE: true, VC_V3_MESSAGE_PREFIX: 'test:vc',
      location: { origin: 'https://synthetic.invalid' },
      vcV3Uuid: () => ++uuid === 1 ? f.message.clientAnalysisId : `request${uuid}`,
      vcV3Lift: value => value, vcV3Variation: (_, value) => value,
      vcAthletePendingFile: f.message.file, vcAthleteClientAnalysisId: null,
      vcAthleteUploadRequestId: null, vcPlateCalibReason: null,
      saveBtn: {}, athleteUploadCancelBtn: {}, parseLoad: () => ({ kg: null, rpe: null }),
      setAthleteState: value => { state.value = value }, setAthleteSubmitOpen() {},
      say() {}, banner: { dataset: {} }, setTimeout: () => 1,
      vcV3UploadPending: pending,
      VC_V3_HOST: { postMessage(message) {
        void f.send(message).then(() => {
          const reply = f.replies.at(-1)
          const callback = pending.get(message.requestId)
          pending.delete(message.requestId)
          if (reply.ok) callback.resolve(reply.data)
          else callback.reject(Object.assign(Error(reply.error), { vcAborted: reply.aborted }))
        })
      } },
    })
    vm.runInContext(section('let vcUploadRetry = null;', '// ORDRE 61 · commit 2: Annullér-knappen'), context)
    vm.runInContext(section('function vcV3RequestUploadAndGo(options)', '// ORDRE 61 · commit 2: beder appen'), context)
    const controller = ui.mountUploadRetry(d.document, () => context.vcAthleteUploadAndGo(), () => ({ getItem: () => '1' }))
    context.retryController = controller
    vm.runInContext('vcUploadRetry = retryController', context)
    await context.vcAthleteUploadAndGo()
    const [text, retry] = d.document.body.children[0].children
    assert.equal(attempts, 1)
    assert.match(text.textContent, /Prøv igen/)
    assert.equal(state.value, 'ready')
    await retry.onclick()
    assert.equal(attempts, 2)
    assert.equal(state.value, 'sent')
    assert.equal(f.uploads[0].file, f.uploads[1].file)
    assert.equal(f.uploads[0].path, f.uploads[1].path)
    assert.equal(f.rows.length, 1)
    assert.match(text.textContent, /Sendt til Marc ✓ kl. /)
  } finally { f.restore() }
})

test('OFF bridge preserves original returned error and success behavior', async () => {
  const f = await bridge({ enabled: false, upload: async () => ({ error: { message: 'original error' } }) })
  try {
    await f.send()
    assert.equal(f.replies[0].error, 'Video kunne ikke uploades: original error')
    f.upload = async () => ({})
    await f.send()
    assert.equal(f.replies[1].ok, true)
  } finally { f.restore() }
})
