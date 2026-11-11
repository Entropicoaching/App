import test from 'node:test'
import assert from 'node:assert/strict'
import * as app from './videoUploadRetry.mjs'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ui, dom, bridge } from './uploadRetryFakes.mjs'

const store = value => () => ({ getItem: () => value })

test('U4 1: ét flag i appen; enhedens vc_upload_retry_v1 vinder over standardværdien', () => {
  assert.equal(typeof app.DEFAULT_VC_UPLOAD_RETRY, 'boolean')
  assert.equal(app.videoUploadRetryEnabled(store('1')), true)
  assert.equal(app.videoUploadRetryEnabled(store('0')), false)
  assert.equal(app.videoUploadRetryEnabled(store(null)), app.DEFAULT_VC_UPLOAD_RETRY)
  assert.equal(app.videoUploadRetryEnabled(() => { throw Error('blocked') }), app.DEFAULT_VC_UPLOAD_RETRY)
})

test('U4 1: appen bærer flaget til videosiden i adressen', () => {
  const url = 'videocoach.html?mode=athlete&bridge=athlete-v1&v=1'
  assert.equal(app.withUploadRetryFlag(url, true), url + '&uploadRetry=1')
  assert.equal(app.withUploadRetryFlag('videocoach.html', true), 'videocoach.html?uploadRetry=1')
  assert.equal(app.withUploadRetryFlag(url, false), url)
})

test('U4 1: videosiden læser adressen; enheden kan slukke eller tænde', () => {
  assert.equal(ui.uploadRetryEnabled(store(null), '?mode=athlete&uploadRetry=1'), true)
  assert.equal(ui.uploadRetryEnabled(() => { throw Error('blocked') }, '?uploadRetry=1'), true)
  assert.equal(ui.uploadRetryEnabled(store('0'), '?uploadRetry=1'), false)
  assert.equal(ui.uploadRetryEnabled(store('1'), '?mode=athlete'), true)
  assert.equal(ui.uploadRetryEnabled(store(null), '?mode=athlete'), false)
})

