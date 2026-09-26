// ORDRE 397, blok 3: Dagens pas i kælderen, bevist headless.
//
// Bygger appen mod e2e-mocken (e2e/mock-supabase.mjs + buildSeed, aldrig
// prod), serverer dist/ lokalt (med public/sw.js, så service workeren kører
// som i produktion) og kører i Chromium på 390x844 (DSF 2, mobil, touch):
//
//   1. Online: log ind, Dagens pas vises; service worker tager kontrol, og en
//      genindlæsning henter appens filer gennem den (så de caches).
//   2. Sæt 1 logges online (midt i passet).
//   3. Nettet slås fra (DevTools offline, context.setOffline) og access-token
//      gøres udløbet (som efter en time i lommen), og appen genindlæses (iOS
//      har dræbt den i baggrunden): Dagens pas skal stå der, fra telefonen.
//   4. Sæt 2, 3 og 4 logges uden net; hvert får "sendes når du har net".
//   5. Nettet slås til. Det første INSERT der når mocken, får sit svar
//      "tabt" (route.fetch + abort: serveren har rækken, klienten ser en
//      netværksfejl), for at bevise at genforsøget ikke laver en dublet.
//   6. Køen tømmes; mocken skal have præcis én række pr. sæt (1-4) med de
//      rigtige tal, og markeringerne forsvinder. En genindlæsning online viser
//      fire klarede sæt og ingen ventende.
//
// Kørsel: node outputs/397/offline-bevis.mjs  -> outputs/397/*.png + bevis.json
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = path.join(HERE, '..', '..')
const DIST = path.join(ROOT, 'dist')
const MOCK_PORT = Number(process.env.BEVIS_MOCK_PORT || 8997)
const MOCK_KEY = 'mock-anon-key-bevis-397'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

function startStaticServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    let filePath = path.join(DIST, urlPath === '/' ? '/index.html' : urlPath)
    if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end(); return }
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    } catch {
      // SPA: ukendte stier får forsiden (som GitHub Pages' 404-fallback).
      filePath = path.join(DIST, 'index.html')
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(readFileSync(filePath))
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

async function main() {
  const { createRequire } = await import('node:module')
  const { homedir } = await import('node:os')
  const require = createRequire(import.meta.url)
  const { chromium } = require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const { buildSeed, ATHLETE_USER, ATHLETE_ID, EXERCISE_ID } = await import('../../e2e/fixtures.mjs')

  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  const table = async (name) => (await fetch(`${mockUrl}/__e2e/table?name=${name}`)).json()
  console.log('Bygger mod mocken ...')
  const build = spawnSync('npm run build', { cwd: ROOT, stdio: 'ignore', shell: true, env: { ...process.env, VITE_SUPABASE_URL: mockUrl, VITE_SUPABASE_KEY: MOCK_KEY } })
  if (build.status !== 0) { await mock.close(); throw new Error('build fejlede') }

  const { server, port } = await startStaticServer()
  const origin = `http://127.0.0.1:${port}/`
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  const konsolFejl = []
  page.on('pageerror', (e) => konsolFejl.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_INTERNET_DISCONNECTED')) konsolFejl.push(m.text().slice(0, 300)) })
  const out = HERE
  mkdirSync(out, { recursive: true })
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) })
  const log = []
  const trin = (t) => { console.log('  ' + t); log.push(t) }

  // Alle skrivninger til exercise_logs, som de når netværket (efter sw).
  const skrivninger = []
  context.on('request', (r) => {
    if (r.url().includes('/rest/v1/exercise_logs') && ['POST', 'PATCH', 'DELETE'].includes(r.method())) {
      skrivninger.push({ metode: r.method(), body: r.postData() })
    }
  })

  try {
    // 1. Online: log ind.
    await page.goto(origin)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    // Første indlæsning skete før workeren styrede siden; genindlæs, så
    // appens filer går gennem den og caches (sker også i virkeligheden:
    // controllerchange-genindlæsningen efter deploy).
    await page.reload()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service workeren skal styre siden')
    await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    trin('online: Dagens pas vist, service worker styrer siden')
    await shot('01-online-foer-passet')

    // 2. Sæt 1 online.
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await page.waitForFunction(async ([u]) => (await (await fetch(`${u}/__e2e/table?name=exercise_logs`)).json()).filter(r => !r.skipped).length >= 1, [mockUrl], { timeout: 15000 })
    await page.getByText('Sæt 2/4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    // Vent til øjebliksbilledet har sæt 1 (genhentning efter skrivningen).
    await page.waitForFunction(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith('entropi_offline_pas:'))
      const s = k && JSON.parse(localStorage.getItem(k))
      return s && s.week && (s.logs || []).length >= 1
    }, null, { timeout: 15000 })
    trin('online: sæt 1 logget og gemt i mocken; øjebliksbillede af Dagens pas ligger på telefonen')
    const assetsCachet = await page.evaluate(async () => (await (await caches.open('entropi-assets-v1')).keys()).map(r => new URL(r.url).pathname))
    trin(`service workeren har ${assetsCachet.length} app-filer i cachen`)

    // 3. Nettet væk, token udløbet, appen dræbt og åbnet igen.
    await page.evaluate(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
      const s = JSON.parse(localStorage.getItem(k))
      s.expires_at = Math.floor(Date.now() / 1000) - 60
      localStorage.setItem(k, JSON.stringify(s))
    })
    await context.setOffline(true)
    const t0 = Date.now()
    await page.reload()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await page.getByText('Sæt 2/4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    const offlineStartMs = Date.now() - t0
    const onLineEfterReload = await page.evaluate(() => navigator.onLine)
    await page.locator('[data-ingen-forbindelse]').waitFor({ state: 'visible', timeout: 5000 })
    const linje = await page.locator('[data-ingen-forbindelse]').innerText()
    assert.equal(await page.locator('#athlete-auth-email').count(), 0, 'ingen login-skærm uden net')
    trin(`offline + udløbet token: appen åbnede fra telefonen og viste Dagens pas (sæt 2/4) på ${offlineStartMs} ms, uden login-skærm (navigator.onLine=${onLineEfterReload}); linjen: "${linje}"`)
    await shot('02-offline-dagens-pas')

    // 4. Tre sæt uden net.
    const skrivFoerOffline = skrivninger.length
    const logSaet = async (n) => {
      await page.getByText(`Sæt ${n}/4`, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
      await page.waitForFunction(([k, key]) => key in JSON.parse(localStorage.getItem(k) || '{}'), [`entropi_offline_sets:${ATHLETE_ID}`, `${EXERCISE_ID}_${n}`])
      await page.waitForTimeout(400)
    }
    await logSaet(2)
    await shot('03-offline-saet-2-logget')
    await logSaet(3)
    // Fold klarede sæt ud, så markeringen pr. sæt kan ses (sæt 2 og 3 venter).
    await page.getByRole('button', { name: /klarede sæt/ }).first().click()
    await page.locator('[data-venter-paa-net="1"]').first().waitFor({ state: 'visible', timeout: 5000 })
    const markeringer = await page.locator('[data-venter-paa-net="1"]').count()
    assert.equal(markeringer, 2, 'sæt 2 og 3 skal vise "sendes når du har net"; sæt 1 (sendt online) ikke')
    await page.getByText('2 sæt gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
    await shot('04-offline-markering-pr-saet')
    await logSaet(4)
    await page.getByText('3 sæt gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
    const koe = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), `entropi_offline_sets:${ATHLETE_ID}`)
    assert.deepEqual(Object.keys(koe).sort(), [2, 3, 4].map(n => `${EXERCISE_ID}_${n}`).sort(), 'sæt 2-4 skal ligge i køen')
    assert.ok(Object.values(koe).every(e => /^[0-9a-f-]{36}$/.test(e.clientId)), 'hvert køet sæt har sit række-id')
    assert.equal(skrivninger.length, skrivFoerOffline, 'uden net forsøges ingen skrivning af sæt')
    trin(`uden net: sæt 2, 3, 4 logget; køen har 3 poster med hvert sit række-id; sæt 2 og 3 viste "sendes når du har net" pr. sæt; "3 sæt gemt lokalt" står også når passet er færdigt; 0 skrivninger af sæt forsøgt`)
    await shot('05-offline-passet-faerdigt-tre-venter')
    const venterRows = (await table('exercise_logs')).filter(r => !r.skipped).length
    assert.equal(venterRows, 1, 'mocken har kun sæt 1 mens nettet er væk')

    // 5. Nettet tilbage; første INSERT får sit svar "tabt".
    let tabtSvar = 0
    await context.route('**/rest/v1/exercise_logs*', async (route) => {
      const r = route.request()
      if (r.method() === 'POST' && tabtSvar === 0) {
        tabtSvar++
        await route.fetch()            // når serveren: rækken oprettes
        return route.abort('failed')   // men svaret kommer aldrig frem
      }
      return route.continue()
    })
    const skrivFoerOnline = skrivninger.length
    await context.setOffline(false)
    await page.waitForFunction((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length === 0, `entropi_offline_sets:${ATHLETE_ID}`, { timeout: 60000 })
    await page.waitForFunction(() => !document.querySelector('[data-venter-paa-net]'), null, { timeout: 15000 })
    await page.waitForTimeout(1500)
    trin(`nettet tilbage: køen tømt; ${tabtSvar} INSERT fik sit svar tabt undervejs`)
    await shot('06-online-igen-sendt')

    // 6. Præcis én række pr. sæt.
    const rows = (await table('exercise_logs')).filter(r => r.athlete_id === ATHLETE_ID && r.exercise_id === EXERCISE_ID && !r.skipped)
    const prSaet = [1, 2, 3, 4].map(n => rows.filter(r => r.set_number === n).length)
    assert.deepEqual(prSaet, [1, 1, 1, 1], `præcis én række pr. sæt, fik ${JSON.stringify(prSaet)}`)
    for (const n of [2, 3, 4]) {
      const row = rows.find(r => r.set_number === n)
      assert.equal(row.id, koe[`${EXERCISE_ID}_${n}`].clientId, `sæt ${n} gemt med sit række-id`)
      assert.equal(Number(row.weight), Number(koe[`${EXERCISE_ID}_${n}`].payload.weight))
      assert.equal(Number(row.reps_completed), Number(koe[`${EXERCISE_ID}_${n}`].payload.reps_completed))
    }
    const onlineSkriv = skrivninger.slice(skrivFoerOnline)
    trin(`mocken: sæt 1-4 har hver præcis én række (${JSON.stringify(prSaet)}); ${onlineSkriv.filter(s => s.metode === 'POST').length} POST og ${onlineSkriv.filter(s => s.metode === 'PATCH').length} PATCH efter nettet kom (den ekstra POST er genforsøget efter det tabte svar, afvist som 23505 og lavet om til en PATCH af samme række)`)

    await context.unroute('**/rest/v1/exercise_logs*')
    await page.reload()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
    await page.waitForTimeout(1500)
    assert.equal(await page.locator('[data-ingen-forbindelse]').count(), 0, 'online og frisk: ingen offline-linje')
    assert.equal(await page.getByText('gemt lokalt', { exact: false }).count(), 0)
    trin('genindlæst online: ingen offline-linje, intet ventende')
    await shot('07-online-genindlaest')

    const resultat = { groen: true, trin: log, offlineStartMs, assetsCachet: assetsCachet.length, raekkerPrSaet: prSaet, skrivningerEfterOnline: onlineSkriv.map(s => s.metode), konsolFejl }
    writeFileSync(path.join(out, 'bevis.json'), JSON.stringify(resultat, null, 2) + '\n')
    console.log('GRØN: Dagens pas uden net, tre sæt logget, sendt én gang hver.')
  } catch (err) {
    await shot('fejl').catch(() => {})
    const lager = await page.evaluate(() => Object.keys(localStorage)).catch(() => null)
    konsolFejl.push('localStorage-noegler: ' + JSON.stringify(lager))
    konsolFejl.push('onLine: ' + await page.evaluate(() => navigator.onLine).catch(() => '?'))
    konsolFejl.push('tekst: ' + await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => '?'))
    writeFileSync(path.join(out, 'bevis.json'), JSON.stringify({ groen: false, trin: log, fejl: String(err?.stack || err), konsolFejl }, null, 2) + '\n')
    throw err
  } finally {
    await browser.close()
    server.close()
    await mock.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
