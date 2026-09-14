#!/usr/bin/env node
// ORDRE 173 — mål de fem skærme atleten faktisk bruger gennem den RIGTIGE,
// autentificerede app (login → dagens pas/check-in → sæt-logger →
// videocoach-forside), mod e2e/mock-supabase.mjs (ordre 153/155) som
// backend — i stedet for de tre isolerede harnesses
// `scripts/maal-atlet-telefon.mjs` (ordre 167) målte i, fordi AthleteView.jsx
// dengang ikke kunne boote uden en levende Supabase-session og ordren
// forbød produktions-Supabase. Mocken løser netop det: en levende session,
// ingen produktionskald, ingen atletdata.
//
// METODE (samme som ordre 167, genbrugt uændret hvor det giver mening):
// Lighthouse mobilprofil (390px, 4x CPU-nedsættelse + langsomt netværk),
// 3 løb pr. skærm, medianen brugt. Fire tal pr. fuld-navigations-skærm:
// FCP, TTI, CLS, netværkskald før TTI, plus Lighthouses perf-score.
//
// TILPASSET (valg noteret her, jf. "vælg det mest fornuftige"):
//   - Login og Videocoach-forside måles UÆNDRET (samme metode som 167) —
//     de kræver ingen session.
//   - Dagens pas og Check-in er i den ÆGTE app SAMME skærm (samme faneblad,
//     "hjem" — se src/AthleteView.jsx linje ~3993-4200: sessionskortet og
//     parathedskortet renderes side om side i samme DOM, ikke to separate
//     visninger som de to isolerede harnesses i ordre 167 lod tro). Begge
//     måles derfor uafhængigt (egne 3 løb) på samme URL efter login — de
//     bekræfter statistisk at det er ét og samme tal, hvilket ER fundet:
//     167s to separate 100-tal for "to skærme" var i virkeligheden ét tal
//     for én skærm.
//   - Sæt-logger nås i den ægte app KUN via et klientside faneskift (intet
//     eget URL/genindlæsning gengiver den — AthleteView.jsx har ingen
//     URL-baseret routing), så en kold Lighthouse-navigation kan ikke måle
//     den. Målt i stedet som en klik→synlig-overgang under IDENTISK CDP-
//     emulering (samme 390×844/DSF2/mobil-UA som Lighthouses skærmprofil,
//     samme 4x CPU + "langsomt 4G"-netværk som Lighthouses egne
//     mobil-standardværdier, se lighthouse-core/config/constants.js) —
//     ærligt mærket som "renderMs" i stedet for en opdigtet TTI/perf-score.
//   - Autentificering: Chrome startes med et rå CDP-devtools-port (samme
//     teknik som scripts/maal-atlet-telefon.mjs), og BÅDE Playwrights
//     interaktive login-side OG Lighthouses egne målefaner holdes i browserens
//     STANDARD-context (browser.contexts()[0], ALDRIG browser.newContext()/
//     newPage() som opretter en isoleret, ny context) — så Supabase-sessionen
//     (persisteret i localStorage af src/supabase.js's persistSession:true)
//     er synlig for Lighthouses egne, rå CDP-oprettede faner. Dette er samme
//     "log ind i samme Chrome-profil, kør så Lighthouse mod samme port"-
//     teknik Lighthouse-projektet selv anbefaler til autentificerede sider.
//   - Lighthouses autentificerede løb kører med disableStorageReset:true
//     (ellers rydder Lighthouse localStorage/cookies FØR hvert løb og
//     sessionen forsvinder efter første måling). ÆRLIG PRIS: det betyder
//     også at browser-cache ikke ryddes mellem de tre løb for disse skærme —
//     lidt for optimistisk sammenlignet med et koldt asset-cache, nævnt her
//     i stedet for skjult.
//
// Kørsel: npm run maal:telefon [label]
// Skriver: outputs/maal/<dato>[--<label>].json + skærmbilleder
// outputs/maal/<dato>[--<label>]/<id>.png + en kort tabel i terminalen.
// DÆKKER IKKE: rigtig Supabase (mock), rigtig netværksvej (localhost), rigtige
// atletdata (syntetisk testatlet, se e2e/fixtures.mjs).

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const distDir = path.join(repoRoot, 'dist')

const require = createRequire(import.meta.url)
const runtimeModules = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = require(path.join(runtimeModules, 'playwright'))
const { default: lighthouse } = await import('lighthouse')
const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
const { buildSeed, ATHLETE_USER } = await import('../e2e/fixtures.mjs')

