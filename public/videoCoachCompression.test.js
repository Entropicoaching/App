import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { compressVideoForUpload, videoCompressionDimensions } from './videoCoachCompression.js'

const original = () => new File([new Uint8Array(10_000)], 'loeft.mov', { type: 'video/quicktime' })
function rig(options = {}) {
  const stats = { revoked: [], stopped: [], options: null, stream: null, cancelled: [] }
  const timers = new Map(), frames = new Map()
  let nextId = 0
  const track = kind => ({ kind, stop() { stats.stopped.push(this) } })
  const sourceVideo = track('video'), audio = track('audio'), canvasVideo = track('video')
  class Stream {
    constructor(tracks) { this.tracks = tracks }
    getTracks() { return this.tracks }
    getVideoTracks() { return this.tracks.filter(t => t.kind === 'video') }
    getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio') }
  }
  class Recorder extends EventTarget {
    static isTypeSupported() { return !options.noCodec }
    constructor(stream, config) {
      super()
      if (options.constructorError) throw new Error('Codec')
      stats.stream = stream; stats.options = config; stats.recorder = this
      this.state = 'inactive'; this.mimeType = 'video/webm;codecs=vp8,opus'
    }
    start() { this.state = 'recording' }
    stop() {
      this.state = 'inactive'
      if (options.noStop) return
      queueMicrotask(() => {
        const event = new Event('dataavailable')
        event.data = new Blob([new Uint8Array(options.outputSize ?? 1000)])
        this.dispatchEvent(event)
        this.dispatchEvent(new Event('stop'))
      })
    }
  }
  const video = new EventTarget()
  Object.assign(video, {
    readyState: 0, videoWidth: options.width ?? 3840, videoHeight: options.height ?? 2160,
    duration: options.duration ?? 4, currentTime: 0,
    captureStream: () => new Stream(options.silent ? [sourceVideo] : [sourceVideo, audio]),
    load() {
      if (!this.src || options.noMetadata) return
      queueMicrotask(() => {
        this.readyState = 2
        this.dispatchEvent(new Event(options.decodeError ? 'error' : 'loadeddata'))
      })
    },
    play() {
      if (options.playError) return Promise.reject(new Error('Afspilning'))
      if (options.stall) return new Promise(() => {})
      queueMicrotask(() => {
        if (options.recorderError) { stats.recorder.dispatchEvent(new Event('error')); return }
        this.currentTime = 2
        for (const [id, callback] of [...frames]) { frames.delete(id); callback() }
        this.currentTime = 4
        this.dispatchEvent(new Event('ended'))
      })
      return Promise.resolve()
    },
    pause() {},
    removeAttribute() { this.src = '' },
  })
  if (options.noCapture) delete video.captureStream
  const canvas = {
    getContext: () => ({ drawImage() { if (options.drawError) throw new Error('Canvas') } }),
    captureStream: () => new Stream([canvasVideo]),
  }
  const document = new EventTarget()
  document.visibilityState = 'visible'
  document.createElement = tag => tag === 'video' ? video : canvas
  const environment = {
    document, MediaRecorder: Recorder, MediaStream: Stream, File,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => stats.revoked.push(url) },
    setTimeout(callback, ms) { const id = ++nextId; timers.set(id, { callback, ms }); return id },
    clearTimeout(id) { timers.delete(id) },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id },
    cancelAnimationFrame(id) { frames.delete(id); stats.cancelled.push(id) },
  }
  return { environment, stats, video, canvas, document, timers, frames,
    fire(ms) {
      for (const [id, timer] of [...timers]) if (timer.ms === ms) {
        timers.delete(id); timer.callback()
      }
    },
  }
}
const encode = (file, x, extra = {}) => compressVideoForUpload(file,
  { enabled: true, environment: x.environment, ...extra })
const tick = () => new Promise(resolve => queueMicrotask(resolve))

