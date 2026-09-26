// ORDRE 387: hvor hurtigt ser atleten Dagens pas på telefonen?
//
// Bygger appen (npm run build) mod e2e-mocken (e2e/mock-supabase.mjs +
// e2e/fixtures.mjs's buildSeed, samme mock som verify-/e2e-scripts og
// scripts/maal-telefon.mjs), serverer dist/ lokalt og måler headless i
// Chromium på 390x844 (DSF 2, mobil, touch) med netværks- og CPU-drosling
// via DevTools-protokollen. Ingen atletdata: kun seedens syntetiske testatlet.
//
// Profiler (tal skrevet ud, så de kan genskabes uden at kende en bestemt
// Chrome-versions forudindstillinger):
//   fast3g: DevTools' klassiske "Fast 3G": 562,5 ms RTT, 1,44 Mbit/s ned,
//           675 kbit/s op.
//   slow4g: Lighthouses mobilprofil ("Slow 4G"): 150 ms RTT, 1,6 Mbit/s ned,
//           750 kbit/s op.
//   Begge med 4x CPU-nedsættelse (Lighthouses mobilstandard).
//
// Hver kørsel: ny browser-context (kold HTTP-cache) med den loggede-ind
// atlets localStorage (Supabase-session + rollehukommelse), præcis som når en
// atlet åbner appen igen fra hjemmeskærmen med tom cache. Tre kørsler pr.
// profil, medianen rapporteres.
//
// Tal pr. kørsel (alle i ms fra navigationens start, performance.now()):
//   forsideMs:  første frame hvor "Dagens pas" står synligt på skærmen.
//   interaktivMs: Lighthouse-lignende TTI: det første tidspunkt >= forsideMs
//               hvorefter der går 5 s uden lange opgaver (>= 50 ms på
//               hovedtråden) og med højst 2 netværkskald i gang.
//   jsFoerForsideKB / jsFilerFoerForside: JavaScript der var hentet (over
//               nettet, komprimeret som serveret) da forsiden blev synlig.
//               Den lokale server gzipper ikke, så KB er rå byte; gzip-tallene
//               står i bundtlisten i samme JSON.
//
// Kørsel: node outputs/387/maal-start.mjs foer|efter  -> outputs/387/<fase>.json
// (sikkerhedslinen, koer-verify.mjs, skriver verify-<fase>.json).
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const FASE = process.argv[2]
if (!/^(foer|efter)[a-z0-9-]*$/.test(FASE || '')) { console.error('brug: foer|efter'); process.exit(2) }
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = path.join(HERE, '..', '..')
const DIST = path.join(ROOT, 'dist')
const RUNS = 3
const MOCK_PORT = Number(process.env.MAAL_MOCK_PORT || 8994)
const MOCK_KEY = 'mock-anon-key-maal-387'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const PROFILER = {
  fast3g: { latency: 562.5, downloadThroughput: (1.44 * 1000 * 1000) / 8, uploadThroughput: (675 * 1000) / 8, cpuRate: 4 },
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1000 * 1000) / 8, uploadThroughput: (750 * 1000) / 8, cpuRate: 4 },
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
function startStaticServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    const filePath = path.join(DIST, urlPath === '/' ? '/index.html' : urlPath)
    if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end(); return }
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'timing-allow-origin': '*' })
      res.end(data)
    } catch { res.writeHead(404); res.end('not found') }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

// Sættes før appens egen kode: lange opgaver, ressourcer og første frame med
// "Dagens pas" synligt (tjekket i hver animationsframe).
function initScript() {
  window.__m = { longtasks: [], forsideMs: null }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.longtasks.push([e.startTime, e.startTime + e.duration]) })
      .observe({ type: 'longtask', buffered: true })
  } catch { /* longtask ikke understøttet */ }
  const tjek = () => {
    if (window.__m.forsideMs != null) return
    const b = document.body
    if (b && b.innerText && b.innerText.toLowerCase().includes('dagens pas')) { window.__m.forsideMs = performance.now(); return }
    requestAnimationFrame(tjek)
  }
  requestAnimationFrame(tjek)
}