const MOCK_PORT = Number(process.env.MAAL_MOCK_PORT || 8993)
const MOCK_KEY = 'mock-anon-key-maal-telefon-173'
const RUNS_PER_SCREEN = 3
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
// Lighthouses egne "mobile"-standardværdier (lighthouse-core/config/constants.js):
// RTT 150ms, ~1.6Mbps download, 750kbps upload, 4x CPU-nedsættelse.
const THROTTLE = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpuRate: 4 }

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function verdict(m) {
  const fcpOk = m.fcpMs != null && m.fcpMs < 2500
  const ttiOk = m.ttiMs != null && m.ttiMs < 4000
  const clsOk = m.cls != null && m.cls < 0.1
  if (fcpOk && ttiOk && clsOk) return 'Føles som en app'
  if (!fcpOk && !ttiOk) return 'Føles som en hjemmeside der loader'
  return 'Midt imellem — noget er hurtigt, noget hænger'
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

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

async function measureOnce(url, cdpPort, extraFlags) {
  const result = await lighthouse(url, {
    port: cdpPort, output: 'json', logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    ...extraFlags,
  })
  const audits = result.lhr.audits
  const ttiMs = audits['interactive']?.numericValue ?? null
  const requests = audits['network-requests']?.details?.items || []
  const requestsBeforeUsable = ttiMs != null ? requests.filter((r) => (r.startTime ?? 0) <= ttiMs).length : requests.length
  return {
    fcpMs: audits['first-contentful-paint']?.numericValue ?? null,
    ttiMs,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    requestsBeforeUsable,
    perfScore: result.lhr.categories.performance ? Math.round(result.lhr.categories.performance.score * 100) : null,
  }
}

// Fuld-navigations-skærm (Login, Videocoach-forside — ingen session nødvendig;
// Dagens pas/Check-in — session allerede sat i browserens standard-context).
async function measureNavigationScreen(label, url, cdpPort, browser, outDir, id, { authed = false } = {}) {
  process.stdout.write(`${label} (${RUNS_PER_SCREEN} løb) ... `)
  const runs = []
  for (let i = 0; i < RUNS_PER_SCREEN; i++) {
    runs.push(await measureOnce(url, cdpPort, authed ? { disableStorageReset: true } : {}))
  }
  const m = {
    fcpMs: median(runs.map((r) => r.fcpMs)),
    ttiMs: median(runs.map((r) => r.ttiMs)),
    cls: median(runs.map((r) => r.cls)),
    requestsBeforeUsable: Math.round(median(runs.map((r) => r.requestsBeforeUsable))),
    perfScore: Math.round(median(runs.map((r) => r.perfScore))),
  }
  m.dom = verdict(m)

  const [defaultContext] = browser.contexts()
  const page = await defaultContext.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(outDir, `${id}.png`), fullPage: true })
  await page.close()

  console.log(`FCP ${Math.round(m.fcpMs)}ms · TTI ${Math.round(m.ttiMs)}ms · CLS ${m.cls.toFixed(3)} · ${m.requestsBeforeUsable} kald · perf ${m.perfScore} · "${m.dom}"`)
  return { id, label, kind: authed ? 'ægte (autentificeret)' : 'ægte (ingen session)', ...m, runs }
}

async function loginAsTestatlet(browser, origin) {
  const [defaultContext] = browser.contexts()
  const page = await defaultContext.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Mit program').waitFor({ state: 'visible', timeout: 15000 })
  await page.close()
}

// Sæt-logger: intet eget URL i den ægte app (klientside faneskift, se
// kommentaren øverst) — målt som klik→synlig-overgang under Lighthouses egne
// throttling-tal, i browserens standard-context (samme session som ovenfor).
async function measureSaetLoggerTransition(browser, origin, outDir) {
  process.stdout.write(`Sæt-logger (${RUNS_PER_SCREEN} løb, klik→synlig) ... `)
  const [defaultContext] = browser.contexts()
  const runs = []
  let firstShotTaken = false
  for (let i = 0; i < RUNS_PER_SCREEN; i++) {
    const page = await defaultContext.newPage()
    const client = await defaultContext.newCDPSession(page)
    await client.send('Network.enable')
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 })
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await client.send('Network.setUserAgentOverride', { userAgent: MOBILE_UA })
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: THROTTLE.latency, downloadThroughput: THROTTLE.downloadThroughput, uploadThroughput: THROTTLE.uploadThroughput })
    await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpuRate })

    await page.addInitScript(() => {
      window.__cls = 0
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
        }).observe({ type: 'layout-shift', buffered: true })
      } catch { /* layout-shift ikke understøttet — cls forbliver 0 */ }
    })

    await page.goto(origin, { waitUntil: 'networkidle', timeout: 60000 })
    await page.getByText('Mit program').waitFor({ state: 'visible', timeout: 30000 })

    let reqCount = 0
    const onReq = () => { reqCount++ }
    client.on('Network.requestWillBeSent', onReq)
    const clsBefore = await page.evaluate(() => window.__cls || 0)
    const t0 = Date.now()
    await page.getByText('Dag 1 — Squat').click()
    await page.getByText('Opvarmningssæt', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
    const t1 = Date.now()
    const clsAfter = await page.evaluate(() => window.__cls || 0)
    client.off('Network.requestWillBeSent', onReq)

    if (!firstShotTaken) {
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(outDir, 'saet-logger.png'), fullPage: true })
      firstShotTaken = true
    }

    runs.push({ renderMs: t1 - t0, cls: +(clsAfter - clsBefore).toFixed(4), requests: reqCount })
    await client.detach().catch(() => {})
    await page.close()
  }
  const m = {
    renderMs: Math.round(median(runs.map((r) => r.renderMs))),
    cls: +median(runs.map((r) => r.cls)).toFixed(4),
    requestsBeforeUsable: Math.round(median(runs.map((r) => r.requests))),
    fcpMs: null,
    ttiMs: null,
    perfScore: null,
  }
  m.dom = m.renderMs < 1000 ? 'Føles som en app' : m.renderMs < 2500 ? 'Midt imellem — noget er hurtigt, noget hænger' : 'Føles som en hjemmeside der loader'
  console.log(`renderMs ${m.renderMs}ms · CLS ${m.cls.toFixed(3)} · ${m.requestsBeforeUsable} kald · "${m.dom}" (ingen fuld Lighthouse-navigation muligt — se kommentar øverst)`)
  return { id: 'saet-logger', label: 'Sæt-logger', kind: 'ægte (autentificeret, klik→synlig-overgang)', ...m, runs }
}

