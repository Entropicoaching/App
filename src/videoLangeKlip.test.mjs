import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as upload from './videoCoachUpload.js'
import { ui, dom } from './uploadRetryFakes.mjs'

// Ordre 1616v. Punkt 2: med videolageret (R2) kan et klip på 3 minutter sendes (grænsen var 50 MB).
// Punkt 3: når haleklipningen fjerner billeder, ser atleten én kort linje under analysen.
// Kun opdigtede data.
const MB = 1024 * 1024
const request = (fileSize, extra = {}) => ({
  athleteId: '00000000-0000-4000-8000-000000000001', clientAnalysisId: '00000000-0000-4000-8000-000000000002',
  lift: 'squat', variation: 'competition_squat', mimeType: 'video/mp4', fileSize, loadKg: 100, rpe: 8, ...extra,
})
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('lange klip: 180 s i appens format (90 til 115 MB) godkendes, når videolageret er slået til', () => {
  const max = upload.videoUploadMaxBytes(true)
  assert.equal(max, 200 * MB)
  // klargjort klip 4 Mbit/s og appens egen optagelse 5 Mbit/s i 180 s
  for (const bytes of [4e6 / 8 * 180, 5e6 / 8 * 180, 200 * MB])
    assert.equal(upload.validateVideoUploadRequest(request(bytes, { maxBytes: max })), null)
  assert.match(upload.validateVideoUploadRequest(request(200 * MB + 1, { maxBytes: max })), /større end 200 MB/)
})

test('lange klip: uden videolageret gælder Supabases 50 MB som før', () => {
  assert.equal(upload.videoUploadMaxBytes(false), 50 * MB)
  assert.equal(upload.videoUploadMaxBytes(undefined), 50 * MB)
  assert.match(upload.validateVideoUploadRequest(request(90 * MB)), /større end 50 MB/)
  assert.match(upload.validateVideoUploadRequest(request(90 * MB, { maxBytes: upload.videoUploadMaxBytes(false) })), /større end 50 MB/)
})

test('lange klip: reserven til Supabase bruges kun for klip, Supabase kan tage imod', () => {
  assert.equal(upload.videoUploadReserveMulig(50 * MB), true)
  assert.equal(upload.videoUploadReserveMulig(50 * MB + 1), false)
  const hook = read('./athlete/useVideoCoachBro.js')
  assert.match(hook, /maxBytes: videoUploadMaxBytes\(Boolean\(import\.meta\.env\?\.VITE_VIDEOLAGER_URL\)\)/)
  const start = hook.indexOf('const lagerSvar = lager'), slut = hook.indexOf('} catch (error) {', start)
  assert.ok(start > 0 && slut > start)
  assert.match(hook.slice(start, slut), /\? lagerSvar\n\s+: !videoUploadReserveMulig\(file\.size\) \? \(lagerSvar \|\| \{ data: null, error: \{ message: 'Videolageret svarede ikke\. Prøv igen' \} \}\)\n\s+: videoUploadRetryEnabled\(\)/)
})

test('lange klip: videosiden afviser først over 200 MB, når appen bærer lager=1', () => {
  assert.equal(ui.VC_LAGER_MAX_BYTES, upload.VIDEOCOACH_LAGER_MAX_BYTES)
  assert.equal(ui.uploadMaxBytes('?mode=athlete&lager=1'), 200 * MB)
  assert.equal(ui.uploadMaxBytes('?mode=athlete'), 50 * MB)
  const on = () => ({ getItem: () => '1' })
  const lager = ui.mountUploadRetry(dom().document, () => {}, on, '?lager=1')
  assert.equal(lager.refuseTooLarge({ size: 115 * MB }), false)
  assert.equal(lager.refuseTooLarge({ size: 200 * MB + 1 }), true)
  assert.equal(lager.tooLargeText, upload.videoUploadTooLargeText(upload.VIDEOCOACH_LAGER_MAX_BYTES))
  const uden = ui.mountUploadRetry(dom().document, () => {}, on, '')
  assert.equal(uden.refuseTooLarge({ size: 50 * MB + 1 }), true)
  assert.equal(uden.tooLargeText, ui.VC_UPLOAD_TOO_LARGE)
  assert.match(read('./athlete/videoCoachBro.js'), /bridge=athlete-v1\$\{import\.meta\.env\?\.VITE_VIDEOLAGER_URL \? '&lager=1' : ''\}/)
})

// Punkt 3
const html = read('../public/videocoach.html')
const TEKST = 'Slutningen af videoen er skåret fra, fordi stangen ikke kunne følges.'

