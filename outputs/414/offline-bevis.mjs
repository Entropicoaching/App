// ORDRE 414: kopi af outputs/406/offline-bevis.mjs, koert mod grenen
// dagens-pas-offline-4. Resultater og billeder under outputs/414/. Nyt scenarie:
//   fortryd-doer (O4 i docs/kritik-403): saet 2's INSERT naar frem til mocken,
//            men svaret hænger. Atleten trykker "Fortryd sidste saet", og appen
//            doer straks efter (siden lukkes). Koeen skal allerede have
//            sletningen. Appen aabnes igen med net: raekken slettes, saa mocken
//            ender med [1,0,0,0]. BEVIS_UD=<mappe> skriver et andet sted hen
//            (brugt til koerslen foer rettelsen).
// Kørsel: node outputs/414/offline-bevis.mjs [tid] [haenger] [fortryd-doer]
// Hovedet fra 406 foelger.
// ORDRE 406: kopi af outputs/401/offline-bevis.mjs, koert mod grenen
// dagens-pas-offline-3. Een aendring i haenger: siden O2 (docs/kritik-403) slaar
// appen et nyt saet op (GET) foer INSERT. Det foerste opslag slipper derfor
// igennem med svar, og saa er det INSERT'et der naar frem uden svar, som i 401.
// Uden den aendring hang opslaget, og INSERT'et blev aldrig sendt (se
// outputs/406/koersel-offline-bevis-401.log). Resultater: outputs/406/bevis-*.json.
// Original-hovedet foelger.
// ORDRE 401: offline-beviset fra 397 (outputs/397/offline-bevis.mjs),
// udvidet med ordrens to tilfælde. Headless Chromium 390x844 mod e2e-mocken
// (e2e/mock-supabase.mjs + buildSeed, aldrig prod), dist/ serveret lokalt med
// public/sw.js som i produktion.
//
//   tid:     397-forløbet (sæt 1 online, appen genåbnet uden net med udløbet
//            token, sæt 2-4 uden net, nettet tilbage med ét tabt svar). Nyt:
//            der går mindst 6 s fra sættene logges til de sendes, og hvert
//            sæt skal stå i mocken med tidspunktet for "Godkendt", ikke for
//            afsendelsen, i den rækkefølge de blev løftet.
//   haenger: wifi uden internet. Browseren melder online, men alle kald til
//            serveren hænger (ingen svar, ingen fejl). Det første INSERT når
//            dog frem til mocken (rækken oprettes), svaret gør ikke. Sæt 2
//            skal vises som "sendes når du har net" efter ca. 8 s, sæt 3 med
//            det samme uden at der forsøges et kald, og når nettet virker
//            igen, sendes køen af sig selv, med én række pr. sæt.
//
// Kørsel: node outputs/401/offline-bevis.mjs [tid] [haenger]  (uden argument: begge)
//   -> outputs/401/<scenarie>/*.png + outputs/401/bevis-<scenarie>.json
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = path.join(HERE, '..', '..')
const DIST = path.join(ROOT, 'dist')
// ORDRE 406: resultater og billeder under outputs/406/, ikke 401's mappe.
const UD = process.env.BEVIS_UD ? path.resolve(process.env.BEVIS_UD) : path.join(ROOT, 'outputs', '414')
const MOCK_PORT = Number(process.env.BEVIS_MOCK_PORT || 8998)
const MOCK_KEY = 'mock-anon-key-bevis-401'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
const ALLE = ['tid', 'haenger', 'fortryd-doer']

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
      filePath = path.join(DIST, 'index.html')
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(readFileSync(filePath))
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

// Fælles: log ind online, lad service workeren tage kontrol, og log sæt 1.
async function onlineSaet1({ page, mockUrl, trin, shot, ATHLETE_USER }) {
  await page.goto(page.__origin)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service workeren skal styre siden')
  await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await page.waitForFunction(async ([u]) => (await (await fetch(`${u}/__e2e/table?name=exercise_logs`)).json()).filter(r => !r.skipped).length >= 1, [mockUrl], { timeout: 15000 })
  await page.getByText('Sæt 2/4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForFunction(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('entropi_offline_pas:'))
    const s = k && JSON.parse(localStorage.getItem(k))
    return s && s.week && (s.logs || []).length >= 1
  }, null, { timeout: 15000 })
  trin('online: logget ind, service worker styrer siden, sæt 1 logget og gemt i mocken')
  await shot('01-online-saet-1')
}