async function main() {
  const label = process.argv[2] || null
  const dato = new Date().toISOString().slice(0, 10)
  const outName = label ? `${dato}--${label}` : dato
  const outDir = path.join(repoRoot, 'outputs', 'maal', outName)
  mkdirSync(outDir, { recursive: true })

  console.log(`Starter mocken på 127.0.0.1:${MOCK_PORT}...`)
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`

  console.log('Bygger appen mod mocken (npm run build)...')
  const build = spawnSync('npm run build', {
    cwd: repoRoot, stdio: 'inherit', shell: true,
    env: { ...process.env, VITE_SUPABASE_URL: mockUrl, VITE_SUPABASE_KEY: MOCK_KEY },
  })
  if (build.status !== 0) { console.error('Build fejlede.'); await mock.close(); process.exit(1) }

  const { server, port: serverPort } = await startStaticServer()
  const origin = `http://127.0.0.1:${serverPort}`
  const { proc: chromeProc, port: cdpPort } = await launchChrome()
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)

  const rows = []
  try {
    // Uden session — samme metode/tal-type som ordre 167.
    rows.push(await measureNavigationScreen('Login', `${origin}/`, cdpPort, browser, outDir, 'login', { authed: false }))
    rows.push(await measureNavigationScreen('Videocoach-forside', `${origin}/videocoach.html`, cdpPort, browser, outDir, 'videocoach-forside', { authed: false }))

    console.log('Logger ind som testatlet mod mocken...')
    await loginAsTestatlet(browser, origin)

    // Med session — den ægte, autentificerede AthleteView, ikke en harness.
    rows.push(await measureNavigationScreen('Dagens pas', `${origin}/`, cdpPort, browser, outDir, 'dagens-pas', { authed: true }))
    rows.push(await measureNavigationScreen('Check-in (parathed)', `${origin}/`, cdpPort, browser, outDir, 'check-in', { authed: true }))
    rows.push(await measureSaetLoggerTransition(browser, origin, outDir))
  } finally {
    await browser.close()
    chromeProc.kill()
    await new Promise((resolve) => server.close(resolve))
    await mock.close()
  }

  writeFileSync(path.join(outDir, '..', `${outName}.json`), JSON.stringify(rows, null, 2), 'utf8')

  console.log('\n| Skærm | FCP | TTI | CLS | Netværkskald | Perf-score | Dom |')
  console.log('| --- | --- | --- | --- | --- | --- | --- |')
  for (const r of rows) {
    const fcp = r.fcpMs != null ? `${Math.round(r.fcpMs)}ms` : 'n/a'
    const tti = r.ttiMs != null ? `${Math.round(r.ttiMs)}ms` : (r.renderMs != null ? `${r.renderMs}ms (renderMs)` : 'n/a')
    const perf = r.perfScore != null ? String(r.perfScore) : 'n/a'
    console.log(`| ${r.label} | ${fcp} | ${tti} | ${r.cls.toFixed(3)} | ${r.requestsBeforeUsable} | ${perf} | ${r.dom} |`)
  }
  console.log(`\nSkrevet: outputs/maal/${outName}.json + skærmbilleder i outputs/maal/${outName}/`)
}

main().catch((err) => { console.error(err); process.exit(1) })
