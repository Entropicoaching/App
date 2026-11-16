// ORDRE 1537v0 · 60 s klip ende til ende mod lokal R2 i `wrangler dev` (ingen Cloudflare-konto, ingen nøgler):
// den rigtige public/videocoach.html gør et syntetisk 60 s klip klar (720p), appens klient (src/videolager/klient.js)
// sender det klargjorte klip direkte til lageret fra browseren, coachen får en hente-adresse, åbner klippet
// fra lageret og analyserer det. Opdigtet Supabase på 8998, Workeren på 8797. Kun syntetiske klip.
// Kørsel: node scripts/verify-videolager-60s.mjs   (WRANGLER_JS peger på wrangler.js, hvis den ikke ligger i node_modules)
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'

const root = resolve(import.meta.dirname, '..')
const wranglerJs = [process.env.WRANGLER_JS, join(root, 'node_modules/wrangler/bin/wrangler.js'),
  'C:/Users/nugga/Hara/repos/hara-hovedtrae/node_modules/wrangler/bin/wrangler.js'].find(p => p && existsSync(p))
if (!wranglerJs) { console.log('SPRUNGET OVER: wrangler findes ikke (sæt WRANGLER_JS)'); process.exit(0) }
const playwrightDir = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')
if (!existsSync(playwrightDir)) { console.log('SPRUNGET OVER: playwright findes ikke'); process.exit(0) }
const { chromium, devices } = createRequire(import.meta.url)(playwrightDir)

