#!/usr/bin/env node
// ORDRE 167 · commit 1/3 — "atletens fem skærme, målt som på en telefon".
// -----------------------------------------------------------------------------
// Måler de fem skærme en atlet faktisk bruger (login, dagens pas, sætlogger,
// check-in, videocoach-forside) med Lighthouse's mobilprofil (390px, simuleret
// 4x CPU-nedsættelse + langsomt netværk — Lighthouse's indbyggede "mobile"
// formFactor, samme metode som ordre 163's Del 1 og scripts/maal-app.mjs
// allerede bruger i dette repo). Hvert løb køres 3 gange, medianen bruges (ét
// enkelt løb er støj).
//
// Fire tal pr. skærm, alle fra Lighthouse's egne audits i samme kørsel:
//   - Tid til noget synligt:      first-contentful-paint
//   - Tid til man kan trykke:     interactive (Time to Interactive)
//   - Layoutskift:                cumulative-layout-shift
//   - Netværkskald før brugbar:   network-requests med startTime <= TTI
//
// ÆRLIG GRÆNSE (samme som scripts/maal-app.mjs allerede dokumenterer): "dagens
// pas", "sætlogger" og "check-in" kræver en levende Supabase-session for at
// AthleteView.jsx overhovedet booter — forbudt her (ingen produktions-Supabase,
// ingen atletdata). De måles derfor som isolerede, statiske harnesses med de
// ÆGTE, uændrede inline-stilarter og ÆGTE src/repsPrescription.js (kopieret fra
// maal-app.mjs's egne harnesses, samme princip) — syntetiske øvelser, ingen
// atletdata. Login og videocoach-forsiden er den ægte, uændrede app.
//
// Kørsel: node scripts/maal-atlet-telefon.mjs [foer|efter]
// Skriver: outputs/167-<foer|efter>/<skærm>.png + outputs/167-<foer|efter>/MAALING.json

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const srcDir = path.join(repoRoot, 'src')
const distDir = path.join(repoRoot, 'dist')

const require = createRequire(import.meta.url)
const runtimeModules = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = require(path.join(runtimeModules, 'playwright'))
const { default: lighthouse } = await import('lighthouse')

const MOCK_SUPABASE_URL = 'https://mockproj.supabase.co'
const MOCK_SUPABASE_KEY = 'mock-anon-key-atlet-paa-telefonen'
const RUNS_PER_SCREEN = 3

// --- ægte, uændrede stilarter kopieret fra src/AthleteView.jsx (samme kilde
// som scripts/maal-app.mjs's harnesses — se den fils egen kommentar) --------
const S = {
  wrap: "min-height:100vh;background:#141410;color:#edeae2;font-family:'IBM Plex Sans',sans-serif;font-weight:300;",
  topbar: "height:52px;border-bottom:1px solid rgba(237,234,226,0.07);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;background:#1c1c18;position:sticky;top:0;z-index:50;",
  logo: "font-family:'Playfair Display',serif;font-size:1rem;color:#edeae2;",
  page: "max-width:680px;margin:0 auto;padding:1.5rem 1rem 6rem;",
  card: "background:#1c1c18;border:1px solid rgba(237,234,226,0.07);padding:1.25rem;margin-bottom:1.5rem;",
  cardLabel: "font-family:'IBM Plex Mono',monospace;font-size:0.56rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#c8923a;margin-bottom:0.75rem;",
  fieldLabel: "font-family:'IBM Plex Mono',monospace;font-size:0.54rem;letter-spacing:0.1em;text-transform:uppercase;color:#7a7770;margin-bottom:0.3rem;",
  fieldInput: "width:100%;background:#141410;border:1px solid rgba(237,234,226,0.13);color:#edeae2;font-family:'IBM Plex Sans',sans-serif;font-size:0.88rem;font-weight:300;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;",
  btnPrimary: "background:#c8923a;color:#141410;font-family:'IBM Plex Mono',monospace;font-size:0.6rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:none;padding:0.5rem 1rem;cursor:pointer;",
}

