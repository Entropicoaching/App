#!/usr/bin/env node
// ORDRE 228 · commit 1 — er de seks sekunder (docs/RAPPORT-226.md) ægte, eller
// et artefakt af at scripts/maal-kaeden.mjs' lokale statiske server sender
// UKOMPRIMEREDE bytes (ingen Content-Encoding), mens den RIGTIGE produktion
// (GitHub Pages, `162abc6`, jf. docs/VALG-226.md) typisk serverer gzip/brotli
// automatisk? Dette script afgør det med tal, ikke antagelse.
//
// To halvdele, samme metode (devtools-throttling, mobil 390×844, 5 løb,
// median — samme parametre som maal-kaeden.mjs):
//   1) LOKAL: bygger appen (mod en lokal mock-Supabase, samme mønster som
//      maal-kaeden.mjs), server den fra en lokal statisk server (bevidst
//      UKOMPRIMERET — samme server-kode som hele måleserien siden 123), og
//      måler login-skærmen (den ENESTE skærm der er nåelig uden ægte
//      produktions-legitimationsoplysninger — se grænsen i README nedenfor).
//   2) PRODUKTION: måler https://app.entropicoaching.dk/ direkte — samme
//      login-skærm, ægte netværksvej, ægte CDN-komprimering. INGEN login
//      forsøgt (ordrens grænse: ingen atletdata, ingen produktions-Supabase
//      ud over den læsning appen selv gør ved en almindelig sideindlæsning).
//
// Begge halvdele måler den SAMME skærm (login/landing), så komprimering er
// den primære forskel mellem dem — ikke skærmens indhold. De tre
// autentificerede skærme (Atletliste/Dagens pas/Check-in) kræver ægte
// produktions-login, som denne ordre ikke har legitimationsoplysninger til
// og ikke må omgå — se docs/VALG-228.md for den fulde begrundelse og hvordan
// tallene herfra bruges til at vurdere dem alligevel (samme hovedbundt,
// samme komprimeringsforhold).
//
// Kørsel: npm run maal:produktion
// Skriver: outputs/_seneste/maal-produktion/<dato>.json + skærmbilleder.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { harLeveranceFlag, opdaterLeverance } from './leverance-sti.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const distDir = path.join(repoRoot, 'dist')

const require = createRequire(import.meta.url)
const runtimeModules = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = require(path.join(runtimeModules, 'playwright'))
const { default: lighthouse } = await import('lighthouse')
const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
const { buildSeed } = await import('../e2e/fixtures.mjs')

const MOCK_PORT = Number(process.env.MAAL_PRODUKTION_MOCK_PORT || 8997)
const MOCK_KEY = 'mock-anon-key-maal-produktion-228'
const RUNS_PER_SIDE = 5
const PRODUKTION_URL = 'https://app.entropicoaching.dk/'

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

// Bevidst UKOMPRIMERET — samme mønster som startStaticServer() i
// maal-kaeden.mjs/maal-telefon.mjs/maal-coach-telefon.mjs/maal-app.mjs
// (docs/VALG-226.md), gentaget her fordi netop DEN skævhed er det denne
// måling skal gøre synlig, ikke skjule.
function startStaticServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    const filePath = path.join(distDir, urlPath === '/' ? '/index.html' : urlPath)
    if (!filePath.startsWith(distDir)) { res.writeHead(403); res.end(); return }
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    } catch { res.writeHead(404); res.end('not found') }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

