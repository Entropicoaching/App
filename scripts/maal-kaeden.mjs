#!/usr/bin/env node
// ORDRE 226 · commit 1 — 201's tre skærme igen, denne gang med Lighthouses
// EGEN 'devtools'-throttlingmetode (reel CDP-nedsættelse under selve
// målingen) i stedet for standard 'simulate' (en model bygget på en
// uthrottlet afhængighedsgraf) — se docs/RAPPORT-201.md "Hvad er næste"
// punkt 2 for mistanken der begrundede dette forsøg. Ingen anden ændring:
// samme tre skærme (Atletliste for coach, Dagens pas + Check-in for atlet),
// samme telefonprofil 390×844, samme mock-metode og fixtures som
// scripts/maal-coach-telefon.mjs (ordre 175) og scripts/maal-telefon.mjs
// (ordre 173) allerede bruger — uændrede, ikke rørt af denne ordre.
//
// ÉT script, én kommando (ordrens krav): kører coachens login+måling først,
// derefter (ny build, ny mock — se hvorfor i main()) atletens login+måling,
// og skriver begge tal side om side med 201's egne EFTER-tal (den nuværende
// main, siden 201's rettelse allerede er merget) i både JSON og den
// afsluttende tabel — så alle senere greb i denne ordre måles med samme
// metode fra samme udgangspunkt.
//
// Infrastruktur (statisk server, Chrome-opstart, seed) bevidst KOPIERET fra
// maal-coach-telefon.mjs/maal-telefon.mjs, ikke importeret — samme
// begrundelse de selv giver: ordren forbyder at røre trackerens/coachens
// egne målescripts, og npm run maal:coach-telefon / maal:telefon skal
// forblive uændret grønne.
//
// Kørsel: npm run maal:kaeden [label]
// Skriver: outputs/_seneste/maal-kaeden/<dato>[--<label>].json + skærmbilleder.
// DÆKKER IKKE: rigtig Supabase (mock), rigtig netværksvej (localhost),
// rigtige atletdata (attrap-atleter/testatlet, se fixtures nedenfor).

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { harLeveranceFlag, argvUdenLeveranceFlag, opdaterLeverance } from './leverance-sti.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const distDir = path.join(repoRoot, 'dist')

const require = createRequire(import.meta.url)
const runtimeModules = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = require(path.join(runtimeModules, 'playwright'))
const { default: lighthouse } = await import('lighthouse')
const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
const { buildSeed, COACH_USER, ATHLETE_USER } = await import('../e2e/fixtures.mjs')

const MOCK_PORT = Number(process.env.MAAL_KAEDEN_MOCK_PORT || 8996)
const MOCK_KEY = 'mock-anon-key-maal-kaeden-226'
const RUNS_PER_SCREEN = 5
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

// 201's egne EFTER-tal (simulate-throttling, main som den står nu — 201's
// rettelse er allerede merget), til side-om-side-sammenligning. Kilde:
// docs/RAPPORT-201.md's tabel.
const BASELINE_201 = { atletliste: 5994, 'dagens-pas': 6139, 'check-in': 5991 }

// Samme 43 attrap-navne som maal-coach-telefon.mjs (ordre 175) bruger til at
// gøre atletlisten realistisk tung — kopieret, ikke importeret (se
// kommentaren øverst).
const PLACEHOLDER_NAMES = [
  'Anna Berg', 'Mikkel Holm', 'Sara Lund', 'Jonas Krogh', 'Ida Vestergaard', 'Peter Falk',
  'Nanna Ross', 'Kasper Dam', 'Freja Skov', 'Thomas Riis', 'Emma Kjær', 'Oliver Nyholm',
  'Signe Aabel', 'Rasmus Toft', 'Clara Munk', 'Victor Brix', 'Maja Sørensen', 'Anton Lindgren',
  'Sofie Dalgaard', 'William Kruse', 'Alma Refsgaard', 'Frederik Bank', 'Josefine Overgaard',
  'Christian Skaarup', 'Karla Vium', 'Magnus Hein', 'Liva Astrup', 'Emil Bruun', 'Agnes Holt',
  'Oscar Fabricius', 'Ella Winther', 'Noah Kjeldsen', 'Vera Lyngby', 'Malthe Egede', 'Naja Dahl',
  'Storm Bjerre', 'Thea Roswall', 'Villads Munch', 'Clara Vestergaard', 'Aksel Boe', 'Mille Skov',
  'Valdemar Riis', 'Nora Falkenberg', 'Bertram Ege',
]