test('slukket flag rører ingen browserfunktioner', async () => {
  const file = original()
  assert.equal(await compressVideoForUpload(file, {
    environment: new Proxy({}, { get() { throw Error('Må ikke læses') } }),
  }), file)
})
test('1080p i begge retninger, lige dimensioner og ingen opskalering', () => {
  assert.deepEqual(videoCompressionDimensions(3840, 2160), { width: 1920, height: 1080 })
  assert.deepEqual(videoCompressionDimensions(2160, 3840), { width: 1080, height: 1920 })
  assert.deepEqual(videoCompressionDimensions(640, 481), { width: 640, height: 480 })
  assert.deepEqual(videoCompressionDimensions(4000, 4000), { width: 1080, height: 1080 })
  assert.throws(() => videoCompressionDimensions(0, 1080))
})
test('mindre fil bevarer lyd og får korrekt MIME type og endelse', async () => {
  const x = rig(), file = original(), progress = []
  const result = await encode(file, x, { onProgress: value => progress.push(value) })
  assert.equal(result.type, 'video/webm')
  assert.equal(result.name, 'loeft.webm')
  assert.equal(result.size, 1000)
  assert.equal(file.name, 'loeft.mov')
  assert.deepEqual(x.stats.stream.getTracks().map(t => t.kind), ['video', 'audio'])
  assert.equal(x.stats.options.videoBitsPerSecond, 4_000_000)
  assert.equal(x.stats.options.audioBitsPerSecond, 128_000)
  assert.deepEqual([x.canvas.width, x.canvas.height], [1920, 1080])
  assert.deepEqual(progress, [0, 50, 100])
  assert.deepEqual(x.stats.revoked, ['blob:test'])
  assert.equal(new Set(x.stats.stopped).size, 3)
  assert.equal(x.timers.size, 0)
  assert.equal(x.frames.size, 0)
})
test('lydløst klip kan komprimeres', async () => {
  const x = rig({ silent: true })
  assert.notEqual(await encode(original(), x), undefined)
  assert.equal(x.stats.stream.getAudioTracks().length, 0)
})
for (const options of [
  { noCapture: true }, { noCodec: true }, { constructorError: true },
  { decodeError: true }, { playError: true }, { recorderError: true },
  { outputSize: 0 }, { outputSize: 10_000 }, { outputSize: 20_000 },
  { drawError: true }, { duration: Infinity },
]) {
  test('originalfil ved ' + JSON.stringify(options), async () => {
    const file = original(), x = rig(options)
    assert.equal(await encode(file, x), file)
    assert.equal(x.timers.size, 0)
    assert.equal(x.frames.size, 0)
    if (!options.noCapture && !options.noCodec) assert.deepEqual(x.stats.revoked, ['blob:test'])
  })
}
test('metadata, fastlåst afspilning og stop har tidsgrænser', async () => {
  for (const options of [{ noMetadata: true }, { stall: true }, { noStop: true }]) {
    const x = rig(options), file = original(), pending = encode(file, x)
    await tick(); await tick()
    x.fire(options.noStop ? 5000 : 15_000)
    if (options.stall) for (let i = 0; i < 15; i++) x.fire(1000)
    assert.equal(await pending, file)
    assert.equal(x.timers.size, 0)
  }
})
test('annullering afviser, rydder op og kan skelnes fra tilbagefald', async () => {
  const x = rig({ stall: true }), controller = new AbortController()
  const pending = encode(original(), x, { signal: controller.signal })
  await tick()
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(x.timers.size, 0)
  assert.deepEqual(x.stats.revoked, ['blob:test'])
  assert.equal(new Set(x.stats.stopped).size, 3)
})
test('skjult fane bruger originalen og frigiver optagelsen', async () => {
  const x = rig({ stall: true }), file = original(), pending = encode(file, x)
  await tick()
  x.document.visibilityState = 'hidden'
  x.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(await pending, file)
  assert.equal(x.timers.size, 0)
})
test('en fejl i statusvisning stopper ikke komprimering', async () => {
  assert.equal((await encode(original(), rig(), { onProgress() { throw Error('Status') } })).size, 1000)
})