const ATHLETE = '11111111-1111-4111-8111-111111111111', ANALYSIS = '33333333-3333-4333-8333-333333333333'
const TOKEN = 'token-for-opdigtet-atlet-1234567890', WORKER = 'http://127.0.0.1:8797'
const gt = JSON.parse(readFileSync(join(root, 'docs/videocoach/clip-cache/synthetic-set.ground-truth.json'), 'utf8'))
const work = join(tmpdir(), 'vc-ingang'); mkdirSync(work, { recursive: true })
const clip = join(work, 'long60.mp4')
if (!existsSync(clip)) {
  const r = spawnSync(ffmpegPath, ['-v', 'error', '-y', '-stream_loop', '2', '-i', join(root, 'docs/videocoach/clip-cache/synthetic-set.mp4'),
    '-vf', 'scale=1080:1920', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', clip])
  if (r.status !== 0) { console.log('FEJL: ffmpeg kunne ikke lave klippet'); process.exit(1) }
}

const supabase = createServer((req, res) => {
  const path = req.url.split('?')[0]
  const ok = req.headers.authorization === `Bearer ${TOKEN}`
  const data = !ok ? null : path === '/auth/v1/user' ? { id: '22222222-2222-4222-8222-222222222222' }
    : path === '/rest/v1/athletes' ? [{ id: ATHLETE }] : path === '/rest/v1/video_analyses' ? [{ id: 'r1' }] : null
  res.statusCode = data ? 200 : 401; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data || {}))
})
await new Promise(r => supabase.listen(8998, '127.0.0.1', r))
const files = { '/videocoach.html': ['public/videocoach.html', 'text/html'], '/klient.js': ['src/videolager/klient.js', 'text/javascript'] }
const side = createServer((req, res) => {
  const u = req.url.split('?')[0]
  const hit = files[u] || (/^\/[\w.-]+\.(js|mjs)$/.test(u) && existsSync(join(root, 'public', u)) ? ['public' + u, 'text/javascript'] : null)
  if (!hit) { res.statusCode = 404; return res.end() }
  res.setHeader('content-type', hit[1]); res.end(readFileSync(join(root, hit[0])))
})
await new Promise(r => side.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${side.address().port}`
const state = mkdtempSync(join(tmpdir(), 'videolager60-'))
const wrangler = spawn(process.execPath, [wranglerJs, 'dev', '-c', join(root, 'workers/videolager/wrangler.jsonc'),
  '--port', '8797', '--ip', '127.0.0.1', '--persist-to', state, '--show-interactive-dev-session=false',
  '--var', `ALLOWED_ORIGINS:${origin}`, '--var', 'SUPABASE_URL:http://127.0.0.1:8998'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } })
let log = ''; wrangler.stdout.on('data', d => { log += d }); wrangler.stderr.on('data', d => { log += d })
let failed = null, browser = null
const must = (ok, text) => { if (!ok) throw new Error(text) }
try {
  let up = false
  for (let i = 0; i < 120 && !up; i++) { up = await fetch(WORKER + '/sundhed', { signal: AbortSignal.timeout(2000) }).then(r => r.ok, () => false); if (!up) await new Promise(r => setTimeout(r, 500)) }
  must(up, 'wrangler dev svarede ikke:\n' + log.slice(-1500))
  try { browser = await chromium.launch({ headless: true, channel: 'msedge' }) }
  catch { try { browser = await chromium.launch({ headless: true, channel: 'chrome' }) } catch { browser = null } }
  if (!browser) { console.log('SPRUNGET OVER: ingen Edge eller Chrome med H.264'); process.exitCode = 0 } else {
    const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
    page.on('dialog', d => d.dismiss())
    await page.goto(`${origin}/videocoach.html?coach=1`, { waitUntil: 'load' })
    const ready = () => page.waitForFunction(() => vcNorm.done && !vcNorm.busy && !document.getElementById('canvas').hidden && canvas.width > 0 && video.readyState >= 2, null, { timeout: 300000 })
    // 1. atleten vælger et 60 s klip (1080p); siden gør det klar
    let t0 = Date.now()
    await page.setInputFiles('#fileInput', { name: 'long60.mp4', mimeType: 'video/mp4', buffer: readFileSync(clip) })
    await ready()
    const klarMs = Date.now() - t0
    const prepared = await page.evaluate(() => { const f = vcAthleteFileToSend(); return { name: f.name, type: f.type, size: f.size, original: vcAthletePendingFile.size, via: vcNorm.via, dur: video.duration } })
    must(prepared.via === 'webcodecs', 'klippet blev ikke gjort klar med WebCodecs: ' + JSON.stringify(prepared))
    // det syntetiske klip er hårdt komprimeret (5 MB), så her er det klargjorte større; telefonklip er 170 til 400 MB pr. minut
    const mb = await page.evaluate(() => +(vcNorm.blob.size / 1048576).toFixed(1))
    must(mb > 5 && mb < 50, `klargjort 60 s klip fylder ${mb} MB (ventet under 50)`)
    // 2. appens klient sender det klargjorte klip direkte til lageret og får en hente-adresse
    t0 = Date.now()
    const sent = await page.evaluate(async ({ WORKER, TOKEN, ANALYSIS, path }) => {
      const m = await import('/klient.js')
      const file = new File([vcNorm.blob], 'klargjort.mp4', { type: 'video/mp4' })
      const args = { base: WORKER, token: TOKEN, clientAnalysisId: ANALYSIS, path, file, mimeType: 'video/mp4' }
      const first = await m.uploadTilVideolager(args), again = await m.uploadTilVideolager(args)
      const wrong = await m.uploadTilVideolager({ ...args, token: 'forkert-token-som-er-lang-nok-123' })
      const url = await m.hentFraVideolager({ base: WORKER, token: TOKEN, videoPath: path })
      const old = await m.hentFraVideolager({ base: WORKER, token: TOKEN, videoPath: path.replace('3333', '4444') })
      return { first, again, wrong: wrong.error && wrong.error.message, url, old, size: file.size }
    }, { WORKER, TOKEN, ANALYSIS, path: `${ATHLETE}/${ANALYSIS}.mp4` })
    const uploadMs = Date.now() - t0
    must(sent.first.error === null && sent.again.error === null, 'upload fejlede: ' + JSON.stringify(sent))
    must(sent.wrong === 'Log ind igen', 'forkert token gav: ' + sent.wrong)
    must(typeof sent.url === 'string' && sent.old === null, 'hente-adresse: ' + JSON.stringify([sent.url, sent.old]))
    const head = await fetch(sent.url, { headers: { range: 'bytes=0-99' } })
    must(head.status === 206 && Number(head.headers.get('content-range').split('/')[1]) === sent.size, 'klippet i lageret har ikke samme størrelse')
    // 3. coachen åbner klippet fra lageret og analyserer det
    t0 = Date.now()
    await page.evaluate(url => { loadRemoteVideo(url) }, sent.url)
    await page.waitForFunction(() => vcNorm.done && !vcNorm.busy && vcNorm.frames && !vcNorm.blob && video.readyState >= 2 && !document.getElementById('canvas').hidden, null, { timeout: 120000 })
    const openMs = Date.now() - t0
    await page.waitForFunction(() => setBoundsSuggestion !== null, null, { timeout: 60000 })   // sætforslaget er færdigt, som når coachen ser det
    const remote = await page.evaluate(() => ({ frames: vcNorm.frames ? vcNorm.frames.samples.length : 0, dur: +video.duration.toFixed(1), src: video.currentSrc.slice(0, 5), err: vcNorm.directError || null }))
    must(remote.frames >= 1790 && remote.dur >= 59.5 && remote.src === 'http:', 'klippet fra lageret blev ikke læst direkte: ' + JSON.stringify(remote))
    await page.evaluate(() => new Promise(res => { const f = () => { video.removeEventListener('seeked', f); res() }; video.addEventListener('seeked', f); video.currentTime = 0.1 }))
    await page.evaluate(() => { const s = document.getElementById('liftSel'); s.value = 'Squat'; s.dispatchEvent(new Event('change')) })
    t0 = Date.now()
    const result = await page.evaluate(async ({ x, y, r, w }) => {
      const k = canvas.width / w
      cmPerPx = 45 / (2 * r * k)
      await runFullAnalysis({ x: x * k, y: y * k, r: r * k })
      const p = latestCleanPath()
      return { reps: p?.analysis?.reps?.length ?? 0, direct: window.__vcDirectLast || null }
    }, { x: gt.samples[3].x, y: gt.samples[3].y, r: gt.plateRadius, w: gt.width })
    const analyseMs = Date.now() - t0
    must(result.reps === 15, `coachen fik ${result.reps} reps af 15 på klippet fra lageret`)
    must(result.direct && !result.direct.failed, 'sporeren læste ikke billederne direkte: ' + JSON.stringify(result.direct))
    console.log(`GRØN: 60 s klip (original ${(statSync(clip).size / 1048576).toFixed(1)} MB) gjort klar på ${klarMs} ms til ${mb} MB, sendt til lokal R2 og hente-adresse på ${uploadMs} ms, ` +
      `åbnet fra lageret på ${openMs} ms, analyseret på ${analyseMs} ms med 15 af 15 reps; samme klip igen er ikke en fejl, forkert token giver "Log ind igen"`)
  }
} catch (e) { failed = e } finally {
  if (browser) await browser.close().catch(() => {})
  // luk kun egne processer, efter PID
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(wrangler.pid), '/T', '/F'], { stdio: 'ignore' })
  else wrangler.kill('SIGKILL')
  supabase.close(); side.close()
  await new Promise(r => setTimeout(r, 800))
  for (const dir of [state, join(root, 'workers/videolager/.wrangler')]) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* workerd kan holde filerne et øjeblik */ }
  }
}
if (failed) { console.log('FEJL: ' + failed.message); process.exit(1) }
