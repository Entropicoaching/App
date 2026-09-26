// ORDRE 450 · blok 1: hvad koster rekorderne ved åbning, før (main, ordre 439)
// og efter (rekord-indekset)?
//
// Samme metode som outputs/387/maal-start.mjs: appen bygges mod e2e-mocken,
// dist/ serveres lokalt, og hver åbning måles headless i Chromium på 390x844
// (DSF 2, mobil, touch) med DevTools-drosling. Profiler:
//   fast3g: 562,5 ms RTT, 1,44 Mbit/s ned, 675 kbit/s op, 4x CPU
//   slow4g: 150 ms RTT, 1,6 Mbit/s ned, 750 kbit/s op, 4x CPU
// Mocken har den syntetiske uge fra 419/439 plus en lang opdigtet historik
// (outputs/450/faelles.mjs, i alt ca. 4000 sæt), så 439's hentning rammer sin
// grænse, som den ville for en atlet med et par års træning.
//
// Hver version: log ind én gang (første åbning; her bygges indekset), vent til
// alt er hentet og gemt, og mål derefter RUNS genåbninger fra hjemmeskærmen
// (ny browser-context med samme localStorage, kold HTTP-cache).
//
// Tal pr. åbning (ms fra navigationens start):
//   brugbartMs: første frame hvor Dagens pas' "Godkendt"-knap står på skærmen
//               (næste sæt er kendt og kan logges).
//   rekordKaldStartMs: hvornår rækkerne til rekorderne blev bedt om.
//   raekkerRekord: rækker i det kald (439: hele historikken; nu: kun nyere
//               end indekset). raekkerIalt: alle exercise_logs-rækker hentet.
//   kBRekord: kaldets størrelse over nettet (rå; den lokale server gzipper ikke).
//   langeOpgaverEfterMs: hovedtrådens lange opgaver (>= 50 ms) efter brugbartMs,
//               lagt sammen: den tid atletens tryk kan komme til at vente.
//   stilleMs:   hvornår det sidste kald var færdigt (appen har hentet alt).
//
// Kørsel: node outputs/450/maal.mjs [--runs 3] [--no-build]
//   -> outputs/450/maaling.json
import { createServer } from 'node:http'
import { spawnSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ROOT, MOBILE_UA, hentChromium } from '../419/uge-faelles.mjs'
import { bygSeed } from './faelles.mjs'

const arg = (n) => process.argv.includes(n)
const RUNS = arg('--runs') ? Number(process.argv[process.argv.indexOf('--runs') + 1]) : 3
const MOCK_PORT = Number(process.env.MAAL_MOCK_PORT || 8996)
const MOCK_KEY = 'mock-anon-key-maal-450'
const FOER_DIR = process.env.MAAL_FOER_DIR || path.join(tmpdir(), 'entropi-450-foer')
const PROFILER = {
  fast3g: { latency: 562.5, downloadThroughput: (1.44 * 1000 * 1000) / 8, uploadThroughput: (675 * 1000) / 8, cpuRate: 4 },
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1000 * 1000) / 8, uploadThroughput: (750 * 1000) / 8, cpuRate: 4 },
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const REKORD_SELECT = 'exercise_id,weight,reps_completed,logged_at,exercises(name)'
const erRekordKald = (url) => {
  try {
    const u = new URL(url)
    return u.pathname.endsWith('/rest/v1/exercise_logs') && (u.searchParams.get('select') || '').replace(/\s/g, '') === REKORD_SELECT
  } catch { return false }
}

function bygI(dir) {
  const r = spawnSync('npm run build', { cwd: dir, stdio: 'ignore', shell: true, env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, VITE_SUPABASE_KEY: MOCK_KEY } })
  if (r.status !== 0) throw new Error(`build fejlede i ${dir}`)
}

// "Før" = main (439 merget), pakket ud uden for repoet; node_modules lånes.
function forberedFoer() {
  rmSync(FOER_DIR, { recursive: true, force: true })
  mkdirSync(FOER_DIR, { recursive: true })
  execSync(`git archive main | tar -x -C "${FOER_DIR.replace(/\\/g, '/')}"`, { cwd: ROOT, stdio: 'inherit', shell: 'bash' })
  symlinkSync(path.join(ROOT, 'node_modules'), path.join(FOER_DIR, 'node_modules'), 'junction')
  return execSync('git rev-parse --short main', { cwd: ROOT }).toString().trim()
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
function server(dist) {
  const s = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    const filePath = path.join(dist, urlPath === '/' ? '/index.html' : urlPath)
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    } catch { res.writeHead(200, { 'content-type': 'text/html' }); res.end(readFileSync(path.join(dist, 'index.html'))) }
  })
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r({ s, port: s.address().port })))
}

