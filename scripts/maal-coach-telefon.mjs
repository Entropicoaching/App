#!/usr/bin/env node
// ORDRE 175 — coachens side målt som Marc bruger den: gennem den RIGTIGE,
// autentificerede Dashboard.jsx (login → atletliste → check-in-gennemgang →
// atletens uge → videoer → indbakke), mod e2e/mock-supabase.mjs, i stedet for
// de isolerede harnesses scripts/maal-coach.mjs (ordre 130/137) målte i —
// samme grundprincip som ordre 173 gjorde for atletens side.
//
// METODE: Lighthouse-audit for atletlisten (forsiden, kan fuld-genindlæses
// efter login, ligesom ordre 173's "Dagens pas"), 3 løb, median. De fire
// andre skærme har intet eget URL i den ægte app (Dashboard.jsx bruger
// React-state `view`/`activeTab`, ingen router) — målt som klik→synlig-
// overgange under samme CDP-emulering som ordre 173 (390×844/mobil-UA for
// telefon-profilen, 1280×800/desktop-UA for desktop-profilen).
//
// TO PROFILER (ordrens eget valg, anderledes end ordre 130/137's iPad+
// desktop): telefon 390px OG desktop 1280px, fordi Marc bruger begge. Kun
// telefon-profilen får Lighthouses mobile 4x CPU + langsomt net-emulering
// (samme tal som ordre 173, se THROTTLE nedenfor); desktop-profilen kører
// UDEN kunstig CPU/net-nedsættelse, ligesom scripts/maal-coach.mjs's
// eksisterende measureLighthouseDesktop allerede gjorde (Lighthouses eget
// 'desktop'-formFactor har ingen indbygget netværks-/CPU-emulering, og der
// er ingen grund til at opfinde en anden konvention her).
//
// KLIK FRA FORSIDEN (atletlisten, se src/Dashboard.jsx's view/activeTab):
//   - Atletliste:              0 klik (forsiden selv)
//   - Check-in-gennemgang:     2 klik (atlet-række → "Hjem"-fane/hub)
//   - Atletens uge:            2 klik (atlet-række → "Log"-fane)
//   - Videoer (analyse-fanen): 3 klik (atlet-række → "Mere" → "Analyse")
//   - Indbakke:                1 klik (sidebar "Indbakke")
// Atlet-rækkens klik lander altid på 'program'-fanen (Dashboard.jsx's
// openProfile(athlete, 'program') ved rækkeklik, IKKE 'hub' som standard-
// parameteren i openProfile() selv ellers antyder) — Check-in-gennemgang og
// Atletens uge kræver derfor BEGGE et ekstra fane-klik oveni rækkeklikket.
//
// Kørsel: node scripts/maal-coach-telefon.mjs [label]
// Skriver: outputs/maal-coach/<dato>[--<label>].json + skærmbilleder
// outputs/maal-coach/<dato>[--<label>]/<profil>-<id>.png + en kort tabel i
// terminalen. DÆKKER IKKE: rigtig Supabase (mock), rigtig netværksvej
// (localhost), rigtige atletdata (attrap-atleter, se buildRichCoachSeed
// nedenfor — kun tilføjet i DENNE mock-seed, ikke i e2e/fixtures.mjs).

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
const { buildSeed, COACH_USER } = await import('../e2e/fixtures.mjs')

const MOCK_PORT = Number(process.env.MAAL_COACH_MOCK_PORT || 8997)
const MOCK_KEY = 'mock-anon-key-maal-coach-telefon-175'
const RUNS_PER_SCREEN = 3
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
// Lighthouses egne "mobile"-standardværdier (samme som scripts/maal-telefon.mjs, ordre 173).
const THROTTLE = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpuRate: 4 }

const PROFILES = [
  {
    slug: 'telefon', label: 'Telefon 390×844',
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA,
    lhFormFactor: 'mobile', lhScreenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    throttle: true,
  },
  {
    slug: 'desktop', label: 'Desktop 1280×800',
    viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: undefined,
    lhFormFactor: 'desktop', lhScreenEmulation: { mobile: false, width: 1280, height: 800, deviceScaleFactor: 1, disabled: false },
    throttle: false,
  },
]