const NAV_ITEMS = ['Hjem', 'Program', 'Kost', 'Mobilitet', 'Beskeder']

function nav(activeIdx) {
  return `<nav style="position:fixed;bottom:0;left:0;right:0;background:#1c1c18;border-top:1px solid rgba(237,234,226,0.07);display:flex;z-index:100;">
    ${NAV_ITEMS.map((label, i) => `
      <button style="flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;padding:0.7rem 0;color:${i === activeIdx ? '#c8923a' : '#4a4844'};font-family:'IBM Plex Mono',monospace;font-size:0.46rem;letter-spacing:0.1em;text-transform:uppercase;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="9"/></svg>
        <span>${label}</span>
      </button>`).join('')}
  </nav>`
}

function topbar() { return `<div style="${S.topbar}"><div style="${S.logo}">Entropi</div><div style="width:20px;height:20px;border-radius:50%;background:rgba(237,234,226,0.08);"></div></div>` }
function page(inner) { return `<div style="${S.page}">${inner}</div>` }
function shell(title, bodyHtml, activeNavIdx) {
  return `<!doctype html><html lang="da"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>*{box-sizing:border-box} body{margin:0;}</style>
</head><body>
<div style="${S.wrap}">
${topbar()}
${bodyHtml}
${nav(activeNavIdx)}
</div>
</body></html>`
}

// Prøvet: at spejle index.html's service-worker-registrering + kontroller-
// skift-genindlæsning (samme fejl som Login viser, se RAPPORT-167) ind i disse
// harnesses, for at se om samme fejl reproducerede sig her. Den gjorde ikke —
// disse harnesses er for lette/hurtige til at nå SW'ens install→activate-cyklus
// inden for Lighthouses målevindue, så forsøget viste kun støj. Droppet igen;
// Login (den ægte index.html) er den ærlige demonstration af den fejl.

// --- Harness: "Dagens pas" (hjem-fanen, AthleteView.jsx's standardfane) -----
function harnessDagensPas() {
  const sessions = [
    { title: 'Squat — uge 6', done: true },
    { title: 'Bænkpres — topsæt', isNext: true },
    { title: 'Dødløft — volumen', wd: 'Torsdag' },
  ]
  const sessionButtons = sessions.map((sess) => `
    <button style="display:flex;align-items:center;justify-content:space-between;background:${sess.isNext ? 'rgba(200,146,58,0.1)' : 'rgba(237,234,226,0.03)'};border:1px solid ${sess.isNext ? 'rgba(200,146,58,0.45)' : 'rgba(237,234,226,0.07)'};color:#edeae2;padding:0.6rem 0.75rem;min-height:44px;box-sizing:border-box;cursor:pointer;width:100%;text-align:left;font-family:'IBM Plex Sans',sans-serif;font-weight:300;opacity:${sess.done ? 0.55 : 1};margin-bottom:0.35rem;">
      <span style="font-size:0.88rem;">${sess.title}</span>
    </button>`).join('')
  const body = page(`
    <div style="margin-bottom:1.5rem;">
      <h1 style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:400;color:#edeae2;line-height:1.1;">God <em style="font-style:italic;color:#7a7770;">morgen</em>.</h1>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a4844;margin-top:0.25rem;">Torsdag d. 10. september 2026</div>
    </div>
    <div style="${S.card}">
      <div style="${S.cardLabel}">Mit program</div>
      <div style="display:flex;flex-direction:column;gap:0.35rem;">${sessionButtons}</div>
    </div>
  `)
  return shell('Dagens pas', body, 0)
}