const html = readFileSync(new URL('./videocoach.html', import.meta.url), 'utf8')
const flagSource = html.match(/function vcReadVideoCompression\(\) \{[\s\S]*?\n\}/)[0]
test('flag følger eksisterende URL og lokal lagring med slukket standard', () => {
  const read = (search, value, denied = false) => {
    const writes = []
    const context = { MODE_PARAMS: new URLSearchParams(search), localStorage: {
      getItem() { if (denied) throw Error('Lagring'); return value },
      setItem(...args) { if (denied) throw Error('Lagring'); writes.push(args) },
    } }
    return { result: vm.runInNewContext(flagSource + '\nvcReadVideoCompression()', context), writes }
  }
  for (const value of [null, '', '0', 'true', true, 1]) assert.equal(read('', value).result, false)
  assert.equal(read('', '1').result, true)
  assert.equal(read('videoCompression=0', '1').result, false)
  assert.deepEqual(read('videoCompression=1', null).writes, [['vc_video_compression', '1']])
  assert.equal(read('videoCompression=1', null, true).result, true)
  assert.equal(read('', null, true).result, false)
})
function uploadRig(compress, upload = async () => {}) {
  const file = original(), sent = [], statuses = []
  const fields = { liftSel: { value: 'Squat' }, variationSel: { value: 'Competition' },
    loadInput: { value: '' }, athleteNoteInput: { value: '' }, athleteStatus: {} }
  const context = {
    VC_V3_ATHLETE_BRIDGE: true, VC_VIDEO_COMPRESSION: true,
    vcAthletePendingFile: file, vcAthleteClientAnalysisId: null, vcAthleteUploadRequestId: null,
    vcAthleteCompressionAbort: null, vcAthletePreparedUploads: new WeakMap(),
    saveBtn: {}, athleteUploadCancelBtn: {}, banner: { dataset: {} },
    document: { getElementById: id => fields[id] },
    window: { vcCompressVideoForUpload: compress }, AbortController,
    vcV3Lift: () => 'squat', vcV3Variation: () => 'competition', vcV3Uuid: () => 'syntetisk',
    parseLoad: () => ({ kg: null, rpe: null }), vcPlateCalibReason: null,
    setAthleteState: null, setAthleteSubmitOpen: null, say: text => statuses.push(text),
    setTimeout: () => 0, vcV3RequestAbortUpload() { throw Error('Ingen upload endnu') },
    async vcV3RequestUploadAndGo(request) { sent.push(request); await upload(request) },
  }
  vm.createContext(context)
  const start = html.indexOf('function vcAthleteUploadStatus(text)')
  const end = html.indexOf('// ---------- 🤖 AI-analyse', start)
  vm.runInContext(html.slice(start, end), context)
  return { context, file, sent, statuses }
}
test('genforsøg bruger samme forberedte fil, MIME type og klient-id', async () => {
  let count = 0, uploads = 0
  const prepared = new File(['mindre'], 'loeft.webm', { type: 'video/webm' })
  const x = uploadRig(async () => { count++; return prepared }, async () => {
    if (++uploads === 1) throw Error('Rækken blev ikke gemt')
  })
  await x.context.vcAthleteUploadAndGo()
  await x.context.vcAthleteUploadAndGo()
  assert.equal(count, 1)
  assert.equal(x.sent.length, 2)
  assert.equal(x.sent[0].file, prepared)
  assert.equal(x.sent[1].file, prepared)
  assert.equal(x.sent[0].mimeType, prepared.type)
  assert.equal(x.sent[0].clientAnalysisId, x.sent[1].clientAnalysisId)
  assert.equal(x.context.vcAthletePendingFile, x.file)
})
test('manglende modul og uventet komprimeringsfejl sender originalen', async () => {
  for (const compress of [undefined, async () => { throw Error('Browser') }]) {
    const x = uploadRig(compress)
    await x.context.vcAthleteUploadAndGo()
    assert.equal(x.sent[0].file, x.file)
    assert.ok(x.statuses.some(text => text.startsWith('Sender originalfil')))
  }
})
test('annullering under komprimering sender intet og samtidige kald ignoreres', async () => {
  let count = 0
  const x = uploadRig((_file, { signal }) => {
    count++
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      const error = new Error('Annulleret'); error.name = 'AbortError'; reject(error)
    }))
  })
  const first = x.context.vcAthleteUploadAndGo()
  await x.context.vcAthleteUploadAndGo()
  x.context.vcAthleteCancelUpload()
  await first
  assert.equal(count, 1)
  assert.equal(x.sent.length, 0)
  assert.equal(x.context.vcAthletePreparedUploads.has(x.file), false)
  assert.equal(x.context.vcAthleteUploadRequestId, null)
  assert.ok(x.statuses.includes('Annulleret · intet blev sendt'))
})