// --- attrap-atleter til listestress-testen (kun i DENNE mock-seed, ikke i
// e2e/fixtures.mjs — de øvrige specs kender dem ikke og skal ikke) ----------

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
    // "Ø "-præfiks: sorterer efter alt A-Å i dansk locale, så "Testatlet" (den
    // atlet scriptets klik peger på) altid ligger FØR disse i den
    // alfabetiske atletliste — uanset ordre 175's nye "vis top 25"-grænse
    // (se Dashboard.jsx's ATHLETE_LIST_LIMIT) forbliver Testatlet synlig uden
    // at klikke "Vis alle" først.
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

  // Et par ekstra ulæste beskeder og en afventende video på andre atleter,
  // så Indbakken viser en rigtig kø på tværs af flere atleter, ikke kun ét.
  base.tables.messages = [
    ...base.tables.messages,
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01', athlete_id: placeholders[0].id, sender_role: 'athlete', content: 'Skulderen føles stiv i dag, skal jeg justere opvarmningen?', category: 'besked', read_by_coach: false, pinned: false, created_at: now },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02', athlete_id: placeholders[1].id, sender_role: 'athlete', content: 'Ny video uploadet, klar til gennemgang.', category: 'teknik', read_by_coach: false, pinned: false, created_at: now },
  ]
  base.tables.video_analyses = [
    ...base.tables.video_analyses,
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', client_analysis_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
      athlete_id: placeholders[2].id, athlete_name: placeholders[2].name, source_mode: 'athlete_submission',
      status: 'draft', schema_version: 3, schema_v: 3, lift: 'bænkpres', variation: 'competition',
      load_kg: 95, rpe: 8, reps_count: 3, video_path: `${placeholders[2].id}/eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01.mp4`,
      analysis_state: 'analyzed', coach_note: null, bias_note: null, metrics: {}, findings: [], bar_path: null,
      athlete_feedback: null, analyzed_at: now, created_at: now,
      session_context: { training_session_id: null, program_item_id: null, coach_note_snapshot: null, baseline_snapshot: [], athlete_note: null, feedback_evidence: null, plate_calibration: null },
    },
  ]
  return base
}

// --- statisk server -----------------------------------------------------------

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
  const ttiOk = (m.ttiMs ?? m.renderMs) != null && (m.ttiMs ?? m.renderMs) < 4000
  const clsOk = m.cls != null && m.cls < 0.1
  if (m.fcpMs == null) return (m.renderMs ?? 0) < 1000 ? 'Føles som et værktøj' : (m.renderMs ?? 0) < 2500 ? 'Midt imellem — noget er hurtigt, noget hænger' : 'Føles som en hjemmeside der loader'
  if (fcpOk && ttiOk && clsOk) return 'Føles som et værktøj'
  if (!fcpOk && !ttiOk) return 'Føles som en hjemmeside der loader'
  return 'Midt imellem — noget er hurtigt, noget hænger'
}