// TTI som Lighthouse: første t >= start hvor [t, t+5000] har ingen lang opgave
// og højst 2 kald i gang. Kandidaterne er start og hver lang opgaves slut.
function beregnTti(start, longtasks, requests) {
  const inFlight = (t) => requests.filter(([s, e]) => s <= t && e > t).length
  const kandidater = [start, ...longtasks.map(([, e]) => e).filter((e) => e > start), ...requests.map(([, e]) => e).filter((e) => e > start)].sort((a, b) => a - b)
  for (const t of kandidater) {
    const vindue = t + 5000
    if (longtasks.some(([s, e]) => e > t && s < vindue)) continue
    // Højst 2 i gang i hele vinduet: tjek ved hvert kalds start inden for vinduet.
    const punkter = [t, ...requests.map(([s]) => s).filter((s) => s > t && s < vindue)]
    if (punkter.every((p) => inFlight(p) <= 2)) return t
  }
  return null
}

async function logIndOgGemStorage(browser, origin, ATHLETE_USER) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(origin, { waitUntil: 'networkidle' })
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1500)
  const state = await context.storageState()
  await context.close()
  return state
}

async function maalEn(browser, origin, storageState, profil) {
  const context = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profil.latency, downloadThroughput: profil.downloadThroughput, uploadThroughput: profil.uploadThroughput })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profil.cpuRate })
  await page.addInitScript(initScript)
  // Netværkskald fra CDP (så også kald der stadig er i gang tælles med), omregnet
  // til sidens performance.now()-tid via navigationens CDP-tidsstempel.
  const reqs = new Map()
  let navTs = null
  cdp.on('Network.requestWillBeSent', (e) => {
    if (navTs == null && e.type === 'Document') navTs = e.timestamp
    reqs.set(e.requestId, { url: e.request.url, type: e.type, start: e.timestamp, end: null, bytes: 0 })
  })
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.end = e.timestamp; r.bytes = e.encodedDataLength } })
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) r.end = e.timestamp })

  await page.goto(origin, { waitUntil: 'commit', timeout: 120000 })
  try {
    await page.waitForFunction(() => window.__m && window.__m.forsideMs != null, null, { timeout: 120000, polling: 100 })
  } catch (err) {
    const tekst = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 400)).catch(() => '?')
    console.error('Forsiden kom ikke frem. Skaermtekst:', JSON.stringify(tekst))
    console.error('Kald uden svar:', [...reqs.values()].filter((r) => r.end == null).map((r) => r.url).join(' '))
    throw err
  }
  // Vent til der har været 5 s ro (ingen nye kald, ingen lange opgaver), maks 60 s.
  const t0 = Date.now()
  for (;;) {
    await page.waitForTimeout(500)
    const nu = await page.evaluate(() => performance.now())
    const lt = await page.evaluate(() => window.__m.longtasks)
    const sidsteLt = lt.length ? Math.max(...lt.map(([, e]) => e)) : 0
    const alleFaerdige = [...reqs.values()].every((r) => r.end != null)
    const sidsteReq = Math.max(...[...reqs.values()].map((r) => ((r.end ?? r.start) - navTs) * 1000))
    if (alleFaerdige && nu - Math.max(sidsteLt, sidsteReq) > 5500) break
    if (Date.now() - t0 > 60000) break
  }
  const m = await page.evaluate(() => window.__m)
  const tNu = await page.evaluate(() => performance.now())
  const requests = [...reqs.values()].map((r) => ({ ...r, s: (r.start - navTs) * 1000, e: r.end == null ? tNu : (r.end - navTs) * 1000 }))
  const tti = beregnTti(m.forsideMs, m.longtasks, requests.map((r) => [r.s, r.e]))
  const jsFoer = requests.filter((r) => /\.js$/.test(new URL(r.url).pathname) && r.e <= m.forsideMs)
  const jsAlle = requests.filter((r) => /\.js$/.test(new URL(r.url).pathname))
  const navn = (r) => path.basename(new URL(r.url).pathname).replace(/-[A-Za-z0-9_-]{8}\.js$/, '.js')
  await cdp.detach().catch(() => {})
  await context.close()
  return {
    forsideMs: Math.round(m.forsideMs),
    interaktivMs: tti == null ? null : Math.round(tti),
    jsFoerForsideKB: +(jsFoer.reduce((a, r) => a + r.bytes, 0) / 1000).toFixed(1),
    jsFilerFoerForside: jsFoer.map(navn).sort(),
    jsFilerIalt: jsAlle.map(navn).sort(),
    kaldFoerForside: requests.filter((r) => r.e <= m.forsideMs).length,
    langeOpgaverMs: Math.round(m.longtasks.reduce((a, [s, e]) => a + (e - s), 0)),
  }
}

