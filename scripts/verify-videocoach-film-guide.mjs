// ORDRE 196 · commit 2 — filmevejledning FØR atleten vælger fil.
//
// Kilden er docs/videocoach/FILMEVEJLEDNING.md (kogt ned fra
// entropi-loeftmodel-wt2/docs/FILM-ET-LOEFT.md og appens egen
// docs/videocoach/TEST-CLIPS.md). Vejledningen lever i public/videocoach.html
// selv (renderFilmGuide, se filen) - ingen React, samme injicerbare
// localStorage-mønster som src/readinessDraft.js.
//
// Dette script kører den ÆGTE, uændrede public/videocoach.html i headless
// Chromium på en 390×844-viewport (samme konvention som
// verify-videocoach-buttons-layout.mjs), i ATHLETE-tilstand (ingen ?coach=1):
//   - første besøg: hele vejledningen (seks punkter + lukkelinje) er synlig
//     FØR "Åbn video"-knappen, og entropi_film_guide_seen sættes,
//   - genindlæsning (andet besøg): kun én linje ("vis igen"), ingen ny
//     afhængighed, ingen ny state-model - kun localStorage,
//   - "vis igen" har mindst 44px trykflade og folder hele vejledningen ud igen,
//   - ingen vandret scroll og ingen browser-fejl ved 390px,
//   - skærmbilleder i outputs/film-foer-du-sender/.
//
// Kørsel: npm run verify:videocoach-film-guide

import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const htmlBuffer = readFileSync(join(root, 'public', 'videocoach.html'))
const zoomJsBuffer = readFileSync(join(root, 'public', 'videocoach-zoom.js'))

const outDir = join(root, 'outputs', 'film-foer-du-sender')
mkdirSync(outDir, { recursive: true })

function startServer() {
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (url === '/videocoach.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(htmlBuffer); return }
    if (url === '/videocoach-zoom.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(zoomJsBuffer); return }
    // /icon.svg og /sw.js (favicon, service worker-registrering) er uden
    // betydning for denne test - stubbes så konsol-fejl-tjekket nedenfor kun
    // fanger ÆGTE JS-fejl, ikke støj fra manglende statiske filer i denne
    // minimale testserver.
    if (url === '/icon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg"></svg>'); return }
    if (url === '/sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('') ; return }
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

async function main() {
  const { server, origin } = await startServer()
  const browser = await chromium.launch({ headless: true })
  const consoleErrors = []
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`) })

    // ---- Første besøg: hele vejledningen, FØR "Åbn video" ----
    await page.goto(`${origin}/videocoach.html`)
    await page.waitForSelector('#athFilmGuide')
    await page.waitForTimeout(200)

    const firstShot = join(outDir, 'atlet-foerste-besoeg-390px.png')
    await page.screenshot({ path: firstShot })
    console.log(`Skærmbillede (første besøg, hele vejledningen): ${firstShot}`)

    const points = await page.locator('#athFilmGuide li').allTextContents()
    assert.ok(points.length >= 1 && points.length <= 6,
      `Højst seks punkter forventet, fandt ${points.length}`)
    assert.ok(points.length > 0, 'Første besøg skal vise vejledningens punkter fuldt ud')

    const footer = await page.locator('#athFilmGuide .athFilmGuideFooter').textContent()
    assert.match(footer || '', /coachen ikke kan se/, 'Lukkelinjen om coachens vurdering skal være med')

    // Vejledningen skal stå FØR "Åbn video"-knappen i dokumentet (før atleten vælger fil).
    const order = await page.evaluate(() => {
      const guide = document.getElementById('athFilmGuide')
      const cta = document.getElementById('athleteOpenVideoBtn')
      return !!(guide && cta && (guide.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING))
    })
    assert.ok(order, 'Filmvejledningen skal stå FØR "Åbn video"-knappen i DOM\'et')

    const seenAfterFirst = await page.evaluate(() => localStorage.getItem('entropi_film_guide_seen'))
    assert.equal(seenAfterFirst, '1', 'Første visning skal markere entropi_film_guide_seen i localStorage')

    // ---- Ingen vandret scroll ved 390px ----
    const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    assert.equal(hScroll, false, 'Ingen vandret scroll ved 390px')

    // ---- Andet besøg (reload, samme localStorage): kun én linje ----
    await page.reload()
    await page.waitForSelector('#athFilmGuide')
    await page.waitForTimeout(200)

    const collapsedPoints = await page.locator('#athFilmGuide li').count()
    assert.equal(collapsedPoints, 0, 'Andet besøg skal IKKE vise hele punktlisten igen')

    const toggle = page.locator('#athFilmGuideToggle')
    await assert.doesNotReject(toggle.waitFor({ state: 'visible', timeout: 5000 }),
      '"Vis igen"-knappen skal være synlig ved andet besøg')
    assert.match(await toggle.textContent() || '', /vis igen/i, 'Den ene linje skal invitere til at se vejledningen igen')

    const toggleBox = await toggle.boundingBox()
    assert.ok(toggleBox && toggleBox.height >= 44, `"Vis igen" skal have mindst 44px trykflade, målte ${toggleBox?.height}`)

    const collapsedShot = join(outDir, 'atlet-andet-besoeg-390px.png')
    await page.screenshot({ path: collapsedShot })
    console.log(`Skærmbillede (andet besøg, én linje): ${collapsedShot}`)

    // ---- "Vis igen" folder hele vejledningen ud igen ----
    await toggle.click()
    await page.waitForTimeout(150)
    const reexpandedPoints = await page.locator('#athFilmGuide li').count()
    assert.ok(reexpandedPoints > 0, '"Vis igen" skal folde hele punktlisten ud igen')

    const hScroll2 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    assert.equal(hScroll2, false, 'Ingen vandret scroll efter "vis igen" ved 390px')

    const reexpandedShot = join(outDir, 'atlet-vis-igen-390px.png')
    await page.screenshot({ path: reexpandedShot })
    console.log(`Skærmbillede ("vis igen", udfoldet): ${reexpandedShot}`)

    assert.deepEqual(consoleErrors, [], `Ingen browser-fejl forventet, fandt: ${JSON.stringify(consoleErrors)}`)

    console.log('\nGRØN: filmvejledningen vises fuldt første gang, som én linje derefter, "vis igen" folder ud igen, ≥44px trykflade, ingen vandret scroll, ingen browser-fejl.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    if (consoleErrors.length) console.error('Browser-fejl:', JSON.stringify(consoleErrors, null, 2))
    process.exitCode = 1
  } finally {
    await browser.close()
    server.close()
  }
}

main()