function buildRichCoachSeed() {
  const base = buildSeed({ withLogs: true, withAnalyzedVideo: true })
  const now = new Date().toISOString()
  const statuses = ['active', 'peaking', 'offseason', 'ferie']
  const placeholders = PLACEHOLDER_NAMES.map((name, i) => ({
    id: `99999999-9999-4999-8999-${String(i + 1).padStart(12, '0')}`,
    user_id: null,
    name: `Ø ${name}`,
    email: null,
    status: statuses[i % statuses.length],
    hidden: false,
    snooze_until: null,
    competition_date: null,
    onboarding_completed_at: now,
    last_seen: new Date(Date.now() - (i % 10) * 86400000).toISOString(),
  }))
  base.tables.athletes = [...base.tables.athletes, ...placeholders]
  return base
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

// throttlingMethod: 'devtools' — reel CDP-nedsættelse under selve løbet, i
// stedet for Lighthouses standard 'simulate' (en tidsmodel bygget på en
// UTHROTTLET afhængighedsgraf). Ellers uændret metode/tal fra 173/175:
// Lighthouses egne mobileSlow4G-standardværdier (150ms RTT, ~1,6Mbps ned,
// 4x CPU), som Lighthouse selv sætter via CDP når throttlingMethod er
// 'devtools' — ingen grund til at duplikere de tal her.
async function measureOnce(url, cdpPort, extraFlags) {
  const result = await lighthouse(url, {
    port: cdpPort, output: 'json', logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    throttlingMethod: 'devtools',
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

async function measureNavigationScreen(id, label, url, cdpPort, browser, outDir, { authed = false } = {}) {
  process.stdout.write(`  ${label} (${RUNS_PER_SCREEN} løb, devtools-throttling) ... `)
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

  const baseline = BASELINE_201[id]
  const diff = baseline != null ? `${Math.round(m.ttiMs) - baseline >= 0 ? '+' : ''}${Math.round(m.ttiMs) - baseline}ms vs. 201` : ''
  console.log(`FCP ${Math.round(m.fcpMs)}ms · TTI ${Math.round(m.ttiMs)}ms · CLS ${m.cls.toFixed(3)} · ${m.requestsBeforeUsable} kald · perf ${m.perfScore} · "${m.dom}" (${diff})`)
  return { id, label, kind: authed ? 'ægte (autentificeret)' : 'ægte (ingen session)', baseline201Tti: baseline ?? null, ...m, runs }
}

async function loginAsCoach(browser, origin) {
  const [defaultContext] = browser.contexts()
  const page = await defaultContext.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 15000 })
  await page.close()
}

async function loginAsAthlete(browser, origin) {
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

// Én "runde": start mock, byg mod den, mål, luk alt ned igen. Coach og atlet
// kører hver sin runde, fordi VITE_SUPABASE_URL bages ind ved build-tid —
// samme grund til at 173/175 hver bygger sin egen dist/.
async function runRound({ seed, mockKeySuffix, login, screens }, outDir) {
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  console.log(`Bygger appen mod mocken (npm run build, ${mockKeySuffix})...`)
  const build = spawnSync('npm run build', {
    cwd: repoRoot, stdio: 'inherit', shell: true,
    env: { ...process.env, VITE_SUPABASE_URL: mockUrl, VITE_SUPABASE_KEY: `${MOCK_KEY}-${mockKeySuffix}` },
  })
  if (build.status !== 0) { await mock.close(); throw new Error('Build fejlede.') }

  const { server, port: serverPort } = await startStaticServer()
  const origin = `http://127.0.0.1:${serverPort}`
  const { proc: chromeProc, port: cdpPort } = await launchChrome()
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)

  const rows = []
  try {
    await login(browser, origin)
    for (const s of screens) {
      rows.push(await measureNavigationScreen(s.id, s.label, `${origin}${s.path}`, cdpPort, browser, outDir, { authed: true }))
    }
  } finally {
    await browser.close()
    chromeProc.kill()
    await new Promise((resolve) => server.close(resolve))
    await mock.close()
  }
  return rows
}

async function main() {
  const label = argvUdenLeveranceFlag(process.argv)[2] || null
  const dato = new Date().toISOString().slice(0, 10)
  const outName = label ? `${dato}--${label}` : dato
  const outDir = path.join(repoRoot, 'outputs', '_seneste', 'maal-kaeden', outName)
  mkdirSync(outDir, { recursive: true })

  console.log('=== Coach: Atletliste ===')
  const coachRows = await runRound({
    seed: buildRichCoachSeed(),
    mockKeySuffix: 'coach',
    login: loginAsCoach,
    screens: [{ id: 'atletliste', label: 'Atletliste (coach)', path: '/' }],
  }, outDir)

  console.log('\n=== Atlet: Dagens pas + Check-in ===')
  const athleteRows = await runRound({
    seed: buildSeed({ withLogs: true }),
    mockKeySuffix: 'atlet',
    login: loginAsAthlete,
    screens: [
      { id: 'dagens-pas', label: 'Dagens pas (atlet)', path: '/' },
      { id: 'check-in', label: 'Check-in (atlet)', path: '/' },
    ],
  }, outDir)

  const rows = [...coachRows, ...athleteRows]
  writeFileSync(path.join(outDir, '..', `${outName}.json`), JSON.stringify(rows, null, 2), 'utf8')

  console.log('\n| Skærm | TTI (devtools) | TTI 201 (simulate, EFTER) | Diff | Dom |')
  console.log('| --- | --- | --- | --- | --- |')
  for (const r of rows) {
    const diff = r.baseline201Tti != null ? `${Math.round(r.ttiMs) - r.baseline201Tti >= 0 ? '+' : ''}${Math.round(r.ttiMs) - r.baseline201Tti}ms` : 'n/a'
    console.log(`| ${r.label} | ${Math.round(r.ttiMs)}ms | ${r.baseline201Tti ?? 'n/a'}ms | ${diff} | ${r.dom} |`)
  }
  console.log(`\nSkrevet: outputs/_seneste/maal-kaeden/${outName}.json + skærmbilleder i outputs/_seneste/maal-kaeden/${outName}/`)

  if (harLeveranceFlag()) {
    opdaterLeverance(outDir, path.join(repoRoot, 'outputs', 'maal-kaeden', outName))
    opdaterLeverance(path.join(outDir, '..', `${outName}.json`), path.join(repoRoot, 'outputs', 'maal-kaeden', `${outName}.json`))
    console.log(`Leverancebilleder opdateret: outputs/maal-kaeden/${outName}/ + outputs/maal-kaeden/${outName}.json`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
