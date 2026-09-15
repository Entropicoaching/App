#!/usr/bin/env node
// ORDRE 231 · commit 1 — tegner kæden af Supabase-kald på de tre skærme
// (Atletliste for coach, Dagens pas + Check-in for atlet) som 228's commit 3
// fandt strækker sig til 6794ms på Atletliste, senere end det rapporterede
// TTI. INGEN adfærdsændring: dette script rører ikke appens kode, det lytter
// blot på request/response-events i Playwright mens den ÆGTE app (samme
// build/mock/login-infrastruktur som scripts/maal-kaeden.mjs, kopieret — ikke
// importeret, samme begrundelse som dér) kører sin normale opstart.
//
// Dagens pas og Check-in er samme URL og samme kodesti (AthleteView.jsx's
// fetchAthlete() ved mount) — begge fanget i ÉT spor pr. atlet-runde, ikke to.
//
// Output: docs/KAEDEN-231.md (tabel pr. skærm: kald, start-ms, varighed,
// hvad det ventede på) + samme data som JSON i
// outputs/_seneste/kaeden-tegn/<dato>.json.
//
// Kørsel: node scripts/kaeden-tegn.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const distDir = path.join(repoRoot, 'dist')

const require = createRequire(import.meta.url)
const runtimeModules = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = require(path.join(runtimeModules, 'playwright'))
const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
const { buildSeed, COACH_USER, ATHLETE_USER } = await import('../e2e/fixtures.mjs')

const MOCK_PORT = Number(process.env.KAEDEN_TEGN_MOCK_PORT || 8997)
const MOCK_KEY = 'mock-anon-key-kaeden-tegn-231'

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

// Sporer alle request/response-events på siden fra t0 (navigationens start),
// filtreret til Supabase-mockens egne kald (rest/v1, auth/v1, rpc). Returnerer
// en liste sorteret efter start-ms, hver med { method, kaldNavn, startMs, slutMs, varighedMs }.
function traceSupabaseCalls(page, mockOrigin, t0) {
  const inFlight = new Map()
  const done = []
  const relevant = (url) => url.startsWith(mockOrigin)
  const kaldNavn = (url) => {
    const u = new URL(url)
    const rel = u.pathname.replace(/^\/(rest|auth|rpc)\/v1\//, '')
    const filter = u.searchParams.toString()
    return filter ? `${rel}?${filter.slice(0, 60)}` : rel
  }
  page.on('request', (req) => {
    const url = req.url()
    if (!relevant(url)) return
    inFlight.set(req, { url, method: req.method(), startMs: Date.now() - t0 })
  })
  page.on('requestfinished', (req) => {
    const entry = inFlight.get(req)
    if (!entry) return
    inFlight.delete(req)
    const slutMs = Date.now() - t0
    done.push({ ...entry, kald: kaldNavn(entry.url), slutMs, varighedMs: slutMs - entry.startMs })
  })
  page.on('requestfailed', (req) => {
    const entry = inFlight.get(req)
    if (!entry) return
    inFlight.delete(req)
    const slutMs = Date.now() - t0
    done.push({ ...entry, kald: kaldNavn(entry.url), slutMs, varighedMs: slutMs - entry.startMs, fejlet: true })
  })
  return done
}

// "Hvad afhang det af": for hvert kald, se hvilke andre kald der var i gang
// (overlap) da det startede. Ingen overlap OG et gab > 20ms siden forrige
// kalds afslutning = ventede på det forrige (serialiseret). Overlap = kørte
// parallelt. Intet forudgående kald = uafhængigt (starter tidligt).
function annoterAfhaengighed(rows) {
  const sorted = [...rows].sort((a, b) => a.startMs - b.startMs)
  return sorted.map((r, i) => {
    const overlapping = sorted.filter((o, j) => j !== i && o.startMs < r.startMs && o.slutMs > r.startMs)
    if (overlapping.length) {
      return { ...r, afhaengerAf: `parallelt med ${overlapping.map(o => o.kald).join(', ')}` }
    }
    const preceding = sorted.filter((o, j) => j < i && o.slutMs <= r.startMs)
    if (!preceding.length) return { ...r, afhaengerAf: 'uafhængigt (starter tidligt)' }
    const last = preceding.reduce((a, b) => (a.slutMs > b.slutMs ? a : b))
    const gap = r.startMs - last.slutMs
    return { ...r, afhaengerAf: gap <= 20 ? `venter på "${last.kald}" (${gap}ms gab)` : `uafhængigt, men starter ${gap}ms efter "${last.kald}" sluttede` }
  })
}

async function runRound({ seed, mockKeySuffix, screenId, screenLabel, fillLogin, waitForReady }) {
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  console.log(`\n=== ${screenLabel} ===`)
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
  const [context] = browser.contexts()
  const page = await context.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  let rows = []
  try {
    // Frisk login pr. runde (ny build, ny mock), så sporet fanger HELE kæden
    // fra "app åbner" til "skærmen er klar" — ikke kun det der sker efter login.
    const t0 = Date.now()
    rows = traceSupabaseCalls(page, mockUrl, t0)
    await fillLogin(page, origin)
    await waitForReady(page)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  } finally {
    await page.close()
    await browser.close()
    chromeProc.kill()
    await new Promise((resolve) => server.close(resolve))
    await mock.close()
  }
  return { screenId, screenLabel, rows: annoterAfhaengighed(rows) }
}

async function loginCoach(page, origin) {
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
async function waitCoachReady(page) {
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 15000 })
}

