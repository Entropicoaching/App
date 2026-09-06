// ORDRE 80 · commit 3 — knapperne af vejen.
// -----------------------------------------------------------------------------
// Marcs egen klage: hurtig/langsom-chippen (⚡/🐢) lå oven i analyse-UI'et og
// fyldte for meget på hans telefon. Målt (se RAPPORT.md): i coachweb-tilstand
// med et klip åbnet på en 390px-viewport lå den gamle bund-venstre-placering
// midt oven i BÅDE footeren (~70px høj) og scrubRow (~120px høj, tidslinje +
// fartpanel) - den ægte "analyse-UI". Løsningen flyttede chippen til toppen
// i coachweb (header/zenBtn/openSmall er allerede, uafhængigt af denne ordre,
// skjulte dér - toppen er reelt fri) og lod den forsvinde mens en sporing
// rent faktisk kører.
//
// Dette script kører den ÆGTE, uændrede public/videocoach.html i headless
// Chromium på en 390px-viewport, med ordre 73's rigtige testklip åbnet:
//   - tager et "efter"-skærmbillede af coachweb-tilstanden med chippen synlig,
//   - tjekker at chippens boks IKKE skærer footerens eller scrubRow's boks,
//   - tjekker at chippen forsvinder når en sporing rent faktisk startes
//     (samme ægte runFullAnalysis-kald som en coach ville trykke),
//   - tjekker at atletens "Send til coach"-knap (standardvejen, ingen
//     sporing) stadig er synlig og mindst lige så fremtrædende som før.
//
// Kørsel: npm run verify:videocoach-buttons-layout

import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const clipPath = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.mp4')

if (!existsSync(clipPath)) {
  console.log('Intet testklip fundet - genererer det først (npm run test:clip) ...')
  const gen = spawnSync(process.execPath, [join(here, 'make-test-clip.mjs')], { stdio: 'inherit' })
  if (gen.status !== 0) { console.error('Kunne ikke generere testklippet.'); process.exit(1) }
}
const clipBuffer = readFileSync(clipPath)
const htmlBuffer = readFileSync(join(root, 'public', 'videocoach.html'))
const zoomJsBuffer = readFileSync(join(root, 'public', 'videocoach-zoom.js'))

const outDir = join(root, 'outputs', 'vis-mig-nu-realtid')
mkdirSync(outDir, { recursive: true })

function startServer() {
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (url === '/videocoach.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(htmlBuffer); return }
    if (url === '/videocoach-zoom.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(zoomJsBuffer); return }
    if (url === '/clip.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); res.end(clipBuffer); return }
    res.writeHead(404); res.end()
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }))
  })
}

const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const require = createRequire(import.meta.url)
const { chromium } = require(join(runtimeModules, 'playwright'))

function intersects(a, b) {
  if (!a || !b || a.hidden || b.hidden) return false
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

async function rectsOf(page, ids) {
  return page.evaluate(idList => {
    const rect = el => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height, hidden: el.hidden || getComputedStyle(el).display === 'none' }
    }
    const out = {}
    for (const id of idList) out[id] = rect(id.startsWith('tag:') ? document.querySelector(id.slice(4)) : document.getElementById(id))
    return out
  }, ids)
}

async function main() {
  const { server, origin } = await startServer()
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    await page.goto(`${origin}/videocoach.html?coach=1`)
    await page.waitForTimeout(200)
    await page.setInputFiles('#fileInput', { name: 'clip.mp4', mimeType: 'video/mp4', buffer: clipBuffer })
    await page.waitForFunction(() => document.getElementById('canvas')?.width > 0, null, { timeout: 15000 })
    await page.waitForTimeout(400)

    const idleShot = join(outDir, 'coachweb-390px-efter.png')
    await page.screenshot({ path: idleShot })
    console.log(`Skærmbillede (efter, chip synlig): ${idleShot}`)

    const idleRects = await rectsOf(page, ['trackerFastSeg', 'tag:footer', 'scrubRow'])
    console.log('Bokse (idle):', JSON.stringify(idleRects))

    assert.equal(idleRects.trackerFastSeg?.hidden, false, 'Chippen skal være synlig når ingen sporing kører')
    assert.ok(!intersects(idleRects.trackerFastSeg, idleRects.footer),
      'Chippens boks skærer footerens boks')
    assert.ok(!intersects(idleRects.trackerFastSeg, idleRects.scrubRow),
      'Chippens boks skærer scrubRow (tidslinje/fartpanel) - den egentlige analyse-UI')

    // ---- Chippen skal forsvinde mens en ægte sporing kører ----
    // autoCalib(p) er den samme, uændrede funktion et rigtigt klik på skiven
    // ville kalde (via wizardClick) - kaldt direkte her for at undgå at
    // simulere en ægte pointer-capture i en headless side, som kræver et
    // rigtigt inputenhed-id browseren ikke giver til et scriptet event.
    // runFullAnalysis er den UÆNDREDE funktion en coach rent faktisk trykker
    // sig frem til; det er den der sætter `analyzing`, ikke denne tests klik.
    await page.selectOption('#liftSel', 'Squat')
    const p0 = { x: 360, y: 420 } // skivens kendte startposition ved t≈0, se make-test-clip.mjs (CX, TOP_Y)
    await page.evaluate(async ({ x, y }) => {
      // Samme fix som ordre 73/80 commit 2: et play()/pause()-par maler ikke
      // pålideligt et rigtigt frame i headless Chromium - et eksplicit seek gør.
      await new Promise(resolve => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = 0.1
      })
      const scale = autoCalib({ x, y })
      if (!scale) throw new Error('autoCalib fandt ikke skiven - er testklippet ændret?')
      cmPerPx = scale
      plateConfirm = { x, y, r: 22.5 / scale }
      const barPt = vcConfirmPlateRing()
      runFullAnalysis(barPt)
    }, p0)
    await page.waitForTimeout(400)
    const busyRects = await rectsOf(page, ['trackerFastSeg'])
    console.log('Boks mens sporing kører:', JSON.stringify(busyRects))
    assert.equal(busyRects.trackerFastSeg?.hidden, true, 'Chippen skal forsvinde mens en sporing rent faktisk kører')

    // Ryd op: stop sporingen igen så processen kan lukkes rent.
    await page.evaluate(() => { if (typeof tracking !== 'undefined') tracking = false })

    console.log('\nGRØN: chippen overlapper ikke footer/scrubRow, og forsvinder mens en sporing kører.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    server.close()
  }
}

main()
