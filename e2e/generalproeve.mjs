// Generalprøve U1 til U8 (ordre 80): hele natten i en headless browser, lokalt og syntetisk.
//   node e2e/generalproeve.mjs <live-build> <ny-build> <live-build-igen> <billedmappe> [resultat.json] [udrul-foerst|migration-foerst]
// Byggene laves med VITE_SUPABASE_URL=http://127.0.0.1:8995 (vite build --outDir ...).
// - "Udrulning" er som GitHub Pages med keep_files: den nye builds filer kopieres oven i de gamle,
//   så gamle assets bliver liggende, og index.html, sw.js og version.json skiftes.
// - Databasen bag de nye tabeller (kostplan, B, C, D) er PGlite med produktionens skema og ægte
//   RLS (scripts/generalproeve/proeveDb.mjs). Resten af backenden er e2e-mocken.
// - Edge-funktionen u8-push er den rigtige handler, først "ikke deployet" (404), så med syntetiske nøgler.
// - To faner (atlet 390 og coach 1280) er åbne hele natten; ved hvert trin får de fokus, som når
//   telefonen tages frem, og skal virke bagefter. Ved hvert trin åbnes også friske faner som atlet og
//   coach på 390 og 1280 px. Ingen nøgler, ingen rigtige data, intet net ud af maskinen.
import { createServer, request as httpRequest } from 'node:http'
import { cpSync, mkdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { spawnSync, spawn } from 'node:child_process'
import { createMockSupabase } from './mock-supabase.mjs'
import { u7Seed } from './u7-kost-data.spec.mjs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { launchBrowser, chromium, ROOT } from './harness.mjs'
import { createRehearsalDb, U7_TABLES, U8_TABLES, KOSTPLAN_TABLES } from '../scripts/generalproeve/proeveDb.mjs'
import { createHandler } from '../supabase/functions-udkast/u8-push/handler.mjs'

const SITE_PORT = 5191, PROXY_PORT = 8995, MOCK_PORT = 8996
const SITE = `http://127.0.0.1:${SITE_PORT}/`
const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 900 }]
const PG_TABLES = new Set([...U7_TABLES, ...U8_TABLES, ...KOSTPLAN_TABLES])
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }
const ENDPOINT = 'https://push.example.test/generalproeve'

const [liveBuild, newBuild, liveAgain, outDir = join(ROOT, 'outputs', '_seneste', 'generalproeve'), resultFile, order = 'udrul-foerst'] = process.argv.slice(2)
const waitFor = async (check, ms = 15000) => {
  const start = Date.now()
  while (Date.now() - start < ms) { if (await check()) return true; await new Promise(r => setTimeout(r, 150)) }
  return false
}

// ===== Den "udrullede" side: GitHub Pages med keep_files. =====
const siteDir = join(outDir, '_site')
function deploy(build) {
  for (const name of ['index.html', 'sw.js', 'version.json']) if (!existsSync(join(build, name))) throw Error(`${build} mangler ${name}`)
  cpSync(build, siteDir, { recursive: true, force: true })
  return JSON.parse(readFileSync(join(siteDir, 'version.json'), 'utf8')).buildId
}
const siteServer = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, SITE).pathname)
  let file = normalize(join(siteDir, path))
  if (!file.startsWith(normalize(siteDir))) { res.writeHead(403); return res.end() }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (path.startsWith('/assets/') || extname(path)) { res.writeHead(404); return res.end('404') }
    file = join(siteDir, 'index.html')
  }
  // GitHub Pages: Cache-Control max-age=600 på alt.
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600' })
  res.end(readFileSync(file))
})

// ===== Backend: PGlite til de nye tabeller, edge-funktionen, mocken til resten. =====
const keys = Object.fromEntries([...spawnSync(process.execPath, ['scripts/u8-vapid-noegler.mjs'], { cwd: ROOT, encoding: 'utf8' })
  .stdout.matchAll(/^([A-Z0-9_]+) = (\S+)$/gm)].map(m => [m[1], m[2]]))