// --- Harness: sæt-logger med interval-reps — bruger den ÆGTE, uændrede
// src/repsPrescription.js (ordre 106) ----------------------------------------
function harnessSaetLogger() {
  const body = page(`
    <div style="margin-bottom:0.75rem;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:#c8923a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.1rem;">4 sæt · × 6-8 · RPE 8</div>
      <h1 style="font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:400;color:#edeae2;line-height:1.1;margin:0.2rem 0 1rem;">Bænkpres</h1>
    </div>
    <div id="sets"></div>
    <script type="module">
      import { parseRepsPrescription } from '/src/repsPrescription.js'
      const container = document.getElementById('sets')
      const rep = parseRepsPrescription('6-8')
      const defaultReps = rep.type === 'range' ? String(rep.min) : ''
      const rows = [{ setNum: 1, logged: { weight: 85, reps: 7, rpe: 8 } }, { setNum: 2, logged: null }, { setNum: 3, logged: null }]
      for (const row of rows) {
        const div = document.createElement('div')
        div.style.marginBottom = '0.75rem'
        if (row.logged) {
          div.innerHTML = \`<div style="display:flex;align-items:baseline;gap:0.75rem;"><span style="font-family:'IBM Plex Mono',monospace;font-size:0.85rem;color:#edeae2;">\${row.logged.weight}kg × \${row.logged.reps}</span></div>\`
        } else {
          div.innerHTML = \`<div style="display:flex;align-items:center;gap:0.5rem;">
            <input aria-label="Vægt, sæt \${row.setNum}" style="width:80px;min-height:44px;box-sizing:border-box;padding:0.65rem 0.5rem;font-size:1.1rem;text-align:center;background:#141410;border:1px solid rgba(237,234,226,0.13);color:#edeae2;" type="text" inputmode="decimal" placeholder="kg">
            <input aria-label="Reps, sæt \${row.setNum}" style="width:52px;min-height:44px;box-sizing:border-box;padding:0.65rem 0.3rem;font-size:1.1rem;text-align:center;background:#141410;border:1px solid rgba(237,234,226,0.13);color:#edeae2;" type="text" inputmode="numeric" value="\${defaultReps}">
            <button style="${S.btnPrimary}min-height:44px;box-sizing:border-box;">Log</button>
          </div>\`
        }
        container.appendChild(div)
      }
    </script>
  `)
  return shell('Sæt-logger', body, 1)
}

// --- Harness: check-in / parathed --------------------------------------------
function harnessCheckIn() {
  const scaleRow = (key, label) => `
    <div style="margin-bottom:1rem;">
      <div style="${S.fieldLabel}">${label}</div>
      <div style="display:flex;gap:0.4rem;">
        ${[1, 2, 3, 4, 5].map((v) => `<button style="flex:1;padding:0.9rem 0;min-height:44px;box-sizing:border-box;font-family:'IBM Plex Mono',monospace;font-size:1rem;border:1px solid rgba(237,234,226,0.13);background:#141410;color:#7a7770;">${v}</button>`).join('')}
      </div>
    </div>`
  const body = page(`
    <div style="${S.card}">
      <div style="${S.cardLabel}">Dagens parathed</div>
      <div style="margin-bottom:1rem;">
        <div style="${S.fieldLabel}">Søvn</div>
        <input type="number" style="${S.fieldInput}max-width:90px;">
      </div>
      ${scaleRow('energy', 'Energiniveau')}
      ${scaleRow('motivation', 'Motivation')}
      ${scaleRow('stress', 'Stress')}
      ${scaleRow('soreness', 'Muskelømhed')}
      <button style="${S.btnPrimary}width:100%;min-height:44px;box-sizing:border-box;opacity:0.45;">Log parathed</button>
    </div>
  `)
  return shell('Check-in', body, 0)
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
const HARNESSES = {
  '/harness/dagens-pas.html': harnessDagensPas,
  '/harness/saet-logger.html': harnessSaetLogger,
  '/harness/check-in.html': harnessCheckIn,
}

function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    if (HARNESSES[urlPath]) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HARNESSES[urlPath]()); return }
    if (urlPath.startsWith('/src/')) {
      try {
        const data = readFileSync(path.join(srcDir, urlPath.slice('/src/'.length)))
        res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(data); return
      } catch { res.writeHead(404); res.end('not found'); return }
    }
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