async function measureOnce(url, cdpPort, profile, extraFlags) {
  const result = await lighthouse(url, {
    port: cdpPort, output: 'json', logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: profile.lhFormFactor,
    screenEmulation: profile.lhScreenEmulation,
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

async function measureFrontPage(profile, cdpPort, browser, origin, outDir, authed) {
  process.stdout.write(`  Atletliste (${RUNS_PER_SCREEN} løb) ... `)
  const runs = []
  for (let i = 0; i < RUNS_PER_SCREEN; i++) {
    runs.push(await measureOnce(`${origin}/`, cdpPort, profile, authed ? { disableStorageReset: true } : {}))
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
  await page.setViewportSize(profile.viewport)
  await page.goto(`${origin}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(outDir, `${profile.slug}-atletliste.png`), fullPage: true })
  await page.close()

  console.log(`FCP ${Math.round(m.fcpMs)}ms · TTI ${Math.round(m.ttiMs)}ms · CLS ${m.cls.toFixed(3)} · ${m.requestsBeforeUsable} kald · perf ${m.perfScore} · "${m.dom}"`)
  return { id: 'atletliste', label: 'Atletliste', profile: profile.label, klik: 0, ...m, runs }
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

// --- klik→synlig-overgange (Dashboard.jsx har ingen URL-routing, se
// kommentaren øverst) — samme CDP-emulerings-teknik som scripts/maal-telefon.mjs
// (ordre 173) bruger til Sæt-logger, generaliseret til flere klik-trin pr.
// skærm. Kun det SIDSTE trin tidtages; de foregående (fx atlet-rækken) sker
// blot for at komme i position. --------------------------------------------

const SCREENS = [
  {
    id: 'checkin-gennemgang', label: 'Check-in-gennemgang (hub)', klik: 2,
    steps: [
      { click: (p) => p.getByRole('button', { name: /Testatlet.*Uge/ }).click(), waitFor: (p) => p.getByText(/Tilbage til/).waitFor({ state: 'visible', timeout: 20000 }) },
      { click: (p) => p.getByRole('button', { name: /Hjem$/ }).click(), waitFor: (p) => p.getByText('Parathed i dag').first().waitFor({ state: 'visible', timeout: 20000 }) },
    ],
  },
  {
    id: 'atletens-uge', label: 'Atletens uge (log-fanen)', klik: 2,
    steps: [
      { click: (p) => p.getByRole('button', { name: /Testatlet.*Uge/ }).click(), waitFor: (p) => p.getByText(/Tilbage til/).waitFor({ state: 'visible', timeout: 20000 }) },
      { click: (p) => p.getByRole('button', { name: /Log$/ }).click(), waitFor: (p) => p.locator('div:text-is("Squat")').first().waitFor({ state: 'visible', timeout: 20000 }) },
    ],
  },
  {
    id: 'videoer', label: 'Videoer (analyse-fanen, lazy chunk)', klik: 3,
    steps: [
      { click: (p) => p.getByRole('button', { name: /Testatlet.*Uge/ }).click(), waitFor: (p) => p.getByText(/Tilbage til/).waitFor({ state: 'visible', timeout: 20000 }) },
      { click: (p) => p.getByRole('button', { name: /Mere/ }).click(), waitFor: (p) => p.getByRole('button', { name: /Analyse$/ }).waitFor({ state: 'visible', timeout: 20000 }) },
      { click: (p) => p.getByRole('button', { name: /Analyse$/ }).click(), waitFor: (p) => p.getByText('VideoCoach', { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 }) },
    ],
  },
  {
    // .last(): på telefon-profilen ligger "Coach Briefing" to gange i DOM'en
    // — først den altid-tilstedeværende (men transform:translateX(-100%)-
    // skjulte) desktop-sidebar, dernæst den synlige bund-navigation
    // (isMobile, se src/Dashboard.jsx linje ~3213-3230). .first() ramte den
    // skjulte og timede ud ("element is outside of the viewport"). På
    // desktop findes kun sidebarens instans, så .last() rammer den samme,
    // korrekte, ene forekomst der.
    // ORDRE 184: navet og sidehovedet hed "Indbakke"/"Vigtigst nu" da denne
    // måling blev skrevet (ordre 175); ordre 171 omdøbte dem begge til
    // "Coach Briefing" inden 175's gren blev merget til main — scriptet
    // ramte derfor tomt (30s timeout) her. Selektorerne er rettet til den
    // nuværende tekst; waitFor er sidens EGEN h1-overskrift (samme princip
    // som de andre skærmes waitFor — sidens strukturelle indhold, ikke
    // netværks-opdateringsstatus, som afhænger af inboxRefreshStatus og kan
    // vise "Delvist opdateret" i stedet for "Opdateret" uden at det betyder
    // siden ikke er synlig).
    id: 'indbakke', label: 'Indbakke (Coach Briefing)', klik: 1,
    steps: [
      { click: (p) => p.getByText('Coach Briefing', { exact: true }).last().click(), waitFor: (p) => p.getByRole('heading', { name: /Coach Briefing/ }).waitFor({ state: 'visible', timeout: 20000 }) },
    ],
  },
]

async function measureClickScreen(profile, screen, browser, origin, outDir) {
  process.stdout.write(`  ${screen.label} (${RUNS_PER_SCREEN} løb, ${screen.klik} klik→synlig) ... `)
  const [defaultContext] = browser.contexts()
  const runs = []
  let shotTaken = false
  for (let i = 0; i < RUNS_PER_SCREEN; i++) {
    const page = await defaultContext.newPage()
    const client = await defaultContext.newCDPSession(page)
    await client.send('Network.enable')
    await client.send('Emulation.setDeviceMetricsOverride', { width: profile.viewport.width, height: profile.viewport.height, deviceScaleFactor: profile.deviceScaleFactor, mobile: profile.isMobile, screenWidth: profile.viewport.width, screenHeight: profile.viewport.height })
    if (profile.hasTouch) await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    if (profile.userAgent) await client.send('Network.setUserAgentOverride', { userAgent: profile.userAgent })
    if (profile.throttle) {
      await client.send('Network.emulateNetworkConditions', { offline: false, latency: THROTTLE.latency, downloadThroughput: THROTTLE.downloadThroughput, uploadThroughput: THROTTLE.uploadThroughput })
      await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpuRate })
    }

    await page.addInitScript(() => {
      window.__cls = 0
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
        }).observe({ type: 'layout-shift', buffered: true })
      } catch { /* layout-shift ikke understøttet — cls forbliver 0 */ }
    })

    await page.goto(origin, { waitUntil: 'networkidle', timeout: 60000 })
    await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 30000 })

    for (let s = 0; s < screen.steps.length - 1; s++) {
      await screen.steps[s].click(page)
      await screen.steps[s].waitFor(page)
    }

    const last = screen.steps[screen.steps.length - 1]
    let reqCount = 0
    const onReq = () => { reqCount++ }
    client.on('Network.requestWillBeSent', onReq)
    const clsBefore = await page.evaluate(() => window.__cls || 0)
    const t0 = Date.now()
    await last.click(page)
    await last.waitFor(page)
    const t1 = Date.now()
    const clsAfter = await page.evaluate(() => window.__cls || 0)
    client.off('Network.requestWillBeSent', onReq)

    if (!shotTaken) {
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(outDir, `${profile.slug}-${screen.id}.png`), fullPage: true })
      shotTaken = true
    }

    runs.push({ renderMs: t1 - t0, cls: +(clsAfter - clsBefore).toFixed(4), requests: reqCount })
    await client.detach().catch(() => {})
    await page.close()
  }
  const m = {
    renderMs: Math.round(median(runs.map((r) => r.renderMs))),
    cls: +median(runs.map((r) => r.cls)).toFixed(4),
    requestsBeforeUsable: Math.round(median(runs.map((r) => r.requests))),
    fcpMs: null, ttiMs: null, perfScore: null,
  }
  m.dom = verdict(m)
  console.log(`renderMs ${m.renderMs}ms · CLS ${m.cls.toFixed(3)} · ${m.requestsBeforeUsable} kald · "${m.dom}"`)
  return { id: screen.id, label: screen.label, profile: profile.label, klik: screen.klik, ...m, runs }
}

async function main() {
  const label = process.argv[2] || null
  const dato = new Date().toISOString().slice(0, 10)
  const outName = label ? `${dato}--${label}` : dato
  const outDir = path.join(repoRoot, 'outputs', 'maal-coach', outName)
  mkdirSync(outDir, { recursive: true })

  console.log(`Starter mocken på 127.0.0.1:${MOCK_PORT} (${PLACEHOLDER_NAMES.length + 1} atleter)...`)
  const mock = createMockSupabase(buildRichCoachSeed())
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

  const preLoginRows = []
  const authedRows = []
  try {
    for (const profile of PROFILES) {
      console.log(`\n=== Profil: ${profile.label} (uden session) ===`)
      preLoginRows.push({ ...(await measureFrontPage(profile, cdpPort, browser, origin, outDir, false)), note: 'før login — kontrol' })
    }

    console.log('\nLogger ind som coach mod mocken...')
    await loginAsCoach(browser, origin)

    for (const profile of PROFILES) {
      console.log(`\n=== Profil: ${profile.label} (autentificeret) ===`)
      authedRows.push(await measureFrontPage(profile, cdpPort, browser, origin, outDir, true))
      for (const screen of SCREENS) {
        authedRows.push(await measureClickScreen(profile, screen, browser, origin, outDir))
      }
    }
  } finally {
    await browser.close()
    chromeProc.kill()
    await new Promise((resolve) => server.close(resolve))
    await mock.close()
  }

  const rows = [...preLoginRows, ...authedRows]
  writeFileSync(path.join(outDir, '..', `${outName}.json`), JSON.stringify(rows, null, 2), 'utf8')

  console.log('\n| Profil | Skærm | Klik | FCP/renderMs | TTI | CLS | Netværkskald | Perf-score | Dom |')
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of authedRows) {
    const fcp = r.fcpMs != null ? `${Math.round(r.fcpMs)}ms` : (r.renderMs != null ? `${r.renderMs}ms (renderMs)` : 'n/a')
    const tti = r.ttiMs != null ? `${Math.round(r.ttiMs)}ms` : 'n/a'
    const perf = r.perfScore != null ? String(r.perfScore) : 'n/a'
    console.log(`| ${r.profile} | ${r.label} | ${r.klik} | ${fcp} | ${tti} | ${r.cls.toFixed(3)} | ${r.requestsBeforeUsable} | ${perf} | ${r.dom} |`)
  }
  console.log(`\nSkrevet: outputs/maal-coach/${outName}.json + skærmbilleder i outputs/maal-coach/${outName}/`)
}

main().catch((err) => { console.error(err); process.exit(1) })