const state = { functionDeployed: false }

async function main() {
  if (!liveBuild || !newBuild || !liveAgain) throw Error('Angiv tre byggemapper: live, ny, live igen')
  mkdirSync(siteDir, { recursive: true })
  const rehearsal = await createRehearsalDb()
  const { rest, db } = rehearsal
  const mock = createMockSupabase(u7Seed(false))
  await mock.listen(MOCK_PORT)
  const tokenUser = new Map()
  const userOf = async auth => {
    const token = String(auth ?? '').replace(/^Bearer\s+/i, '')
    if (!token || token === 'e2e-anon-key-ikke-en-rigtig-noegle') return null
    if (tokenUser.has(token)) return tokenUser.get(token)
    const answer = await fetch(`http://127.0.0.1:${MOCK_PORT}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}` } })
    const id = answer.ok ? (await answer.json()).id : null
    tokenUser.set(token, id)
    return id
  }
  const fn = createHandler({ env: name => ({ ...keys, SUPABASE_URL: `http://127.0.0.1:${PROXY_PORT}`, SUPABASE_SERVICE_ROLE_KEY: 'service' })[name], sendEnabled: true })
  const proxy = createServer(async (req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Profile' }
    const url = new URL(req.url, 'http://127.0.0.1')
    const table = url.pathname.startsWith('/rest/v1/') ? decodeURIComponent(url.pathname.slice(9)) : null
    try {
      if (table && PG_TABLES.has(table)) {
        for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
        const user = await userOf(req.headers.authorization)
        req.headers.authorization = user ? `Bearer tok-${user}` : (req.headers.authorization === 'Bearer service' ? 'Bearer service' : '')
        return await rest.handleHttp(req, res, url)
      }
      if (url.pathname === '/functions/v1/u8-push') {
        for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
        if (!state.functionDeployed) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"code":"NOT_FOUND","message":"Requested function was not found"}') }
        const chunks = []; for await (const c of req) chunks.push(c)
        const answer = await fn(new Request(`http://127.0.0.1${url.pathname}`, { method: req.method, headers: { 'x-u8-cron': String(req.headers['x-u8-cron'] ?? '') }, body: Buffer.concat(chunks) }))
        res.writeHead(answer.status, { 'Content-Type': 'application/json' }); return res.end(await answer.text())
      }
      const forward = httpRequest({ host: '127.0.0.1', port: MOCK_PORT, path: req.url, method: req.method, headers: req.headers }, answer => {
        res.writeHead(answer.statusCode, answer.headers); answer.pipe(res)
      })
      forward.on('error', err => { res.writeHead(502); res.end(String(err.message)) })
      req.pipe(forward)
    } catch (err) { res.writeHead(500, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: String(err?.message ?? err) })) }
  })
  await new Promise(r => proxy.listen(PROXY_PORT, '127.0.0.1', r))
  await new Promise(r => siteServer.listen(SITE_PORT, '127.0.0.1', r))
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const log = []
  // Fejl, der også findes i den gamle live-udgave (c48f4113), tæller ikke mod den nye; de logges.
  const entry = dir => readFileSync(join(dir, 'index.html'), 'utf8').match(/index-[^./"]+\.js/)?.[0]
  const liveEntries = new Set([entry(liveBuild), entry(liveAgain)])
  const KNOWN_LIVE = /Failed to update a ServiceWorker/
  const knownLive = []
  const realErrors = async tab => {
    const old = liveEntries.has(await buildOf(tab).catch(() => null))
    const known = old ? tab.errors.filter(e => KNOWN_LIVE.test(e)) : []
    if (known.length) knownLive.push(...known)
    return tab.errors.filter(e => !known.includes(e))
  }
  const steps = []
  const fail = []

  // ===== Hjælpere til faner. =====
  async function newTab(vp, user, { iphone = false } = {}) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    await context.grantPermissions(['notifications'], { origin: SITE.slice(0, -1) })
    await context.addInitScript(([endpoint, id]) => {
      try { localStorage.setItem('entropi2:onboarding:v1', '1'); localStorage.setItem(`entropi2:onboarding:v1:athlete:${encodeURIComponent(id)}`, '1') } catch { /* syntetisk */ }
      const KEY = 'e2e-generalproeve-tilmelding'
      if (typeof PushManager === 'undefined') return
      const make = key => ({ endpoint, options: { applicationServerKey: key },
        toJSON: () => ({ endpoint, keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'c'.repeat(22) } }),
        unsubscribe: async () => { localStorage.removeItem(KEY); return true } })
      PushManager.prototype.getSubscription = async function () { const s = localStorage.getItem(KEY); return s ? make(Uint8Array.from(JSON.parse(s)).buffer) : null }
      PushManager.prototype.subscribe = async function (o) { const k = new Uint8Array(o.applicationServerKey.buffer ?? o.applicationServerKey); localStorage.setItem(KEY, JSON.stringify([...k])); return make(k.buffer) }
    }, [ENDPOINT, ATHLETE_ID])
    const page = await context.newPage()
    const tab = { context, page, vp, user, errors: [], loads: 0 }
    page.on('pageerror', err => tab.errors.push(err.message))
    page.on('console', msg => { if (msg.type() === 'error' && /dynamically imported module|Failed to fetch|ChunkLoadError|Loading chunk/i.test(msg.text())) tab.errors.push(msg.text()) })
    page.on('load', () => { tab.loads++ })
    await page.goto(SITE)
    await page.locator('#athlete-auth-email').fill(user.email)
    await page.locator('#athlete-auth-password').fill(user.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    return tab
  }
  const isCoach = tab => tab.user === COACH_USER
  async function ready(tab, ms = 30000) {
    if (isCoach(tab)) await tab.page.getByText('Kræver dit blik').first().waitFor({ state: 'visible', timeout: ms })
    else await tab.page.locator('[data-entropi2-home]').waitFor({ state: 'visible', timeout: ms })
    await tab.page.waitForTimeout(1500)
    const scroll = await tab.page.evaluate(() => document.documentElement.scrollWidth)
    if (scroll > tab.vp.width + 1) throw Error(`vandret scroll ${scroll}px på ${tab.vp.width}`)
  }
  const buildOf = tab => tab.page.evaluate(async () => {
    const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src).join(' ')
    return scripts.match(/index-[^./]+\.js/)?.[0] ?? scripts
  })
  // Telefonen tages frem: synlighed og fokus, som appens versions-tjek lytter på.
  async function wake(tab) {
    const loadsBefore = tab.loads
    await tab.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
    await waitFor(async () => tab.loads > loadsBefore, 8000)
    return tab.loads > loadsBefore
  }
  async function shot(tab, name) { await tab.page.evaluate(() => window.scrollTo(0, 0)); await tab.page.screenshot({ path: join(outDir, `${name}.png`) }) }

  // ===== Hvad appen skal vise i hvert trin. =====
  async function checkAthlete(tab, expect, label) {
    await ready(tab)
    const page = tab.page
    const feeling = page.locator('[data-u7-day-feeling]'), push = page.locator('[data-u8-push]')
    const out = { label }
    if (expect.u7) {
      await feeling.waitFor({ state: 'visible', timeout: 20000 })
      await feeling.evaluate(el => el.scrollIntoView({ block: 'center' }))
      await feeling.getByRole('button', { name: 'Søvnkvalitet 4' }).click()
      await feeling.getByText('Gemt. Din coach kan se tallene.').waitFor({ timeout: 10000 })
      out.soevnGemt = await waitFor(async () => (await db.query(`select count(*)::int n from public.tracking_daily_v1 where athlete_id = $1 and sleep_quality = 4`, [ATHLETE_ID])).rows[0].n > 0, 8000)
      if (!out.soevnGemt) throw Error(`${label}: søvn blev ikke gemt i databasen`)
    } else if (await feeling.count()) throw Error(`${label}: søvn og smerte vises uden tabellen`)
    if (expect.push) {
      await push.waitFor({ state: 'visible', timeout: 20000 })
      if (await page.locator('[data-u8-push="on"]').count() === 0) {
        await push.evaluate(el => el.scrollIntoView({ block: 'center' }))
        await push.getByRole('button', { name: 'Slå påmindelser til' }).click()
        await page.getByText(/Påmindelser er slået til/).waitFor({ timeout: 10000 })
      }
      out.tilmeldt = await waitFor(async () => (await db.query(`select count(*)::int n from public.push_subscriptions_v1 where user_id = $1`, [ATHLETE_USER.id])).rows[0].n > 0, 8000)
      if (!out.tilmeldt) throw Error(`${label}: tilmeldingen blev ikke gemt i databasen`)
    } else if (await push.count()) throw Error(`${label}: push-kortet vises uden nøgle, funktion eller tabel`)
    return out
  }
  // En fane, der var åben under skiftet: skal virke (forside, ingen browserfejl). Hvad den viser og
  // hvad et tryk på søvn giver, logges, for den husker tabellernes tilstand fra sin sidste indlæsning.
  async function observeAthlete(tab, label) {
    await ready(tab)
    const page = tab.page
    const feeling = page.locator('[data-u7-day-feeling]'), push = page.locator('[data-u8-push]')
    const out = { label, soevnKort: await feeling.count() > 0, pushKort: await push.count() > 0 ? await push.first().getAttribute('data-u8-push') : null }
    if (out.soevnKort) {
      await feeling.evaluate(el => el.scrollIntoView({ block: 'center' }))
      const value = 2 + (tab.taps = (tab.taps ?? 0) + 1) % 3
      await feeling.getByRole('button', { name: `Søvnkvalitet ${value}` }).click()
      await page.waitForTimeout(2500)
      out.soevnTryk = { vaerdi: value, tekst: (await feeling.textContent()).replace(/\s+/g, ' ').slice(0, 220) }
      out.soevnIDatabasen = (await rehearsal.tables()).includes('tracking_daily_v1')
        ? (await db.query('select count(*)::int n from public.tracking_daily_v1 where athlete_id = $1 and sleep_quality = $2', [ATHLETE_ID, value])).rows[0].n > 0 : 'tabel findes ikke'
    }
    if (out.pushKort) out.pushTekst = (await push.first().textContent()).replace(/\s+/g, ' ').slice(0, 200)
    return out
  }
  async function checkCoach(tab, label) {
    await ready(tab)
    if (await tab.page.locator('[data-u8-push]').count()) throw Error(`${label}: coachen ser push-kortet`)
    return { label, tekst: (await tab.page.locator('section[aria-label="Atleter der kræver handling"]').textContent().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120) }
  }

  // ===== Ét trin: handlingen, de åbne faner og friske faner. =====
  const open = {}
  async function step(name, action, expect) {
    const started = Date.now()
    const record = { trin: name, forventet: expect }
    try {
      if (action) record.handling = await action()
      // Åbne faner: telefonen tages frem.
      for (const [key, tab] of Object.entries(open)) {
        const before = await buildOf(tab).catch(() => null)
        tab.errors.length = 0
        const reloaded = await wake(tab)
        const after = await buildOf(tab).catch(() => null)
        const check = isCoach(tab) ? await checkCoach(tab, `${name} åben ${key}`) : await observeAthlete(tab, `${name} åben ${key}`)
        if (!isCoach(tab) && reloaded && expect.u7 && !check.soevnKort) throw Error(`${name} åben ${key}: genindlæst, men søvn og smerte vises ikke`)
        const openErrors = await realErrors(tab)
        if (openErrors.length) throw Error(`${name} åben ${key}: browserfejl ${openErrors.join(' | ')}`)
        await shot(tab, `${name}-aaben-${key}`)
        record[`aaben_${key}`] = { genindlaest: reloaded, build: [before, after], ...check }
      }
      // Friske faner.
      for (const vp of VIEWPORTS) for (const user of [ATHLETE_USER, COACH_USER]) {
        const tab = await newTab(vp, user)
        try {
          const who = isCoach(tab) ? 'coach' : 'atlet'
          const check = isCoach(tab) ? await checkCoach(tab, `${name} ny ${who} ${vp.name}`) : await checkAthlete(tab, expect, `${name} ny ${who} ${vp.name}`)
          const freshErrors = await realErrors(tab)
          if (freshErrors.length) throw Error(`${name} ny ${who} ${vp.name}: browserfejl ${freshErrors.join(' | ')}`)
          await shot(tab, `${name}-ny-${who}-${vp.name}`)
          record[`ny_${who}_${vp.name}`] = { build: await buildOf(tab), ...check }
        } finally { await tab.context.close() }
      }
      record.status = 'GRØN'
    } catch (err) {
      record.status = 'RØD'; record.fejl = String(err?.message ?? err).slice(0, 600); fail.push(`${name}: ${record.fejl}`)
    }
    record.sekunder = Math.round((Date.now() - started) / 100) / 10
    steps.push(record)
    console.log(`${record.status}: ${name} (${record.sekunder} s)${record.fejl ? ' ' + record.fejl : ''}`)
  }
  const pg = async () => (await rehearsal.tables()).filter(t => PG_TABLES.has(t))
  // Efterkontrollen (scripts/efterkontrol-u8.mjs) mod den lokale "live", med e2e-testatleten.
  const efterkontrol = (extra, withUser = true) => new Promise(resolve => {
    const child = spawn(process.execPath, ['scripts/efterkontrol-u8.mjs', '--url', SITE.slice(0, -1), ...extra], { cwd: ROOT,
      env: { ...process.env, ...(withUser ? { EFTERKONTROL_ATLET_EMAIL: ATHLETE_USER.email, EFTERKONTROL_ATLET_KODE: ATHLETE_USER.password } : {}) } })
    let out = ''
    child.stdout.on('data', d => { out += d }); child.stderr.on('data', d => { out += d })
    child.on('close', code => resolve({ code, out }))
  })
  async function controlled(extra, wantCode, label, withUser = true) {
    const r = await efterkontrol(extra, withUser)
    log.push({ efterkontrol: label, args: extra, exit: r.code, udskrift: r.out })
    if (r.code !== wantCode) throw Error(`efterkontrol ${label}: exit ${r.code}, ventet ${wantCode}
${r.out}`)
    return { exit: r.code, roede: (r.out.match(/^RØD /gm) || []).length, sprunget: (r.out.match(/^SPRUNGET OVER/gm) || []).length }
  }

  try {
    const liveId = deploy(liveBuild)
    open.atlet390 = await newTab(VIEWPORTS[0], ATHLETE_USER)
    open.coach1280 = await newTab(VIEWPORTS[1], COACH_USER)
    await step('0-live-i-dag', async () => ({ build: liveId, tabeller: await pg() }), { u7: false, push: false })
    if (order === 'migration-foerst') {
      // Anbefalet: databasen først. Den gamle app (live) må ikke mærke noget.
      await step('1-migration-B-C-gammel-app', async () => { await rehearsal.step('u7Up'); return { tabeller: await pg() } }, { u7: false, push: false })
      await step('2-migration-D-gammel-app', async () => { await rehearsal.step('u8Up'); return { tabeller: await pg() } }, { u7: false, push: false })
      await step('3-udrul-ny-app', async () => ({ build: deploy(newBuild), tabeller: await pg() }), { u7: true, push: false })
    } else {
      await step('1-udrul-ny-app', async () => ({ build: deploy(newBuild), tabeller: await pg() }), { u7: false, push: false })
      await step('2-migration-B-C', async () => { await rehearsal.step('u7Up'); return { tabeller: await pg() } }, { u7: true, push: false })
      await step('3-migration-D', async () => { await rehearsal.step('u8Up'); return { tabeller: await pg() } }, { u7: true, push: false })
    }
    await step('4-noegler-og-funktion', async () => {
      state.functionDeployed = true
      const out = { funktion: 'u8-push' }
      out.efterkontrolGroen = await controlled([], 0, 'efter nøgler')
      out.efterkontrolUdenTestbruger = await controlled([], 0, 'uden testatlet', false)
      // Modprøve: et hul i RLS (en anden atlets række bliver synlig) skal give rød efterkontrol.
      await db.query(`insert into public.tracking_daily_v1 (athlete_id, logged_date, sleep_quality) values ($1, current_date, 3) on conflict do nothing`, ['9b000000-0000-4000-8000-000000000001'])
      await rest.exec('create policy generalproeve_hul on public.tracking_daily_v1 for select to authenticated using (true)')
      out.efterkontrolMedHul = await controlled([], 1, 'med hul i RLS')
      await rest.exec('drop policy generalproeve_hul on public.tracking_daily_v1')
      out.efterkontrolForkertApp = await controlled(['--app', 'live'], 1, 'forventer gammel app')
      return out
    }, { u7: true, push: true })
    // En tredje fane åbnes, mens alt er tændt, og lever videre gennem tilbagerulningerne.
    open.atlet1280 = await newTab(VIEWPORTS[1], ATHLETE_USER)
    await ready(open.atlet1280)
    await step('5-cron-afsendelse', async () => {
      const answer = await fn(new Request('http://127.0.0.1/functions/v1/u8-push', { method: 'POST', headers: { 'x-u8-cron': keys.U8_CRON_SECRET }, body: JSON.stringify({ action: 'send' }) }))
      return { svar: await answer.json() }
    }, { u7: true, push: true })
    await step('6-tilbagerul-D', async () => { await rehearsal.step('u8Down'); state.functionDeployed = false; return { tabeller: await pg() } }, { u7: true, push: false })
    await step('7-tilbagerul-B-C', async () => { await rehearsal.step('u7Down'); return { tabeller: await pg() } }, { u7: false, push: false })
    await step('8-git-tilbage-c48f4113', async () => ({ build: deploy(liveAgain), tabeller: await pg(),
      efterkontrol: await controlled(['--app', 'live', '--tabeller', 'ingen'], 0, 'efter fuld tilbagerulning') }), { u7: false, push: false })
    // Ekstra: kun git tilbage, databasen beholder B, C og D (hvis appen rulles tilbage, men migrationerne bliver).
    await step('9-gammel-app-med-nye-tabeller', async () => { await rehearsal.step('u7Up'); await rehearsal.step('u8Up'); return { tabeller: await pg() } }, { u7: false, push: false })
  } finally {
    for (const tab of Object.values(open)) await tab.context.close().catch(() => {})
    await browser.close()
    await new Promise(r => { siteServer.closeAllConnections?.(); siteServer.close(r) })
    await new Promise(r => { proxy.closeAllConnections?.(); proxy.close(r) })
    await mock.close()
    await db.close()
  }
  if (resultFile) writeFileSync(resultFile, JSON.stringify({ steps, fejl: fail, kendteLiveFejl: knownLive, log }, null, 2))
  console.log(`Generalprøve: ${steps.filter(s => s.status === 'GRØN').length} af ${steps.length} trin grønne`)
  if (fail.length) process.exitCode = 1
}

main().catch(err => { console.error(err); process.exitCode = 1 })