function launchChrome() {
  const execPath = chromium.executablePath()
  return new Promise((resolve, reject) => {
    const proc = spawn(execPath, ['--headless=new', '--remote-debugging-port=0', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], { stdio: ['ignore', 'ignore', 'pipe'] })
    let buf = ''
    const timer = setTimeout(() => reject(new Error('Chrome åbnede ikke en devtools-port i tide')), 15000)
    proc.stderr.on('data', (chunk) => {
      buf += chunk.toString()
      const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)
      if (m) { clearTimeout(timer); resolve({ proc, port: Number(m[1]) }) }
    })
    proc.once('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Samme throttlingMethod: 'devtools' som maal-kaeden.mjs (226) — reel
// CDP-nedsættelse under selve løbet, ikke Lighthouses simulate-model.
//
// Hver af de 5 løb får sin EGEN Chrome-proces (ikke genbrug af én browser
// på tværs af løb, sådan som maal-kaeden.mjs gør for authed skærme). Fundet
// undervejs her: mod ægte produktion gav genbrugt browser/cache 0B "over
// ledningen" i 4 af 5 løb (HTTP-cachen overlevede Lighthouses egen
// storage-reset) — et FALSKT billede af "ægte TTI" (cache-hjulpet, ikke et
// koldt besøg). Frisk proces pr. løb garanterer koldt cache hver gang, for
// begge sider (lokal og produktion), så sammenligningen er ærlig.
async function measureOnce(url) {
  const { proc: chromeProc, port: cdpPort } = await launchChrome()
  const result = await lighthouse(url, {
    port: cdpPort, output: 'json', logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    throttlingMethod: 'devtools',
  })
  chromeProc.kill()
  const audits = result.lhr.audits
  const ttiMs = audits['interactive']?.numericValue ?? null
  const requests = audits['network-requests']?.details?.items || []
  const mainScript = requests
    .filter((r) => /\.js(\?|$)/.test(r.url || '') && !/^data:/.test(r.url || ''))
    .sort((a, b) => (b.transferSize ?? 0) - (a.transferSize ?? 0))[0] || null
  return {
    fcpMs: audits['first-contentful-paint']?.numericValue ?? null,
    ttiMs,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    requestCount: requests.length,
    perfScore: result.lhr.categories.performance ? Math.round(result.lhr.categories.performance.score * 100) : null,
    mainScript: mainScript ? { url: mainScript.url, transferSize: mainScript.transferSize ?? null, resourceSize: mainScript.resourceSize ?? null } : null,
  }
}

async function measureSide(label, url, outDir, fileId) {
  process.stdout.write(`  ${label} (${RUNS_PER_SIDE} løb, devtools-throttling, frisk browser pr. løb) ... `)
  const runs = []
  for (let i = 0; i < RUNS_PER_SIDE; i++) runs.push(await measureOnce(url))
  const m = {
    fcpMs: median(runs.map((r) => r.fcpMs)),
    ttiMs: median(runs.map((r) => r.ttiMs)),
    cls: median(runs.map((r) => r.cls)),
    requestCount: Math.round(median(runs.map((r) => r.requestCount))),
    perfScore: Math.round(median(runs.map((r) => r.perfScore))),
  }
  // Hovedbundtets transfer-/resource-størrelse: median pr. felt over de 5 løb
  // (samme script-fil hver gang, så variansen bør være støj alene).
  const mainScriptRuns = runs.map((r) => r.mainScript).filter(Boolean)
  const mainScript = mainScriptRuns.length ? {
    url: mainScriptRuns[0].url,
    transferSize: Math.round(median(mainScriptRuns.map((r) => r.transferSize ?? 0))),
    resourceSize: Math.round(median(mainScriptRuns.map((r) => r.resourceSize ?? 0))),
  } : null

  const { proc: shotChromeProc, port: shotCdpPort } = await launchChrome()
  const shotBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${shotCdpPort}`)
  const [defaultContext] = shotBrowser.contexts()
  const page = await defaultContext.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(outDir, `${fileId}.png`), fullPage: true })
  await shotBrowser.close()
  shotChromeProc.kill()

  console.log(`FCP ${Math.round(m.fcpMs)}ms · TTI ${Math.round(m.ttiMs)}ms · CLS ${m.cls.toFixed(3)} · ${m.requestCount} kald · perf ${m.perfScore}`)
  if (mainScript) {
    const ratio = mainScript.resourceSize ? (mainScript.transferSize / mainScript.resourceSize) : null
    console.log(`    hovedscript: ${mainScript.url.split('/').pop()} — ${mainScript.transferSize}B over ledningen / ${mainScript.resourceSize}B afkodet${ratio != null ? ` (${(ratio * 100).toFixed(0)}% af rå størrelse)` : ''}`)
  }
  return { label, kind: 'ægte (ingen session, login-skærm)', ...m, mainScript, runs }
}

// Direkte HTTP-hovedtjek (browserens Accept-Encoding, ikke curl's standard —
// ellers rapporterer man fejlagtigt "ingen komprimering", se docs/VALG-228.md)
// af produktionens hovedscript — uafhængigt bevis ved siden af Lighthouses
// egne transferSize/resourceSize-tal ovenfor.
async function fetchProduktionHeaders(scriptUrl) {
  const res = await fetch(scriptUrl, { headers: { 'Accept-Encoding': 'gzip, deflate, br' } })
  await res.arrayBuffer()
  return {
    url: scriptUrl,
    status: res.status,
    contentEncoding: res.headers.get('content-encoding'),
    contentLength: res.headers.get('content-length'),
  }
}

async function main() {
  const dato = new Date().toISOString().slice(0, 10)
  const outDir = path.join(repoRoot, 'outputs', '_seneste', 'maal-produktion', dato)
  mkdirSync(outDir, { recursive: true })

  console.log('=== LOKAL: login-skærm, mod mock, ukomprimeret statisk server ===')
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  console.log(`Bygger appen mod mocken (npm run build)...`)
  const build = spawnSync('npm run build', {
    cwd: repoRoot, stdio: 'inherit', shell: true,
    env: { ...process.env, VITE_SUPABASE_URL: mockUrl, VITE_SUPABASE_KEY: MOCK_KEY },
  })
  if (build.status !== 0) { await mock.close(); throw new Error('Build fejlede.') }

  const { server, port: serverPort } = await startStaticServer()
  const localOrigin = `http://127.0.0.1:${serverPort}`

  let localResult, prodResult, prodHeaders
  try {
    localResult = await measureSide('Login-skærm (lokal, ukomprimeret)', localOrigin, outDir, 'lokal')

    console.log('\n=== PRODUKTION: samme login-skærm, ægte netværk+CDN ===')
    prodResult = await measureSide('Login-skærm (produktion, ægte)', PRODUKTION_URL, outDir, 'produktion')

    if (prodResult.mainScript) {
      console.log('\n=== Direkte header-tjek af produktionens hovedscript ===')
      prodHeaders = await fetchProduktionHeaders(prodResult.mainScript.url)
      console.log(`  ${prodHeaders.url}`)
      console.log(`  status ${prodHeaders.status} · content-encoding: ${prodHeaders.contentEncoding ?? '(ingen)'} · content-length: ${prodHeaders.contentLength ?? '?'}B`)
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await mock.close()
  }

  const out = { dato, local: localResult, produktion: prodResult, produktionHeaders: prodHeaders }
  const outFile = path.join(outDir, '..', `${dato}.json`)
  writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8')

  console.log('\n| Måling | TTI | FCP | Hovedscript over ledningen | Hovedscript afkodet |')
  console.log('| --- | --- | --- | --- | --- |')
  for (const [navn, r] of [['Lokal (ukomprimeret)', localResult], ['Produktion (ægte)', prodResult]]) {
    const ms = r.mainScript
    console.log(`| ${navn} | ${Math.round(r.ttiMs)}ms | ${Math.round(r.fcpMs)}ms | ${ms ? ms.transferSize + 'B' : 'n/a'} | ${ms ? ms.resourceSize + 'B' : 'n/a'} |`)
  }
  console.log(`\nSkrevet: outputs/_seneste/maal-produktion/${dato}.json + skærmbilleder i outputs/_seneste/maal-produktion/${dato}/`)

  if (harLeveranceFlag()) {
    opdaterLeverance(outDir, path.join(repoRoot, 'outputs', 'maal-produktion', dato))
    opdaterLeverance(outFile, path.join(repoRoot, 'outputs', 'maal-produktion', `${dato}.json`))
    console.log(`Leverancebilleder opdateret: outputs/maal-produktion/${dato}/ + outputs/maal-produktion/${dato}.json`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