async function scenarieTid({ page, context, mockUrl, table, trin, shot, fx, resultat }) {
  const { ATHLETE_ID, EXERCISE_ID } = fx
  const koeNoegle = `entropi_offline_sets:${ATHLETE_ID}`
  const skrivninger = []
  context.on('request', (r) => {
    if (r.url().includes('/rest/v1/exercise_logs') && ['POST', 'PATCH', 'DELETE'].includes(r.method())) skrivninger.push({ metode: r.method(), body: r.postData() })
  })
  await onlineSaet1({ page, mockUrl, trin, shot, ATHLETE_USER: fx.ATHLETE_USER })

  // Nettet væk, token udløbet, appen dræbt og åbnet igen (som 397).
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
    const s = JSON.parse(localStorage.getItem(k))
    s.expires_at = Math.floor(Date.now() / 1000) - 60
    localStorage.setItem(k, JSON.stringify(s))
  })
  await context.setOffline(true)
  await page.reload()
  await page.getByText('Sæt 2/4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  assert.equal(await page.locator('#athlete-auth-email').count(), 0, 'ingen login-skærm uden net')
  trin('uden net: appen genåbnet med udløbet token, Dagens pas vist fra telefonen (sæt 2/4)')

  // Sæt 2-4 uden net, med 1,5 s mellem hvert (som pauser i kælderen, bare kortere).
  const godkendtKl = {}
  for (const n of [2, 3, 4]) {
    await page.getByText(`Sæt ${n}/4`, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
    godkendtKl[n] = await page.evaluate(() => Date.now())
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await page.waitForFunction(([k, key]) => key in JSON.parse(localStorage.getItem(k) || '{}'), [koeNoegle, `${EXERCISE_ID}_${n}`])
    await page.waitForTimeout(1500)
  }
  await page.getByText('3 sæt gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  const koe = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), koeNoegle)
  for (const n of [2, 3, 4]) {
    const tid = koe[`${EXERCISE_ID}_${n}`].payload.logged_at
    assert.ok(tid, `sæt ${n}: køposten har logged_at`)
    assert.ok(Math.abs(Date.parse(tid) - godkendtKl[n]) < 1500, `sæt ${n}: logged_at er tidspunktet for "Godkendt"`)
  }
  trin(`uden net: sæt 2, 3, 4 logget; hver køpost bærer tidspunktet for "Godkendt" (${[2, 3, 4].map(n => koe[`${EXERCISE_ID}_${n}`].payload.logged_at.slice(11, 19)).join(', ')} UTC)`)
  await shot('02-offline-tre-venter')

  // Atleten går op ad trappen: der går tid, før nettet er der.
  await page.waitForTimeout(6000)

  // Nettet tilbage; første INSERT får sit svar "tabt" (som 397).
  let tabtSvar = 0
  await context.route('**/rest/v1/exercise_logs*', async (route) => {
    const r = route.request()
    if (r.method() === 'POST' && tabtSvar === 0) { tabtSvar++; await route.fetch(); return route.abort('failed') }
    return route.continue()
  })
  const sendtFra = await page.evaluate(() => Date.now())
  await context.setOffline(false)
  await page.waitForFunction((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length === 0, koeNoegle, { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('[data-venter-paa-net]'), null, { timeout: 15000 })
  await context.unroute('**/rest/v1/exercise_logs*')
  trin(`nettet tilbage: køen tømt; ${tabtSvar} INSERT fik sit svar tabt undervejs`)
  await shot('03-online-sendt')

  const rows = (await table('exercise_logs')).filter(r => r.athlete_id === ATHLETE_ID && r.exercise_id === EXERCISE_ID && !r.skipped)
  const prSaet = [1, 2, 3, 4].map(n => rows.filter(r => r.set_number === n).length)
  assert.deepEqual(prSaet, [1, 1, 1, 1], `præcis én række pr. sæt, fik ${JSON.stringify(prSaet)}`)
  const tider = {}
  for (const n of [2, 3, 4]) {
    const row = rows.find(r => r.set_number === n)
    tider[n] = row.logged_at
    assert.equal(row.id, koe[`${EXERCISE_ID}_${n}`].clientId, `sæt ${n} gemt med sit række-id`)
    assert.equal(row.logged_at, koe[`${EXERCISE_ID}_${n}`].payload.logged_at, `sæt ${n}: mocken har tiden fra "Godkendt"`)
    assert.ok(sendtFra - Date.parse(row.logged_at) >= 6000, `sæt ${n}: logged_at ligger før afsendelsen`)
  }
  // Coachens visning (dashboard/laesninger.js fetchAthleteLogs) og atletens
  // historik sorterer på logged_at; her samme sortering af mockens rækker.
  const coachOrden = [...rows].sort((a, b) => b.logged_at.localeCompare(a.logged_at)).map(r => r.set_number)
  assert.deepEqual(coachOrden, [4, 3, 2, 1], 'nyeste først efter logged_at = omvendt løfterækkefølge')
  const ventetid = Math.round((sendtFra - Date.parse(tider[2])) / 1000)
  trin(`mocken: én række pr. sæt ${JSON.stringify(prSaet)}; sæt 2 blev godkendt ${ventetid} s før nettet kom og står med godkendt-tiden; sorteret på logged_at (nyeste først) er rækkefølgen ${JSON.stringify(coachOrden)}`)
  Object.assign(resultat, { raekkerPrSaet: prSaet, loggedAt: tider, sendtFra: new Date(sendtFra).toISOString(), ventetidSaet2S: ventetid, coachOrden, skrivninger: skrivninger.map(s => s.metode) })
}

async function scenarieHaenger({ page, context, mockUrl, table, trin, shot, fx, resultat }) {
  const { ATHLETE_ID, EXERCISE_ID } = fx
  const koeNoegle = `entropi_offline_sets:${ATHLETE_ID}`
  await onlineSaet1({ page, mockUrl, trin, shot, ATHLETE_USER: fx.ATHLETE_USER })

  // Wifi uden internet: alt hænger, men det første INSERT af et sæt når frem.
  let haenger = true
  let slip
  const sluppet = new Promise((r) => { slip = r })
  let naaedeFrem = 0
  let opslagSluppet = 0
  const saetPost = { 2: 0, 3: 0 }
  await context.route(`${mockUrl}/**`, async (route) => {
    if (!haenger) return route.continue().catch(() => {})
    const r = route.request()
    // ORDRE 406: saet 2's opslag (GET exercise_logs?set_number=eq.2) faar sit svar.
    if (opslagSluppet === 0 && r.method() === 'GET' && r.url().includes('/rest/v1/exercise_logs') && r.url().includes('set_number=eq.2')) {
      opslagSluppet++
      const svar = await route.fetch().catch(() => null)
      return svar ? route.fulfill({ response: svar }).catch(() => {}) : route.abort('failed').catch(() => {})
    }
    if (r.method() === 'POST' && r.url().includes('/rest/v1/exercise_logs')) {
      const n = JSON.parse(r.postData() || '{}').set_number
      if (n in saetPost) saetPost[n]++
      if (naaedeFrem === 0) { naaedeFrem++; await route.fetch().catch(() => {}) }
    }
    await sluppet
    return route.abort('failed').catch(() => {})
  })
  assert.equal(await page.evaluate(() => navigator.onLine), true, 'browseren tror den er online')

  // Sæt 2: kaldet hænger; efter ca. 8 s regnes det som offline.
  await page.getByText('Sæt 2/4', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  const godkendt2 = await page.evaluate(() => Date.now())
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await page.getByText('Sæt 3/4', { exact: true }).waitFor({ state: 'visible', timeout: 3000 })
  await page.getByText('1 sæt gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 20000 })
  const markering2Ms = Date.now() - godkendt2
  assert.ok(markering2Ms >= 7000 && markering2Ms <= 10500, `sæt 2 skal vises som ventende efter ca. 8 s, tog ${markering2Ms} ms`)
  assert.equal(naaedeFrem, 1, 'det første INSERT nåede frem til mocken')
  trin(`wifi uden internet (navigator.onLine=true): sæt 2 gik videre til sæt 3 med det samme og blev vist som "gemt lokalt" efter ${markering2Ms} ms; dets INSERT nåede mocken, svaret kom aldrig`)
  await shot('02-haenger-saet-2-venter')

  // Sæt 3: nettet er kendt dødt, så intet kald, markering med det samme.
  const godkendt3 = await page.evaluate(() => Date.now())
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await page.getByText('2 sæt gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  const markering3Ms = Date.now() - godkendt3
  assert.ok(markering3Ms < 2000, `sæt 3 skal vises som ventende med det samme, tog ${markering3Ms} ms`)
  await page.waitForTimeout(1000)
  assert.equal(saetPost[3], 0, 'sæt 3: intet kald forsøgt, mens nettet er kendt dødt')
  await page.getByRole('button', { name: /klarede sæt/ }).first().click()
  await page.locator('[data-venter-paa-net="1"]').first().waitFor({ state: 'visible', timeout: 5000 })
  const markeringer = await page.locator('[data-venter-paa-net="1"]').count()
  assert.equal(markeringer, 2, 'sæt 2 og 3 viser "sendes når du har net"')
  trin(`sæt 3: vist som ventende efter ${markering3Ms} ms uden noget kald; sæt 2 og 3 har hver "sendes når du har net"`)
  await shot('03-haenger-to-venter')
  const koe = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), koeNoegle)
  assert.deepEqual(Object.keys(koe).sort(), [2, 3].map(n => `${EXERCISE_ID}_${n}`).sort())
  assert.equal((await table('exercise_logs')).filter(r => r.set_number === 2 && !r.skipped).length, 1, 'mocken har allerede sæt 2 (det hængende INSERT nåede frem)')

  // Nettet virker igen. Ingen 'online'-event (browseren var aldrig offline);
  // køen prøver selv igen (hvert 20. s) og opdager det.
  haenger = false
  slip()
  const tilbage = Date.now()
  await page.waitForFunction((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length === 0, koeNoegle, { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('[data-venter-paa-net]'), null, { timeout: 15000 })
  const sendtEfterMs = Date.now() - tilbage
  await context.unroute(`${mockUrl}/**`)
  trin(`nettet virker igen: køen sendt af sig selv efter ${sendtEfterMs} ms, markeringerne væk`)
  await shot('04-haenger-sendt')

  const rows = (await table('exercise_logs')).filter(r => r.athlete_id === ATHLETE_ID && r.exercise_id === EXERCISE_ID && !r.skipped)
  const prSaet = [1, 2, 3, 4].map(n => rows.filter(r => r.set_number === n).length)
  assert.deepEqual(prSaet, [1, 1, 1, 0], `præcis én række for sæt 1-3, fik ${JSON.stringify(prSaet)}`)
  for (const n of [2, 3]) {
    const row = rows.find(r => r.set_number === n)
    assert.equal(row.id, koe[`${EXERCISE_ID}_${n}`].clientId, `sæt ${n} gemt med sit række-id`)
    assert.equal(row.logged_at, koe[`${EXERCISE_ID}_${n}`].payload.logged_at, `sæt ${n} har tiden fra "Godkendt"`)
  }
  trin(`mocken: én række pr. sæt ${JSON.stringify(prSaet)}; sæt 2, hvis første INSERT nåede frem, er ikke dubleret; sæt 2 og 3 har deres række-id og godkendt-tid`)
  Object.assign(resultat, { markering2Ms, markering3Ms, sendtEfterMs, raekkerPrSaet: prSaet, insertForsoegUnderHaeng: saetPost })
}

// ORDRE 414 (O4): fortryd, mens saettets INSERT haenger, og appen doer lige efter.
async function scenarieFortrydDoer({ page, context, mockUrl, table, trin, shot, fx, resultat }) {
  const { ATHLETE_ID, EXERCISE_ID } = fx
  const koeNoegle = `entropi_offline_sets:${ATHLETE_ID}`
  const noegle2 = `${EXERCISE_ID}_2`
  await onlineSaet1({ page, mockUrl, trin, shot, ATHLETE_USER: fx.ATHLETE_USER })

  // Saet 2's INSERT naar frem til mocken, svaret kommer aldrig (siden doer foerst).
  let insertNaaede = 0
  await context.route('**/rest/v1/exercise_logs*', async (route) => {
    const r = route.request()
    if (r.method() === 'POST' && JSON.parse(r.postData() || '{}').set_number === 2) {
      insertNaaede++
      await route.fetch().catch(() => {})
      return new Promise(() => {})
    }
    return route.continue().catch(() => {})
  })
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await page.waitForFunction(async ([u]) => (await (await fetch(`${u}/__e2e/table?name=exercise_logs`)).json()).some(r => r.set_number === 2 && !r.skipped), [mockUrl], { timeout: 15000 })
  const clientId = await page.evaluate(([k, n]) => JSON.parse(localStorage.getItem(k) || '{}')[n]?.clientId, [koeNoegle, noegle2])
  trin(`saet 2: INSERT naaede mocken (${insertNaaede} gang), svaret haenger; koeposten har raekke-id`)
  await shot('02-fortryd-saet-2-haenger')

  await page.getByRole('button', { name: /Fortryd sidste sæt/ }).first().click()
  // Ingen ventetid: koeen skal have sletningen i samme oejeblik.
  const koeEfterFortryd = await page.evaluate(([k, n]) => JSON.parse(localStorage.getItem(k) || '{}')[n] || null, [koeNoegle, noegle2])
  await shot('03-fortryd-trykket')
  trin(`fortryd trykket; koeens post for saet 2 lige efter: ${JSON.stringify(koeEfterFortryd && { op: koeEfterFortryd.op || 'saet', sammeId: koeEfterFortryd.clientId === clientId })}`)
  const raekkerFoerDoed = (await table('exercise_logs')).filter(r => r.set_number === 2 && !r.skipped).length

  // Appen doer: siden lukkes, mens INSERT'et stadig haenger.
  await page.close({ runBeforeUnload: false })
  await context.unroute('**/rest/v1/exercise_logs*')
  trin(`appen doer (siden lukket) med saet 2's raekke stadig i mocken (${raekkerFoerDoed})`)

  const side2 = await context.newPage()
  await side2.goto(page.__origin)
  await side2.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  let koeTom = true
  try {
    await side2.waitForFunction((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length === 0, koeNoegle, { timeout: 30000 })
  } catch { koeTom = false }
  await side2.waitForTimeout(1500)
  await side2.screenshot({ path: path.join(UD, 'bevis-fortryd-doer', '04-genaabnet.png') })
  const rows = (await table('exercise_logs')).filter(r => r.athlete_id === ATHLETE_ID && r.exercise_id === EXERCISE_ID && !r.skipped)
  const prSaet = [1, 2, 3, 4].map(n => rows.filter(r => r.set_number === n).length)
  trin(`appen aabnet igen med net: koeen ${koeTom ? 'toem' : 'IKKE toem'}; mocken ${JSON.stringify(prSaet)}`)
  Object.assign(resultat, { insertNaaede, koeEfterFortryd: koeEfterFortryd && { op: koeEfterFortryd.op || null, sammeId: koeEfterFortryd.clientId === clientId }, raekkerFoerDoed, koeTom, raekkerPrSaet: prSaet })
  assert.equal(koeEfterFortryd?.op, 'delete', 'koeen skal have sletningen i det oejeblik der trykkes fortryd')
  assert.equal(koeEfterFortryd?.clientId, clientId, 'sletningen er paa saettets raekke-id')
  assert.ok(koeTom, 'koeen toemmes efter genaabning')
  assert.deepEqual(prSaet, [1, 0, 0, 0], `det fortrudte saet 2 skal vaere slettet, fik ${JSON.stringify(prSaet)}`)
}

const SCENARIER = { tid: scenarieTid, haenger: scenarieHaenger, 'fortryd-doer': scenarieFortrydDoer }

async function koer(navn, { chromium, createMockSupabase, fx }) {
  const mock = createMockSupabase(fx.buildSeed())
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  const table = async (name) => (await fetch(`${mockUrl}/__e2e/table?name=${name}`)).json()
  const { server, port } = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  page.__origin = `http://127.0.0.1:${port}/`
  const konsolFejl = []
  page.on('pageerror', (e) => konsolFejl.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to fetch|AbortError|signal is aborted/.test(m.text())) konsolFejl.push(m.text().slice(0, 300)) })
  const out = path.join(UD, `bevis-${navn}`)
  mkdirSync(out, { recursive: true })
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) })
  const log = []
  const trin = (t) => { console.log(`  [${navn}] ${t}`); log.push(t) }
  const resultat = {}
  try {
    await SCENARIER[navn]({ page, context, mockUrl, table, trin, shot, fx, resultat })
    writeFileSync(path.join(UD, `bevis-${navn}.json`), JSON.stringify({ groen: true, trin: log, ...resultat, konsolFejl }, null, 2) + '\n')
    console.log(`GRØN: ${navn}`)
  } catch (err) {
    await shot('fejl').catch(() => {})
    konsolFejl.push('tekst: ' + await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => '?'))
    writeFileSync(path.join(UD, `bevis-${navn}.json`), JSON.stringify({ groen: false, trin: log, fejl: String(err?.stack || err), konsolFejl }, null, 2) + '\n')
    throw err
  } finally {
    await browser.close()
    server.close()
    await mock.close()
  }
}

async function main() {
  const valgt = process.argv.slice(2).filter(a => ALLE.includes(a))
  const koerDisse = valgt.length ? valgt : ALLE
  const { createRequire } = await import('node:module')
  const { homedir } = await import('node:os')
  const require = createRequire(import.meta.url)
  const { chromium } = require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const fx = await import('../../e2e/fixtures.mjs')
  console.log('Bygger mod mocken ...')
  const build = spawnSync('npm run build', { cwd: ROOT, stdio: 'ignore', shell: true, env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, VITE_SUPABASE_KEY: MOCK_KEY } })
  if (build.status !== 0) throw new Error('build fejlede')
  for (const navn of koerDisse) await koer(navn, { chromium, createMockSupabase, fx })
}

main().catch((e) => { console.error(e); process.exit(1) })
