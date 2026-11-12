// ORDRE 1044 - fejl- og klipskiftcases for normaliseringen (leverance 1022, QA-fund 1-4).
// Bruger de syntetiske klip, ingangstesten laver i tmp/vc-ingang (koer verify:videocoach-ingang foerst).
// Kørsel: node scripts/verify-videocoach-norm-fejl.mjs
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const require = createRequire(import.meta.url)
const { chromium, devices } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const work = join(tmpdir(), 'vc-ingang')
const big = join(work, 'android.mp4'), small = join(work, 'kontrol-720p.mp4')
if (!existsSync(big) || !existsSync(small)) { console.error('Mangler klip: koer node scripts/verify-videocoach-ingang.mjs foerst'); process.exit(2) }

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
const file = (p, name) => ({ name, mimeType: 'video/mp4', buffer: readFileSync(p) })
const results = []
const check = (name, ok, info) => { results.push({ name, ok: !!ok, info }); console.log(ok ? 'OK  ' : 'FEJL', name, info ?? '') }

async function open(init) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await ctx.newPage()
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.dismiss())
  if (init) await page.addInitScript(init)
  await page.goto(`${origin}/videocoach.html?mode=athlete&instant=1`)
  return { browser, page, errs }
}
const ready = page => page.waitForFunction(() => !document.getElementById('canvas').hidden && document.getElementById('canvas').width > 0, null, { timeout: 90000 }).then(() => true).catch(() => false)

// 1) to hurtige filvalg: stort klip A, saa straks lille klip B. Kun B maa vaere i spil.
{
  const { browser, page, errs } = await open()
  await page.setInputFiles('#fileInput', file(big, 'a.mp4'))
  await page.waitForFunction(() => vcNorm.busy, null, { timeout: 30000 })
  await page.setInputFiles('#fileInput', file(small, 'b.mp4'))
  const ok = await ready(page)
  await page.waitForTimeout(25000)            // giv det gamle job tid til (fejlagtigt) at skrive
  const s = await page.evaluate(() => ({ used: vcNorm.used, busy: vcNorm.busy, w: video.videoWidth, h: video.videoHeight, same: video.src === curUrl, src: video.src.slice(0, 5) }))
  check('klipskift: kun sidste job skriver', ok && !s.used && !s.busy && Math.max(s.w, s.h) <= 1280 && s.same, JSON.stringify(s))
  check('klipskift: ingen pageerror', !errs.length, errs[0])
  await browser.close()
}
// 2) encoder.configure kaster: ingen haeng, reserve eller original, efterfoelgende klar besked
{
  const { browser, page, errs } = await open(() => {
    if (window.VideoEncoder) { const C = VideoEncoder.prototype.configure; VideoEncoder.prototype.configure = function () { throw new Error('encoder resource unavailable') } }
  })
  await page.setInputFiles('#fileInput', file(big, 'a.mp4'))
  const ok = await ready(page)
  const s = await page.evaluate(() => ({ busy: vcNorm.busy, via: vcNorm.via, used: vcNorm.used, err: vcNorm.error }))
  check('configure kaster: klippet kommer videre uden haeng', ok && !s.busy, JSON.stringify(s))
  check('configure kaster: ingen pageerror', !errs.length, errs[0])
  await browser.close()
}
// 3) ingen WebCodecs og ingen requestVideoFrameCallback: original + advarsel der overlever begin
{
  const { browser, page, errs } = await open(() => {
    delete window.VideoEncoder; delete window.VideoFrame
    delete HTMLVideoElement.prototype.requestVideoFrameCallback
  })
  await page.setInputFiles('#fileInput', file(big, 'a.mp4'))
  const ok = await ready(page)
  await page.waitForTimeout(1500)
  const s = await page.evaluate(() => ({ warn: document.getElementById('vcNormWarn'), txt: document.getElementById('vcNormWarn')?.textContent, vis: !!document.getElementById('vcNormWarn') && !document.getElementById('vcNormWarn').hidden, busy: vcNorm.busy, err: vcNorm.error }))
  check('ingen frame-API: original bruges, ingen haeng', ok && !s.busy && s.err === 'no-frame-api', JSON.stringify({ busy: s.busy, err: s.err }))
  check('ingen frame-API: advarslen er synlig efter begin', s.vis && /originalen/.test(s.txt || ''), s.txt)
  check('ingen frame-API: ingen pageerror fra normaliseringen', !errs.some(e => /requestVideoFrameCallback/.test(e)), errs[0])
  await browser.close()
}
srv.close()
const bad = results.filter(r => !r.ok)
console.log(bad.length ? `FEJL: ${bad.map(r => r.name).join(' | ')}` : 'GRØN: alle fejl- og klipskiftcases bestået')
process.exit(bad.length ? 1 : 0)
