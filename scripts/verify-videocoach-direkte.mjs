// ORDRE 1537v0 · videocoachen læser billederne direkte: klargøring uden afspilning (mp4 læses og afkodes med
// WebCodecs), sporing uden afspilning, det klargjorte klip er det der sendes, og et klip der siger for lidt
// får én sætning om hvorfor. Kører den ÆGTE public/videocoach.html i headless Edge/Chrome (H.264 kræves)
// på syntetiske klip, der ligner dem atleterne sender: Instagram-download (720p, hård komprimering, B-frames,
// lyd, overlay), telefonklip der ligger på siden med drejning i filen, stort 1080p-klip og et klip uden bevægelse.
// Kørsel: node scripts/verify-videocoach-direkte.mjs
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'

const root = resolve(import.meta.dirname, '..')
const playwrightDir = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')
if (!existsSync(playwrightDir)) { console.log('SPRUNGET OVER: playwright findes ikke'); process.exit(0) }
const { chromium, devices } = createRequire(import.meta.url)(playwrightDir)
const base = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.mp4')
const gt = JSON.parse(readFileSync(join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.ground-truth.json'), 'utf8'))
const work = join(tmpdir(), 'vc-direkte'); mkdirSync(work, { recursive: true })
const ff = args => { const r = spawnSync(ffmpegPath, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'inherit'] }); if (r.status !== 0) throw new Error('ffmpeg fejlede') }
const x264 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
const overlay = 'drawbox=x=0:y=ih*0.86:w=iw:h=ih*0.08:color=black@0.55:t=fill,drawbox=x=iw*0.04:y=ih*0.03:w=iw*0.22:h=ih*0.035:color=white@0.8:t=fill'
const CLIPS = {
  'ig-720.mp4': p => ff(['-i', base, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-vf', overlay, ...x264, '-profile:v', 'high', '-preset', 'medium', '-bf', '2', '-crf', '33', '-c:a', 'aac', '-b:a', '64k', '-shortest', p]),
  'drejet-1080.mp4': p => {
    ff(['-i', base, '-vf', 'scale=1080:1920,transpose=2', ...x264, '-preset', 'veryfast', '-crf', '24', '-an', join(work, 'side.tmp.mp4')])
    ff(['-display_rotation:v:0', '-90', '-i', join(work, 'side.tmp.mp4'), '-c', 'copy', '-movflags', '+faststart', p])
  },
  'drejet-720.mp4': p => {
    ff(['-i', base, '-vf', 'transpose=2', ...x264, '-preset', 'veryfast', '-crf', '24', '-an', join(work, 'side720.tmp.mp4')])
    ff(['-display_rotation:v:0', '-90', '-i', join(work, 'side720.tmp.mp4'), '-c', 'copy', '-movflags', '+faststart', p])
  },
  'stor-1080.mp4': p => ff(['-t', '3', '-i', base, '-vf', 'scale=1080:1920,noise=alls=40:allf=t', ...x264, '-preset', 'ultrafast', '-qp', '8', '-an', p]),
  'stille.mp4': p => ff(['-i', base, '-vf', 'trim=end_frame=1,loop=loop=179:size=1:start=0,setpts=N/(30*TB)', '-r', '30', ...x264, '-preset', 'veryfast', '-crf', '24', '-an', p]),
}
for (const [name, make] of Object.entries(CLIPS)) if (!existsSync(join(work, name))) make(join(work, name))

const srv = createServer((req, res) => {
  const u = req.url.split('?')[0]
  const file = u === '/videocoach.html' ? 'videocoach.html' : /^\/[\w.-]+\.(js|mjs)$/.test(u) ? u.slice(1) : null
  if (!file || !existsSync(join(root, 'public', file))) { res.statusCode = 404; return res.end() }
  res.setHeader('content-type', file.endsWith('.html') ? 'text/html' : 'text/javascript'); res.end(readFileSync(join(root, 'public', file)))
})
await new Promise(r => srv.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${srv.address().port}`
let browser = null
try { browser = await chromium.launch({ headless: true, channel: 'msedge' }) }
catch { try { browser = await chromium.launch({ headless: true, channel: 'chrome' }) } catch { browser = null } }
if (!browser) { srv.close(); console.log('SPRUNGET OVER: ingen Edge eller Chrome med H.264'); process.exit(0) }

const fails = [], notes = []
const check = (ok, text) => { if (!ok) fails.push(text) }
async function open(name, query = 'coach=1') {
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
  page.on('dialog', d => d.dismiss())
  await page.goto(`${origin}/videocoach.html?${query}`, { waitUntil: 'load' })
  const t0 = Date.now()
  await page.setInputFiles('#fileInput', join(work, name))
  await page.waitForFunction(() => vcNorm.done && !vcNorm.busy && !document.getElementById('canvas').hidden && canvas.width > 0 && video.readyState >= 2, null, { timeout: 240000 })
  if (!query.includes('normdirect=0')) await page.waitForFunction(() => vcNorm.frames || vcNorm.directError, null, { timeout: 20000 })   // små klip: billederne læses i baggrunden
  const state = await page.evaluate(() => ({ used: vcNorm.used, via: vcNorm.via, err: vcNorm.directError || null, frames: vcNorm.frames ? vcNorm.frames.samples.length : 0,
    slots: vcNorm.slots || null, klargjort: !!vcNorm.blob, src: video.currentSrc.slice(0, 5), size: [video.videoWidth, video.videoHeight], dur: +video.duration.toFixed(1),
    send: (() => { const f = vcAthleteFileToSend(); return { name: f.name, type: f.type, size: f.size, original: vcAthletePendingFile.size } })() }))
  return { page, state, klarMs: Date.now() - t0 }
}
async function analyse(page, point) {
  await page.waitForFunction(() => setBoundsSuggestion !== null, null, { timeout: 60000 })
  await page.evaluate(() => new Promise(res => { const f = () => { video.removeEventListener('seeked', f); res() }; video.addEventListener('seeked', f); video.currentTime = Math.max(0.1, trimStart) }))
  await page.evaluate(() => { const s = document.getElementById('liftSel'); s.value = 'Squat'; s.dispatchEvent(new Event('change')) })
  const t0 = Date.now()
  const r = await page.evaluate(async ({ x, y, r, w }) => {
    const k = canvas.width / w
    cmPerPx = 45 / (2 * r * k)
    const ret = await runFullAnalysis({ x: x * k, y: y * k, r: r * k })
    const p = latestCleanPath()
    return { ret, reps: p?.analysis?.reps?.length ?? 0, direct: window.__vcDirectLast || null, banner: (document.getElementById('banner') || {}).textContent || '' }
  }, point)
  return { ...r, ms: Date.now() - t0 }
}
const plate = { x: gt.samples[3].x, y: gt.samples[3].y, r: gt.plateRadius, w: gt.width }

try {
  // 1. Instagram-klip (720p): før gik det uden om klargøringen og blev sporet under afspilning i 0,1 til 0,3 fart
  {
    const { page, state, klarMs } = await open('ig-720.mp4')
    check(state.used && state.via === 'webcodecs' && !state.err, 'ig-720: billederne blev ikke læst direkte fra filen: ' + JSON.stringify(state))
    check(state.frames === 600, 'ig-720: ikke alle 600 billeder kom med: ' + JSON.stringify(state))
    check(!state.klargjort && state.size[0] === 720 && state.size[1] === 1280, 'ig-720: et lille klip skal ikke omkodes: ' + JSON.stringify(state))
    check(state.send.name === 'ig-720.mp4', 'ig-720: et lille klip skal sendes som det er, ikke som et større klargjort klip: ' + JSON.stringify(state.send))
    const a = await analyse(page, plate)
    check(a.reps === 5, `ig-720: ${a.reps} reps af 5`)
    check(a.direct && !a.direct.failed && a.direct.last > 15, 'ig-720: sporeren læste ikke billederne direkte: ' + JSON.stringify(a.direct))
    check(a.ms < 35000, `ig-720: analysen tog ${a.ms} ms (mål under 35 s for 20 s klip)`)
    notes.push(`ig-720 klar ${klarMs} ms, analyse ${a.ms} ms, ${a.reps} reps`)
    // et tryk uden for skiven: én sætning om hvorfor, ingen stille afvisning
    await page.evaluate(() => new Promise(res => { const f = () => { video.removeEventListener('seeked', f); res() }; video.addEventListener('seeked', f); video.currentTime = 1.2 }))
    const few = await page.evaluate(async () => { const ret = await runFullAnalysis({ x: canvas.width * .5, y: canvas.height * .02, r: 30 }); return { ret, banner: document.getElementById('banner').textContent } })
    check(few.ret === false && /for få tydelige detaljer, hvor du trykkede/.test(few.banner), 'tryk uden for skiven gav ikke sætningen om detaljer: ' + JSON.stringify(few))
    await page.context().close()
  }
  // 2. telefonklip, der ligger på siden med drejning i filen (som iPhone): skal stå op og give samme reps
  {
    const { page, state, klarMs } = await open('drejet-1080.mp4')
    check(state.used && !state.err && state.klargjort && state.size[0] === 720 && state.size[1] === 1280 && state.frames === 600 && state.slots.filled === 0 && state.slots.missing === 0, 'drejet: forkert klargjort klip: ' + JSON.stringify(state))
    const a = await analyse(page, plate)
    check(a.reps === 5, `drejet: ${a.reps} reps af 5 (drejningen i filen er ikke fulgt)`)
    notes.push(`drejet-1080 klar ${klarMs} ms, analyse ${a.ms} ms, ${a.reps} reps`)
    await page.context().close()
  }
  // 2b. lille klip på siden (720p med drejning): omkodes ikke; sporeren drejer selv billederne
  {
    const { page, state } = await open('drejet-720.mp4')
    check(state.used && !state.err && !state.klargjort && state.size[0] === 720 && state.size[1] === 1280 && state.frames === 600, 'drejet-720: billederne blev ikke læst direkte: ' + JSON.stringify(state))
    const a = await analyse(page, plate)
    check(a.reps === 5 && a.direct && !a.direct.failed, `drejet-720: ${a.reps} reps af 5, direkte ${JSON.stringify(a.direct)}`)
    notes.push(`drejet-720 analyse ${a.ms} ms, ${a.reps} reps`)
    await page.context().close()
  }
  // 3. stort klip: det klargjorte (720p) er det, der sendes
  {
    const { page, state } = await open('stor-1080.mp4', 'mode=athlete')
    check(state.send.name === 'klargjort.mp4' && state.send.type === 'video/mp4' && state.send.size < state.send.original / 2,
      'stort klip: det klargjorte klip sendes ikke: ' + JSON.stringify(state.send))
    notes.push(`stor-1080 original ${(state.send.original / 1048576).toFixed(1)} MB, sendes som ${(state.send.size / 1048576).toFixed(1)} MB`)
    await page.context().close()
  }
  // 4. klip uden bevægelse: sætningen siger hvorfor
  {
    const { page } = await open('stille.mp4')
    const a = await analyse(page, plate)
    check(a.ret === false && /Stangen flyttede sig næsten ikke i klippet/.test(a.banner), 'klip uden bevægelse gav ikke sætningen om hvorfor: ' + JSON.stringify(a))
    await page.context().close()
  }
  // 5. uden den direkte vej (?normdirect=0) er alt som før: et lille klip går uden om klargøringen
  {
    const { page, state } = await open('ig-720.mp4', 'coach=1&normdirect=0')
    check(!state.used && state.frames === 0 && state.send.name === 'ig-720.mp4', 'normdirect=0: den gamle vej er ændret: ' + JSON.stringify(state))
    await page.context().close()
  }
} catch (e) { fails.push('kørslen stoppede: ' + String(e.message).slice(0, 400)) } finally {
  await browser.close().catch(() => {})
  srv.close()
}
if (fails.length) { console.log('FEJL:\n - ' + fails.join('\n - ')); process.exit(1) }
console.log('GRØN: ' + notes.join('; '))