function initScript() {
  window.__m = { brugbartMs: null, longtasks: [] }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.longtasks.push([e.startTime, e.startTime + e.duration]) })
      .observe({ type: 'longtask', buffered: true })
  } catch { /* ikke understøttet */ }
  const tjek = () => {
    if (window.__m.brugbartMs != null) return
    const knap = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Godkendt' && b.offsetParent !== null)
    if (knap) { window.__m.brugbartMs = performance.now(); return }
    requestAnimationFrame(tjek)
  }
  requestAnimationFrame(tjek)
}

// Én genåbning. Venter til nettet har været stille i 5 s (maks 90 s).
async function aabn(browser, origin, storageState, profil) {
  const context = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA, serviceWorkers: 'block' })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profil.latency, downloadThroughput: profil.downloadThroughput, uploadThroughput: profil.uploadThroughput })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profil.cpuRate })
  await page.addInitScript(initScript)
  let navTs = null
  const reqs = new Map()
  cdp.on('Network.requestWillBeSent', (e) => {
    if (navTs == null && e.type === 'Document') navTs = e.timestamp
    reqs.set(e.requestId, { url: e.request.url, start: e.timestamp, end: null, bytes: 0 })
  })
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.end = e.timestamp; r.bytes = e.encodedDataLength } })
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) r.end = e.timestamp })
  const svar = []
  page.on('response', async (res) => {
    const u = new URL(res.url())
    if (!u.pathname.endsWith('/rest/v1/exercise_logs') || res.request().method() !== 'GET') return
    try {
      const j = await res.json()
      svar.push({ rekord: erRekordKald(res.url()), filter: u.searchParams.getAll('logged_at').join(' ') || 'alt', raekker: Array.isArray(j) ? j.length : 0 })
    } catch { /* intet */ }
  })
  await page.goto(origin, { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => window.__m && window.__m.brugbartMs != null, null, { timeout: 120000, polling: 100 })
  const t0 = Date.now()
  for (;;) {
    await page.waitForTimeout(500)
    const alle = [...reqs.values()].every((r) => r.end != null)
    const sidsteMs = Math.max(...[...reqs.values()].map((r) => ((r.end ?? r.start) - navTs) * 1000))
    const nu = await page.evaluate(() => performance.now())
    if (alle && nu - sidsteMs > 5000) break
    if (Date.now() - t0 > 90000) break
  }
  const m = await page.evaluate(() => window.__m)
  const indeksBytes = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('entropi_rekord_indeks:'))
    return k ? localStorage.getItem(k).length : 0
  })
  const rekordReq = [...reqs.values()].filter((r) => erRekordKald(r.url))
  const stilleMs = Math.round(Math.max(...[...reqs.values()].map((r) => ((r.end ?? r.start) - navTs) * 1000)))
  const langeOpgaverEfterMs = Math.round(m.longtasks.filter(([st]) => st >= m.brugbartMs).reduce((a, [st, e]) => a + (e - st), 0))
  const rekordSvar = svar.filter((x) => x.rekord)
  await cdp.detach().catch(() => {})
  await context.close()
  return {
    brugbartMs: Math.round(m.brugbartMs),
    rekordKaldStartMs: rekordReq.length ? Math.round((rekordReq[0].start - navTs) * 1000) : null,
    raekkerRekord: rekordSvar.reduce((a, x) => a + x.raekker, 0),
    rekordFilter: rekordSvar.map((x) => x.filter),
    kBRekord: +(rekordReq.reduce((a, r) => a + r.bytes, 0) / 1000).toFixed(1),
    raekkerIalt: svar.reduce((a, x) => a + x.raekker, 0),
    indeksBytes,
    langeOpgaverEfterMs,
    stilleMs,
  }
}