async function loginAthlete(page, origin) {
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
async function waitAthleteReady(page) {
  await page.getByText('Mit program').waitFor({ state: 'visible', timeout: 15000 })
}

function tableFor(spor) {
  const lines = []
  lines.push(`### ${spor.screenLabel}`)
  lines.push('')
  lines.push('| Kald | Start (ms) | Varighed (ms) | Hvad det ventede på |')
  lines.push('| --- | --- | --- | --- |')
  for (const r of spor.rows) {
    lines.push(`| ${r.method} ${r.kald}${r.fejlet ? ' (fejlet)' : ''} | ${r.startMs} | ${r.varighedMs} | ${r.afhaengerAf} |`)
  }
  if (!spor.rows.length) lines.push('| (ingen Supabase-kald fanget) | | | |')
  lines.push('')
  const last = spor.rows.length ? Math.max(...spor.rows.map(r => r.slutMs)) : 0
  const serialGaps = spor.rows.filter(r => r.afhaengerAf.startsWith('venter på'))
  lines.push(`Sidste kald sluttede ${last}ms efter navigationens start. ${serialGaps.length} af ${spor.rows.length} kald ventede på et forudgående kald uden at afhænge af dets data (kandidater til parallelisering).`)
  lines.push('')
  return lines.join('\n')
}

async function main() {
  const outDir = path.join(repoRoot, 'outputs', '_seneste', 'kaeden-tegn')
  mkdirSync(outDir, { recursive: true })
  const dato = new Date().toISOString().slice(0, 10)

  const coachSpor = await runRound({
    seed: buildSeed({ withLogs: true }),
    mockKeySuffix: 'coach',
    screenId: 'atletliste',
    screenLabel: 'Atletliste (coach)',
    fillLogin: loginCoach,
    waitForReady: waitCoachReady,
  })

  const athleteSpor = await runRound({
    seed: buildSeed({ withLogs: true }),
    mockKeySuffix: 'atlet',
    screenId: 'dagens-pas-check-in',
    screenLabel: 'Dagens pas + Check-in (atlet — samme URL, samme mount, ét spor)',
    fillLogin: loginAthlete,
    waitForReady: waitAthleteReady,
  })

  const spor = [coachSpor, athleteSpor]
  writeFileSync(path.join(outDir, `${dato}.json`), JSON.stringify(spor, null, 2), 'utf8')

  const doc = [
    '# Kæden af Supabase-kald — ordre 231, commit 1',
    '',
    'Instrumenteret med `scripts/kaeden-tegn.mjs` (ingen ændring af appens kode —',
    'kun request/response-events lyttet på mens samme mock/build/login-',
    'infrastruktur som `scripts/maal-kaeden.mjs` kører). Tider er ms siden',
    'navigationens start (samme browser-session, mock-Supabase, ingen throttling —',
    'formålet er kædens FORM og afhængigheder, ikke absolutte ms; se',
    '`npm run maal:kaeden` for throttlede TTI-tal).',
    '',
    tableFor(coachSpor),
    tableFor(athleteSpor),
  ].join('\n')
  writeFileSync(path.join(repoRoot, 'docs', 'KAEDEN-231.md'), doc, 'utf8')
  console.log('\nSkrevet: docs/KAEDEN-231.md + outputs/_seneste/kaeden-tegn/' + dato + '.json')
}

main().catch((err) => { console.error(err); process.exit(1) })
