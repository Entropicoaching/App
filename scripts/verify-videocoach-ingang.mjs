// ORDRE 1022 - indgangen til videocoachen: telefonklip -> barpath + reps (eller klar besked).
// Koerer den AEGTE public/videocoach.html i headless Chromium med iPhone- og Android-
// emulering paa tre selvlavede syntetiske klip (ingen atletvideoer):
//   iphone-hevc.mov (HEVC, 2160x3840, 60 fps), android.mp4 (H.264 1080x1920), long60.mp4 (60 s).
// Klippene laves af docs/videocoach/clip-cache/synthetic-set.mp4 (npm run test:clip) via ffmpeg-static.
// HEVC kraever en browser med HEVC (system-Chrome/Edge); mangler den, er forventningen den KLARE BESKED.
// Kørsel: node scripts/verify-videocoach-ingang.mjs [--ud mappe]
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const require = createRequire(import.meta.url)
const { chromium, devices } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))

const baseClip = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.mp4')
const gt = JSON.parse(readFileSync(join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.ground-truth.json'), 'utf8'))
const work = join(tmpdir(), 'vc-ingang'); mkdirSync(work, { recursive: true })

function ff(args) {
  const r = spawnSync(ffmpegPath, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0) throw new Error('ffmpeg fejlede')
}
const CLIPS = [
  { name: 'iphone-hevc.mov', mime: 'video/quicktime', device: 'iPhone 13', channel: 'chrome', hevc: true, make: p => ff(['-i', baseClip, '-vf', 'scale=2160:3840,fps=60', '-c:v', 'libx265', '-preset', 'ultrafast', '-crf', '26', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-an', p]) },
  { name: 'android.mp4', mime: 'video/mp4', device: 'Pixel 7', channel: 'chrome', make: p => ff(['-i', baseClip, '-vf', 'scale=1080:1920', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', p]) },
  { name: 'kontrol-720p.mp4', mime: 'video/mp4', device: 'Pixel 7', channel: 'chrome', make: p => ff(['-i', baseClip, '-c', 'copy', p]) },
  { name: 'long60.mp4', mime: 'video/mp4', device: 'Pixel 7', channel: 'chrome', make: p => ff(['-stream_loop', '2', '-i', baseClip, '-vf', 'scale=1080:1920', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', p]) },
]
CLIPS.push({ name: 'iphone-hevc.mov', label: 'iphone-hevc-uden-hevc-i-browseren', mime: 'video/quicktime', device: 'iPhone 13', bundled: true, expectMessage: true, make: () => {} })
const only = process.argv.includes('--kun') ? process.argv[process.argv.indexOf('--kun') + 1] : null
const onlyLabel = c => c.label || c.name

const html = readFileSync(join(root, 'public', 'videocoach.html'))
const srv = createServer((req, res) => {
  const u = req.url.split('?')[0]
  if (u === '/videocoach.html') { res.setHeader('content-type', 'text/html'); return res.end(html) }
  if (u === '/videocoach-zoom.js') { res.setHeader('content-type', 'text/javascript'); return res.end(readFileSync(join(root, 'public', 'videocoach-zoom.js'))) }
  if (u === '/videocoach-velocity.js') { res.setHeader('content-type', 'text/javascript'); return res.end(readFileSync(join(root, 'public', 'videocoach-velocity.js'))) }
  res.statusCode = 404; res.end()
})
await new Promise(r => srv.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${srv.address().port}`

const results = []
for (const c of CLIPS) {
  if (only && onlyLabel(c) !== only) continue
  const path = join(work, c.name)
  if (!existsSync(path)) c.make(path)
  const out = { clip: c.label || c.name, device: c.device, mb: +(statSync(path).size / 1048576).toFixed(1) }
  let browser
  try { browser = await chromium.launch({ headless: true, channel: c.bundled ? undefined : c.channel }) }
  catch (e) { browser = await chromium.launch({ headless: true }); out.note = 'ingen system-Chrome, bundlet Chromium' }
  const ctx = await browser.newContext({ ...devices[c.device] })
  const page = await ctx.newPage()
  page.on('dialog', d => d.dismiss())
  page.on('pageerror', e => { out.pageerror = e.message })
  await page.goto(`${origin}/videocoach.html?mode=athlete&instant=1`)
  if (process.env.VC_FORCE_RECORDER) await page.evaluate(() => { vcNorm.forceRecorder = true })
  const t0 = Date.now()
  await page.setInputFiles('#fileInput', { name: c.name, mimeType: c.mime, buffer: readFileSync(path) })
  const loaded = await page.waitForFunction(() => (document.getElementById('canvas')?.width > 0 && !document.getElementById('canvas').hidden) ||
    /understøttes ikke|kan ikke åbnes|hænge/.test(document.getElementById('banner')?.textContent || ''), null, { timeout: 150000 }).then(() => true).catch(() => false)
  out.loadMs = Date.now() - t0
  out.banner = await page.evaluate(() => document.getElementById('banner')?.textContent || '')
  const ok = await page.evaluate(() => !document.getElementById('canvas').hidden && document.getElementById('canvas').width > 0)
  if (!loaded || !ok) { out.result = 'BESKED'; results.push(out); await browser.close(); continue }
  await page.evaluate(() => new Promise(res => { const f = () => { video.removeEventListener('seeked', f); res() }; video.addEventListener('seeked', f); video.currentTime = 0.1 }))
  await page.evaluate(() => { const s = document.getElementById('liftSel'); s.value = 'Squat'; s.dispatchEvent(new Event('change')) })
  const t1 = Date.now()
  const r = await page.evaluate(async ({ x, y, r, w }) => {
    const k = canvas.width / w
    cmPerPx = 45 / (2 * r * k)
    const ret = await runFullAnalysis({ x: x * k, y: y * k, r: r * k })
    const p = latestCleanPath()
    return { ret, reps: p?.analysis?.reps?.length ?? 0, pts: p?.pts?.length ?? 0, canvas: [canvas.width, canvas.height], dur: video.duration }
  }, { x: gt.samples[3].x, y: gt.samples[3].y, r: gt.plateRadius, w: gt.width })
  out.trackMs = Date.now() - t1
  Object.assign(out, r)
  out.slots = await page.evaluate(() => vcNorm.slots || null)   // ORDRE 1238: manglende pladser i det normaliserede klip
  out.via = await page.evaluate(() => vcNorm.via); out.result = r.reps >= 1 ? 'BANE' : 'FEJL'
  results.push(out); await browser.close()
}
srv.close()
console.log(JSON.stringify(results, null, 1))
const want = r => (r.clip === 'long60.mp4' ? 3 : 1) * gt.repWindows.length
const bad = results.filter(r => (r.clip.includes('uden-hevc') ? r.result !== 'BESKED' : (r.reps !== want(r) || (r.slots && r.slots.missing > 0))))
console.log(bad.length ? `FEJL: ${bad.map(r => r.clip).join(', ')}` : `GRØN: alle klip giver forventede reps (${gt.repWindows.length}, 3x for long60) eller en klar besked`)
process.exit(bad.length ? 1 : 0)