async function logInd(browser, origin, fx) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await context.newPage()
  const svar = []
  page.on('response', async (res) => {
    if (!erRekordKald(res.url()) || res.request().method() !== 'GET') return
    try { svar.push((await res.json()).length) } catch { /* intet */ }
  })
  await page.goto(origin)
  await page.locator('#athlete-auth-email').fill(fx.ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(fx.ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: 'Godkendt', exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(6000)
  const state = await context.storageState()
  await context.close()
  return { state, raekkerFoersteAabning: svar.reduce((a, b) => a + b, 0) }
}

async function main() {
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const fx = await import('../../e2e/fixtures.mjs')
  const foerCommit = forberedFoer()
  if (!arg('--no-build')) { console.log('Bygger før (main) og efter mod mocken ...'); bygI(FOER_DIR); bygI(ROOT) }
  const efterCommit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
  const versioner = { foer: { dist: path.join(FOER_DIR, 'dist'), commit: foerCommit }, efter: { dist: path.join(ROOT, 'dist'), commit: `${efterCommit} + arbejdstræ` } }
  const browser = await hentChromium().launch({ headless: true })
  const ud = { dato: new Date().toISOString().slice(0, 10), metode: 'se kommentaren øverst i outputs/450/maal.mjs', profiler: PROFILER, runs: RUNS, versioner: {} }
  try {
    for (const [navn, v] of Object.entries(versioner)) {
      if (!existsSync(v.dist)) throw new Error(`mangler ${v.dist}`)
      const { seed } = bygSeed(fx.buildSeed, fx, { lang: true })
      const mock = createMockSupabase(seed)
      await mock.listen(MOCK_PORT)
      const { s, port } = await server(v.dist)
      const origin = `http://127.0.0.1:${port}/`
      try {
        const { state, raekkerFoersteAabning } = await logInd(browser, origin, fx)
        console.log(`${navn} (${v.commit}): første åbning (login) hentede ${raekkerFoersteAabning} rækker til rekorderne; historik i mocken: ${seed.tables.exercise_logs.length} sæt`)
        const res = { commit: v.commit, historikISaet: seed.tables.exercise_logs.length, raekkerFoersteAabning, profiler: {} }
        for (const [pn, profil] of Object.entries(PROFILER)) {
          const koersler = []
          for (let i = 0; i < RUNS; i++) {
            const r = await aabn(browser, origin, state, profil)
            console.log(`  ${navn} ${pn} #${i + 1}: brugbart ${r.brugbartMs} ms · lange opgaver efter ${r.langeOpgaverEfterMs} ms · stille ${r.stilleMs} ms · rekord-kald start ${r.rekordKaldStartMs} ms · ${r.raekkerRekord} rækker (${r.kBRekord} kB, ${r.rekordFilter.join('; ')}) · exercise_logs i alt ${r.raekkerIalt} · indeks ${r.indeksBytes} B`)
            koersler.push(r)
          }
          res.profiler[pn] = {
            median: {
              brugbartMs: median(koersler.map((k) => k.brugbartMs)),
              raekkerRekord: median(koersler.map((k) => k.raekkerRekord)),
              kBRekord: median(koersler.map((k) => k.kBRekord)),
              raekkerIalt: median(koersler.map((k) => k.raekkerIalt)),
              langeOpgaverEfterMs: median(koersler.map((k) => k.langeOpgaverEfterMs)),
              stilleMs: median(koersler.map((k) => k.stilleMs)),
            },
            koersler,
          }
        }
        ud.versioner[navn] = res
      } finally {
        await new Promise((r) => s.close(r))
        await mock.close()
      }
    }
  } finally {
    await browser.close()
  }
  writeFileSync(path.join(ROOT, 'outputs', '450', 'maaling.json'), JSON.stringify(ud, null, 2) + '\n')
  console.log('\nMedian af genåbninger:')
  for (const pn of Object.keys(PROFILER)) {
    const f = ud.versioner.foer.profiler[pn].median
    const e = ud.versioner.efter.profiler[pn].median
    const pct = (((e.brugbartMs - f.brugbartMs) / f.brugbartMs) * 100).toFixed(1)
    console.log(`  ${pn}: brugbart ${f.brugbartMs} → ${e.brugbartMs} ms (${pct} %) · lange opgaver efter ${f.langeOpgaverEfterMs} → ${e.langeOpgaverEfterMs} ms · stille ${f.stilleMs} → ${e.stilleMs} ms · rækker til rekorder ${f.raekkerRekord} → ${e.raekkerRekord} · ${f.kBRekord} → ${e.kBRekord} kB · exercise_logs i alt ${f.raekkerIalt} → ${e.raekkerIalt}`)
  }
}

main().catch((e) => { console.error('FEJL:', e); process.exitCode = 1 })