async function main() {
  const { createRequire } = await import('node:module')
  const { homedir } = await import('node:os')
  const require = createRequire(import.meta.url)
  const { chromium } = require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const { buildSeed, ATHLETE_USER } = await import('../../e2e/fixtures.mjs')

  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  console.log('Bygger mod mocken ...')
  const build = spawnSync('npm run build', { cwd: ROOT, stdio: 'ignore', shell: true, env: { ...process.env, VITE_SUPABASE_URL: mockUrl, VITE_SUPABASE_KEY: MOCK_KEY } })
  if (build.status !== 0) { await mock.close(); throw new Error('build fejlede') }
  const bundt = readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js')).map((f) => {
    const buf = readFileSync(path.join(DIST, 'assets', f))
    return { fil: f.replace(/-[A-Za-z0-9_-]{8}\.js$/, '.js'), kB: +(buf.length / 1000).toFixed(2), gzipKB: +(gzipSync(buf).length / 1000).toFixed(2) }
  }).sort((a, b) => a.fil.localeCompare(b.fil))

  const { server, port } = await startStaticServer()
  const origin = `http://127.0.0.1:${port}/`
  const browser = await chromium.launch({ headless: true })
  const resultat = { fase: FASE, dato: new Date().toISOString().slice(0, 10), metode: 'se kommentaren øverst i outputs/387/maal-start.mjs', profiler: PROFILER, bundt, maalinger: {} }
  try {
    const storageState = await logIndOgGemStorage(browser, origin, ATHLETE_USER)
    for (const [navn, profil] of Object.entries(PROFILER)) {
      const koersler = []
      for (let i = 0; i < RUNS; i++) {
        const r = await maalEn(browser, origin, storageState, profil)
        console.log(`${navn} #${i + 1}: forside ${r.forsideMs} ms, interaktiv ${r.interaktivMs} ms, JS før forside ${r.jsFoerForsideKB} kB (${r.jsFilerFoerForside.join(', ')})`)
        koersler.push(r)
      }
      resultat.maalinger[navn] = {
        median: {
          forsideMs: median(koersler.map((k) => k.forsideMs)),
          interaktivMs: median(koersler.map((k) => k.interaktivMs ?? Infinity)),
          jsFoerForsideKB: median(koersler.map((k) => k.jsFoerForsideKB)),
          kaldFoerForside: median(koersler.map((k) => k.kaldFoerForside)),
        },
        koersler,
      }
    }
  } finally {
    await browser.close()
    await new Promise((r) => server.close(r))
    await mock.close()
  }
  writeFileSync(path.join(HERE, `${FASE}.json`), JSON.stringify(resultat, null, 2) + '\n')
  for (const [navn, v] of Object.entries(resultat.maalinger)) console.log(`${navn} median: forside ${v.median.forsideMs} ms · interaktiv ${v.median.interaktivMs} ms · JS før forside ${v.median.jsFoerForsideKB} kB`)
}

main().catch((err) => { console.error('FEJL:', err); process.exitCode = 1 })