// Den rigtige Send-handling fra videosiden, kørt i vm med appens rigtige bro (uploadRetryFakes).
async function htmlSend({ upload = async () => ({}), file, storage = store('1'), search, enabled = true } = {}) {
  const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
  const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)))
  const f = await bridge({ upload, enabled })
  const d = dom()
  const inputs = { liftSel: { value: 'squat' }, variationSel: { value: 'competition' }, loadInput: { value: '' }, athleteNoteInput: { value: '' }, athleteStatus: {} }
  d.document.getElementById = id => inputs[id]
  const pending = new Map(), said = [], posted = []
  const saveBtn = { textContent: 'Send til coach', disabled: false }
  let uuid = 0
  const state = { value: 'ready' }
  const context = vm.createContext({ document: d.document, Promise, Error,
    VC_V3_ATHLETE_BRIDGE: true, VC_V3_MESSAGE_PREFIX: 'test:vc',
    location: { origin: 'https://synthetic.invalid' },
    vcV3Uuid: () => ++uuid === 1 ? f.message.clientAnalysisId : `request${uuid}`,
    vcV3Lift: value => value, vcV3Variation: (_, value) => value,
    vcAthletePendingFile: file || f.message.file, vcAthleteClientAnalysisId: null,
    vcAthleteUploadRequestId: null, vcPlateCalibReason: null,
    saveBtn, athleteUploadCancelBtn: {}, parseLoad: () => ({ kg: null, rpe: null }),
    setAthleteState: value => { state.value = value }, setAthleteSubmitOpen() {},
    say: text => said.push(text), banner: { dataset: {} }, setTimeout: () => 1,
    vcV3UploadPending: pending,
    VC_V3_HOST: { postMessage(message) {
      posted.push(message)
      void f.send({ ...message, file: message.file }).then(() => {
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
  context.retryController = ui.mountUploadRetry(d.document, () => context.vcAthleteUploadAndGo(), storage, search)
  vm.runInContext('vcUploadRetry = retryController', context)
  const panel = d.document.body.children[0]
  return { f, d, said, posted, saveBtn, state, panel, send: () => context.vcAthleteUploadAndGo() }
}

test('U4 2: en fil over 50 MB afvises i videosiden før overførslen, uden Prøv igen', async () => {
  const big = { size: 50 * 1024 * 1024 + 1, type: 'video/mp4' }
  const h = await htmlSend({ file: big, upload: async () => assert.fail('ingen overførsel') })
  try {
    await h.send()
    assert.equal(h.posted.length, 0)
    assert.equal(h.f.uploads.length, 0)
    assert.ok(!h.said.some(text => /Sender/.test(text)))
    assert.match(h.said.at(-1), /større end 50 MB/)
    assert.equal(h.saveBtn.disabled, false)
    const [text, retry] = h.panel.children
    assert.equal(h.panel.hidden, false)
    assert.match(text.textContent, /større end 50 MB/)
    assert.equal(retry.hidden, true)
  } finally { h.f.restore() }
})

test('U4 2: grænse og tekst er de samme som appens', async () => {
  const upload = await import('./videoCoachUpload.js')
  assert.equal(ui.VC_UPLOAD_MAX_BYTES, upload.VIDEOCOACH_UPLOAD_MAX_BYTES)
  assert.equal(ui.VC_UPLOAD_TOO_LARGE, upload.validateVideoUploadRequest({
    athleteId: '11111111-1111-4111-8111-111111111111', clientAnalysisId: '22222222-2222-4222-8222-222222222222',
    lift: 'squat', variation: 'competition', mimeType: 'video/mp4', fileSize: upload.VIDEOCOACH_UPLOAD_MAX_BYTES + 1 }))
})

test('U4 2: en fil under grænsen sendes stadig', async () => {
  const h = await htmlSend({ file: new Blob([new Uint8Array(1)], { type: 'video/mp4' }) })
  try {
    await h.send()
    assert.equal(h.posted.length, 1)
    assert.equal(h.f.rows.length, 1)
  } finally { h.f.restore() }
})

test('U4 3: afbrudt forbindelse giver "Ikke sendt" og én Prøv igen; nyt forsøg sender', async () => {
  let attempts = 0
  const h = await htmlSend({ upload: async () => { if (++attempts === 1) throw TypeError('Failed to fetch'); return {} } })
  try {
    await h.send()
    const [text, retry] = h.panel.children
    assert.match(text.textContent, /^Ikke sendt · Prøv igen\. Videoen er stadig valgt/)
    assert.doesNotMatch(text.textContent, /uploadklienten|delvis fil/)
    assert.equal(retry.hidden, false)
    assert.equal(retry.textContent, 'Prøv igen')
    assert.equal(h.saveBtn.hidden, true)
    assert.match(h.said.at(-1), /^Ikke sendt · Prøv igen\. /)
    assert.equal(h.state.value, 'ready')
    await retry.onclick()
    assert.equal(attempts, 2)
    assert.equal(h.state.value, 'sent')
    assert.equal(h.saveBtn.hidden, false)
    assert.equal(h.f.rows.length, 1)
    assert.equal(retry.hidden, true)
  } finally { h.f.restore() }
})

test('U4 4: flaget er tændt; iframens adresse tænder panelet uden enhedsindstilling', async () => {
  assert.equal(app.DEFAULT_VC_UPLOAD_RETRY, true)
  assert.equal(app.videoUploadRetryEnabled(store(null)), true)
  const { ATHLETE_VIDEOCOACH_URL } = await import('./athlete/videoCoachBro.js')
  const search = '?' + ATHLETE_VIDEOCOACH_URL.split('?')[1]
  assert.equal(new URLSearchParams(search).get('uploadRetry'), '1')
  assert.equal(ui.uploadRetryEnabled(store(null), search), true)
})

test('U4 4: afbrudt fetch efter at filen nåede frem; Prøv igen giver én video og én række', async () => {
  // Syntetisk lager: filen gemmes, men svaret går tabt (afbrudt fetch). Næste forsøg på samme sti
  // får "already exists" som det rigtige lager med upsert:false, og rækken gemmes én gang.
  const objects = new Map(), saved = new Map()
  let attempts = 0
  const { ATHLETE_VIDEOCOACH_URL } = await import('./athlete/videoCoachBro.js')
  const h = await htmlSend({ enabled: null, storage: store(null), search: '?' + ATHLETE_VIDEOCOACH_URL.split('?')[1],
    upload: async (signal, path, file) => {
      attempts++
      if (objects.has(path)) return { data: null, error: { statusCode: '409', message: 'The resource already exists' } }
      objects.set(path, file)
      if (attempts === 1) throw TypeError('Failed to fetch')
      return { data: { path } }
    } })
  h.f.save = async row => {
    const duplicate = saved.has(row.client_analysis_id)
    if (!duplicate) saved.set(row.client_analysis_id, row)
    return { data: { id: 'synthetic-row', client_analysis_id: row.client_analysis_id }, duplicate }
  }
  try {
    await h.send()
    const [text, retry] = h.panel.children
    assert.match(text.textContent, /^Ikke sendt/)
    assert.equal(retry.hidden, false)
    assert.equal(h.f.replies[0].ok, false)
    assert.match(h.f.replies[0].error, /Forbindelsen blev afbrudt/)
    assert.equal(saved.size, 0)
    await retry.onclick()
    assert.equal(attempts, 2)
    assert.equal(h.f.uploads[0].path, h.f.uploads[1].path)
    assert.equal(h.f.uploads[1].options.upsert, false)
    assert.equal(objects.size, 1)
    assert.equal(saved.size, 1)
    assert.equal(h.state.value, 'sent')
    assert.match(text.textContent, /Sendt til Marc ✓ kl. /)
    // Et tredje tryk er ikke muligt: knappen er skjult, og Send giver samme klient-id.
    assert.equal(retry.hidden, true)
    await h.send()
    assert.equal(objects.size, 1)
    assert.equal(saved.size, 1)
  } finally { h.f.restore() }
})