function note() {
  const start = html.indexOf('function syncTailCutNote(path) {'), end = html.indexOf('\n}\n', start)
  assert.ok(start > 0 && end > start, 'syncTailCutNote findes i videocoach.html')
  const el = { hidden: true }
  const sync = new Function('document', `${html.slice(start, end + 2)}\nreturn syncTailCutNote`)({ getElementById: id => id === 'vcTailCutNote' ? el : null })
  return { el, sync }
}

function klippetBane(hale) {
  const start = html.indexOf('  const trimEscapedTail=()=>{'), end = html.indexOf('  trimEscapedTail();', start)
  const klip = new Function('path', 'radius', `${html.slice(start, end)}\n  trimEscapedTail();\n  return path`)
  const smooth = x => x * x * (3 - 2 * x), pts = []
  for (let i = 0; i < 15; i++) pts.push({ x: 300, y: 500 })
  for (let r = 0; r < 3; r++) {
    for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: 500 + 500 * smooth(i / 30) })
    for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: 1000 - 500 * smooth(i / 30) })
    for (let i = 0; i < 20; i++) pts.push({ x: 300 + (i % 2), y: 500 })
  }
  if (hale) for (let i = 1; i <= 60; i++) pts.push({ x: 300, y: 500 + 30 * i })
  return klip({ pts, times: pts.map((_, i) => i / 30), valid: pts.map(() => true), confidence: pts.map(() => 1), analysis: { reps: [{}] } }, 100)
}

test('halen: linjen vises, når haleklipningen har fjernet billeder, og kun da', () => {
  const { el, sync } = note()
  const klippet = klippetBane(true)
  assert.ok(klippet.tailCutFrames > 0)
  sync(klippet)
  assert.equal(el.hidden, false)
  sync(klippetBane(false))
  assert.equal(el.hidden, true)
  sync(klippet); sync(null)
  assert.equal(el.hidden, true)
  // en bane uden analyse (analysen fejlede) viser ingen linje
  sync({ ...klippet, analysis: null })
  assert.equal(el.hidden, true)
})

test('halen: én linje i analysen, læselig, ingen knap og ingen gentagelse', () => {
  assert.equal(html.split(TEKST).length - 1, 1)
  const hud = html.slice(html.indexOf('<section id="barPathHUD"'), html.indexOf('<section id="exportPreview"'))
  assert.match(hud, new RegExp(`<div id="vcMetricCards" class="vcMetricCards"></div>\\n  <p id="vcTailCutNote" class="vcTailCutNote" role="status" hidden>${TEKST}</p>`))
  const size = Number((html.match(/\.vcTailCutNote \{[^}]*font-size:(\d+)px/) || [])[1])
  assert.ok(size >= 11, `skriftstørrelse ${size}`)
  const fn = html.slice(html.indexOf('function updateCleanReviewUI('), html.indexOf('if (!path?.analysis) {', html.indexOf('function updateCleanReviewUI(')))
  assert.match(fn, /syncTailCutNote\(path\);/)
  // i instant-flowet ("Film sættet") ligger resultatpanelet over stangbane-kortet: samme element flyttes derind
  assert.match(html, /const athleteTailNote = VC_ATHLETE_INSTANT \? document\.getElementById\('vcTailCutNote'\) : null;\n  athleteInstantResult\.append\(athleteInstantHead, athleteInstantRows, \.\.\.\(athleteTailNote \? \[athleteTailNote\] : \[\]\), athleteInstantFoot, athleteInstantActions\);/)
  const instant = html.slice(html.indexOf('showInstantResult = path => {'), html.indexOf('athleteInstantResult.hidden = false;', html.indexOf('showInstantResult = path => {')))
  assert.match(instant, /syncTailCutNote\(path\);/)
})

test('lange klip: coachen læser et klargjort klip på 3 minutter fra lageret direkte', () => {
  const max = Number(new Function(`return ${(html.match(/const VC_NORM_REMOTE_MAX = ([^;]+);/) || [])[1]}`)())
  assert.ok(max >= upload.VIDEOCOACH_LAGER_MAX_BYTES, `fjernklip læses op til ${max} byte`)
  // kun en lokal fil (der ellers ikke ligger i hukommelsen) har loftet på 80 MB
  assert.match(html, /\(turned \? ix\.w : ix\.h\) !== vh \|\| \(file && blob\.size > VC_NORM_SAME_MAX\)\) return \{ error: 'not-same' \};/)
})