const SCREENS = [
  { id: 'login', label: 'Login', url: '/', screenshot: true },
  { id: 'dagens-pas', label: 'Dagens pas', url: '/harness/dagens-pas.html', screenshot: true },
  { id: 'saet-logger', label: 'Sæt-logger', url: '/harness/saet-logger.html', screenshot: true },
  { id: 'check-in', label: 'Check-in (parathed)', url: '/harness/check-in.html', screenshot: true },
  { id: 'videocoach-forside', label: 'Videocoach-forside (uden video)', url: '/videocoach.html', screenshot: true },
]

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function measureOnce(origin, url, cdpPort) {
  const result = await lighthouse(`${origin}${url}`, {
    port: cdpPort, output: 'json', logLevel: 'error',
    onlyCategories: ['performance'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
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

function verdict(m) {
  // Tommelfingerregel (noteret som "det mest fornuftige" — ordren beder om en
  // dom, ikke en formel): en app-følelse kræver noget synligt hurtigt, ingen
  // mærkbart layoutskift, og at man kan trykke uden lang ventetid.
  const fcpOk = m.fcpMs != null && m.fcpMs < 2500
  const ttiOk = m.ttiMs != null && m.ttiMs < 4000
  const clsOk = m.cls != null && m.cls < 0.1
  if (fcpOk && ttiOk && clsOk) return 'Føles som en app'
  if (!fcpOk && !ttiOk) return 'Føles som en hjemmeside der loader'
  return 'Midt imellem — noget er hurtigt, noget hænger'
}

async function main() {
  const mode = process.argv[2] === 'efter' ? 'efter' : 'foer'
  const outDir = path.join(repoRoot, 'outputs', `167-${mode}`)
  mkdirSync(outDir, { recursive: true })

  console.log('Bygger appen (npm run build, fiktive Supabase-nøgler i proces-scope)...')
  const build = spawnSync('npm run build', {
    cwd: repoRoot, stdio: 'inherit', shell: true,
    env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_KEY: MOCK_SUPABASE_KEY },
  })
  if (build.status !== 0) { console.error('Build fejlede.'); process.exit(1) }

  const { server, port: serverPort } = await startServer()
  const origin = `http://127.0.0.1:${serverPort}`
  const { proc: chromeProc, port: cdpPort } = await launchChrome()
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)

  const rows = []
  try {
    for (const screen of SCREENS) {
      process.stdout.write(`${screen.label} (${RUNS_PER_SCREEN} løb) ... `)
      const runs = []
      for (let i = 0; i < RUNS_PER_SCREEN; i++) {
        runs.push(await measureOnce(origin, screen.url, cdpPort))
      }
      const m = {
        fcpMs: median(runs.map((r) => r.fcpMs)),
        ttiMs: median(runs.map((r) => r.ttiMs)),
        cls: median(runs.map((r) => r.cls)),
        requestsBeforeUsable: Math.round(median(runs.map((r) => r.requestsBeforeUsable))),
        perfScore: Math.round(median(runs.map((r) => r.perfScore))),
      }
      m.dom = verdict(m)

      if (screen.screenshot) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        })
        const page = await context.newPage()
        await page.goto(`${origin}${screen.url}`, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(300)
        await page.screenshot({ path: path.join(outDir, `${screen.id}.png`), fullPage: true })
        await context.close()
      }

      rows.push({ id: screen.id, label: screen.label, ...m, runs })
      console.log(`FCP ${Math.round(m.fcpMs)}ms · TTI ${Math.round(m.ttiMs)}ms · CLS ${m.cls.toFixed(3)} · ${m.requestsBeforeUsable} kald · "${m.dom}"`)
    }
  } finally {
    await browser.close()
    chromeProc.kill()
    await new Promise((resolve) => server.close(resolve))
  }

  writeFileSync(path.join(outDir, 'MAALING.json'), JSON.stringify(rows, null, 2), 'utf8')
  console.log(`\nSkrevet: ${path.relative(repoRoot, outDir)}/MAALING.json + skærmbilleder`)
}

main().catch((err) => { console.error(err); process.exit(1) })
