// ORDRE 2367v (Marc 25. nov., ugeplanens målstreg 3: "Send som atlet og som coach virker hver gang"):
// samme sendvej som video-send-1952.spec.mjs (videolager-worker i denne proces, mock uden RLS), men
// med Playwright-ruter, der giver fejl undervejs. Fem tilfælde, hver som atlet og som coach:
//   a  nettet falder midt i upload (PUT til lageret afbrydes, og alt net er væk, til atleten trykker Prøv igen)
//   b  workeren svarer 500 på /upload-url én gang
//   c  10 s forsinkelse på PUT til lageret
//   d  dobbelttryk på Send
//   e  siden lukkes, mens klippet sendes, og åbnes igen i samme browser (samme login)
// Kriteriet pr. tilfælde: klippet lander præcis én gang (én række, ét klip), eller brugeren ser
// "Ikke sendt · Prøv igen" med en Prøv igen-knap, og et tryk på den lander klippet én gang.
//
// ORDRE 2399v (fund 2, 3 og 4 i plan\2367v\TJEK.md): teksterne skal sige den rigtige fejl.
//   a  årsagen ved netfald er lagerets danske "Forbindelsen blev afbrudt. Prøv igen"; intet engelsk
//      "Failed to fetch", og coachen får ikke login-teksten for en netfejl
//   f  lager og reserve svarer 403 (login-afvisning): coachen får login-teksten, atleten den rene årsag
//   g  appen svarer først efter grænsen på 10 minutter (uret er forkortet 100 gange i browseren):
//      teksten siger, at videoen muligvis stadig sendes, og at man skal vente før Prøv igen.
//      Mocken har ingen unik client_analysis_id (2367v fund 5), så g trykker ikke Prøv igen; klippet
//      skal alligevel lande præcis én gang, fordi appen sender færdig.
//
// Kørsel: node e2e/video-send-2367v.spec.mjs   (E2E_VITE_PORT, E2E_MOCK_PORT, VITE_SUPABASE_URL,
// E2E_LAGER_PORT og OUT_2367V kan sættes; CASES_2367V=a,b vælger tilfælde; WHO_2367V=atlet vælger rolle.)

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { calibrateAthlete, CLICK_AT_S } from './athlete-film-et-saet.mjs'
import { handleVideolager } from '../src/videolager/worker.js'

const NOTE = 'god dybde i bunden'
const LAGER_PORT = Number(process.env.E2E_LAGER_PORT || 8995)
const CASES = {
  a: 'nettet falder midt i upload',
  b: 'workeren svarer 500 én gang',
  c: '10 s forsinkelse',
  d: 'dobbelttryk på Send',
  e: 'siden lukkes og åbnes under upload',
  f: '403 fra lager og reserve (login-afvisning)',
  g: 'appen svarer først efter 10 minutter (forkortet ur)',
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
// ORDRE 2399v: forkortet ur til tilfælde g. Timere på 10 minutter eller mere kører 100 gange hurtigere
// i alle rammer (iframen med videocoach.html også), så grænsen i vcV3RequestUploadAndGoRaw rammes efter 6 s.
const FORKORTET_UR = `(() => {
  const original = window.setTimeout
  window.setTimeout = function (fn, ms, ...args) {
    return original.call(window, fn, typeof ms === 'number' && ms >= 600000 ? Math.round(ms / 100) : ms, ...args)
  }
})()`
const LOGIN_TEKST = /logget ind som coach/
const ENGELSK = /Failed to fetch|NetworkError|Load failed|fetch failed/i

function memoryBucket() {
  const store = new Map()
  return {
    store,
    async head(key) { return store.has(key) ? { size: store.get(key).length } : null },
    async put(key, body) { store.set(key, new Uint8Array(await new Response(body).arrayBuffer())) },
    async get(key) { const b = store.get(key); return b ? { size: b.length, body: b, httpMetadata: { contentType: 'video/mp4' } } : null },
  }
}

function startLager(env) {
  const server = createServer(async (req, res) => {
    try {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const body = chunks.length ? Buffer.concat(chunks) : undefined
      const request = new Request(`http://127.0.0.1:${LAGER_PORT}${req.url}`, { method: req.method, headers: req.headers,
        body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body })
      const response = await handleVideolager(request, env)
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (err) {
      // En afbrudt forbindelse (siden lukket) må ikke vælte lageret.
      try { res.writeHead(500); res.end() } catch {}
    }
  })
  return new Promise(resolve => server.listen(LAGER_PORT, '127.0.0.1', () => resolve(server)))
}

// Ruten, der giver fejl. `fault` ændres af hvert tilfælde; `counts` tæller kald på sendvejen.
function installFaultRoute(page, fault, counts) {
  const isLager = url => url.includes(`127.0.0.1:${LAGER_PORT}/`)
  const isMock = url => url.includes(`127.0.0.1:${MOCK_PORT}/`)
  return page.route(url => isLager(url.href) || isMock(url.href), async route => {
    const req = route.request()
    const url = req.url(), method = req.method()
    const cors = { 'access-control-allow-origin': req.headers().origin || '*' }
    try {
      if (isLager(url) && url.endsWith('/upload-url') && method === 'POST') {
        counts.uploadUrl++
        if (fault.worker500Left > 0) {
          fault.worker500Left--
          return await route.fulfill({ status: 500, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'Videolageret svarede ikke' }) })
        }
        // Workerens egen 403-tekst (src/videolager/worker.js), som hvis coachen ikke måtte sende.
        if (fault.forbudt) return await route.fulfill({ status: 403, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'Du kan kun sende video for dig selv eller en atlet, du coacher' }) })
      }
      if (isLager(url) && url.includes('/blob/') && method === 'PUT') {
        counts.blobPut++
        if (fault.offlineAtPut) { fault.offlineAtPut = false; fault.offline = true }
        if (fault.delayMs) await sleep(fault.delayMs)
      }
      if (isMock(url) && url.includes('/storage/v1/object/') && (method === 'POST' || method === 'PUT')) {
        counts.reservePut++
        // Supabase Storage afviser RLS med HTTP 400 og statusCode "403" i kroppen (mocken har ingen RLS).
        if (fault.forbudt) return await route.fulfill({ status: 400, headers: cors, contentType: 'application/json',
          body: JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }) })
      }
      if (isMock(url) && url.includes('/rest/v1/video_analyses') && method === 'POST') counts.rowInsert++
      if (fault.offline) return await route.abort('internetdisconnected')
      return await route.continue()
    } catch { /* siden kan være lukket, mens ruten ventede */ }
  })
}

async function login(context, who) {
  const page = await context.newPage()
  const user = who === 'coach' ? COACH_USER : ATHLETE_USER
  await page.goto(APP_URL)
  const email = page.locator('#athlete-auth-email')
  if (await email.count() > 0 && await email.isVisible().catch(() => false)) {
    await email.fill(user.email)
    await page.locator('#athlete-auth-password').fill(user.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
  }
  await tilAtletvisning(page, who)
  return page
}

// Coachen træner på sin egen profil (ordre 1610v): seedens atlet har coach_id = coachen.
async function tilAtletvisning(page, who) {
  if (who !== 'coach') return
  await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).waitFor({ state: 'visible', timeout: 15000 })
  const remembered = await page.evaluate(() => localStorage.getItem('entropi_my_athlete_id'))
  if (remembered !== ATHLETE_ID) {
    await page.evaluate(id => { localStorage.setItem('entropi_my_athlete_id', id) }, ATHLETE_ID)
    await page.reload()
    await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).waitFor({ state: 'visible', timeout: 15000 })
  }
  const minKnap = page.getByRole('button', { name: /^(⚡ )?Min træning$/i })
  if (await minKnap.count() > 0) await minKnap.first().click()
  else await page.getByText('Min træning', { exact: true }).first().click()
  await page.getByRole('button', { name: /Til coachportalen|← Coach view/ }).waitFor({ state: 'visible', timeout: 10000 })
}

// Hjem, "Mere i dag", "Film et sæt til videocoach", tegnet klip, start, skive, notat; stopper lige før Send.
async function filmTilKlar(page, clipPath) {
  await page.getByText('Mere i dag', { exact: true }).click({ timeout: 15000 })
  await page.getByText('Film et sæt til videocoach', { exact: true }).click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
  await frame.locator('#fileInput').setInputFiles(clipPath)
  await frame.locator('body[data-athlete-state="ready"]').waitFor({ state: 'attached', timeout: 15000 })
  await frame.locator('#vcAthleteLift').selectOption({ label: 'Squat' })
  await frame.locator('video').first().evaluate((v, t) => new Promise(resolve => {
    v.addEventListener('seeked', resolve, { once: true }); v.currentTime = t
  }), CLICK_AT_S)
  await frame.locator('#athleteMarkStartBtn').click()
  const canvas = frame.locator('#canvas')
  const box = await canvas.boundingBox()
  await page.waitForTimeout(300)
  assert.ok(await calibrateAthlete(frame, page, canvas, box), 'skiven blev ikke fundet')
  await frame.locator('body[data-athlete-state="done"]').waitFor({ state: 'attached', timeout: 90000 })
  await frame.locator('#athleteInstantResult').waitFor({ state: 'visible', timeout: 5000 })
  await frame.locator('#athleteNoteInput').click()
  await page.keyboard.type(NOTE, { delay: 30 })
  return frame
}

const retryButton = frame => frame.locator('#vcUploadRetryStatus button')

// Venter på sendt, eller på at Prøv igen-knappen står frem.
async function ventPaaUdfald(frame, timeout = 60000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const state = await frame.locator('body').evaluate(b => b.dataset.athleteState).catch(() => null)
    if (state === 'sent') return 'sent'
    const knap = retryButton(frame)
    if (await knap.count() > 0 && await knap.isVisible().catch(() => false)) return 'retry'
    await sleep(250)
  }
  return 'timeout'
}

async function skaerm(frame) {
  const text = async sel => (await frame.locator(sel).innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 400)
  return {
    state: await frame.locator('body').evaluate(b => b.dataset.athleteState).catch(() => null),
    status: await text('#athleteStatus'),
    panel: await text('#vcUploadRetryStatus'),
    sendKnap: await text('#athleteInstantSaveBtn'),
  }
}

async function main() {
  const out = process.env.OUT_2367V || join(OUT_DIR, '2367v')
  mkdirSync(out, { recursive: true })
  const wantedCases = (process.env.CASES_2367V || 'a,b,c,d,e,f,g').split(',').map(s => s.trim()).filter(Boolean)
  const wantedWho = (process.env.WHO_2367V || 'atlet,coach').split(',').map(s => s.trim()).filter(Boolean)
  const { path: clipPath } = ensureCoachSporingClip('glat')
  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  const lagerEnv = { VIDEO: memoryBucket(), SUPABASE_URL: mockUrl, SUPABASE_PUBLISHABLE_KEY: 'e2e-offentlig',
    ALLOWED_ORIGINS: APP_URL.replace(/\/$/, '') }
  const lager = await startLager(lagerEnv)
  process.env.VITE_VIDEOLAGER_URL = `http://127.0.0.1:${LAGER_PORT}`
  const vite = await startVite()
  const browser = await launchBrowser()
  console.log(`egne processer: node ${process.pid}, vite ${vite.child.pid}`)
  const results = []
  const rowsFor = async () => (await (await fetch(`${mockUrl}/__e2e/table?name=video_analyses`)).json())
    .filter(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
  const supabaseKeys = async () => (await fetch(`${mockUrl}/__e2e/storage-keys`)).json()

  try {
    for (const who of wantedWho) {
      for (const id of wantedCases) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
        const errors = []
        const fault = { offline: false, offlineAtPut: false, worker500Left: 0, delayMs: 0, forbudt: false }
        const counts = { uploadUrl: 0, blobPut: 0, reservePut: 0, rowInsert: 0 }
        const before = (await rowsFor()).map(r => r.id)
        const r = { who, case: id, titel: CASES[id], counts, errors }
        const t0 = Date.now()
        try {
          if (id === 'g') await context.addInitScript(FORKORTET_UR)
          let page = await login(context, who)
          page.on('pageerror', err => errors.push(err.message))
          await installFaultRoute(page, fault, counts)
          let frame = await filmTilKlar(page, clipPath)
          const send = frame.locator('#athleteInstantSaveBtn')

          if (id === 'a') {
            fault.offlineAtPut = true
            await send.click()
            r.udfald1 = await ventPaaUdfald(frame)
            r.skaerm1 = await skaerm(frame)
            await page.screenshot({ path: join(out, `${who}-a-fejl.png`) })
            r.raekkerEfterFejl = (await rowsFor()).filter(x => !before.includes(x.id)).length
            fault.offline = false
            assert.equal(r.udfald1, 'retry', `${who} a: ingen Prøv igen efter netfald (${JSON.stringify(r.skaerm1)})`)
            // ORDRE 2399v fund 2 og 3: årsagen er lagerets danske tekst, ikke reservens engelske, og en
            // netfejl kaldes ikke en login-fejl for coachen.
            r.tekstFund = []
            if (ENGELSK.test(r.skaerm1.panel)) r.tekstFund.push('engelsk fejltekst i årsagen')
            if (!/Forbindelsen blev afbrudt/.test(r.skaerm1.panel)) r.tekstFund.push('årsagen siger ikke "Forbindelsen blev afbrudt"')
            if (LOGIN_TEKST.test(r.skaerm1.panel)) r.tekstFund.push('netfejl kaldes login-fejl')
            await retryButton(frame).click()
            r.udfald2 = await ventPaaUdfald(frame)
            r.skaerm2 = await skaerm(frame)
          } else if (id === 'f') {
            fault.forbudt = true
            await send.click()
            r.udfald1 = await ventPaaUdfald(frame)
            r.skaerm1 = await skaerm(frame)
            await page.screenshot({ path: join(out, `${who}-f-fejl.png`) })
            fault.forbudt = false
            assert.equal(r.udfald1, 'retry', `${who} f: ingen Prøv igen efter 403 (${JSON.stringify(r.skaerm1)})`)
            r.tekstFund = []
            if (who === 'coach' && !LOGIN_TEKST.test(r.skaerm1.panel)) r.tekstFund.push('coachen får ikke login-teksten ved 403')
            if (who !== 'coach' && LOGIN_TEKST.test(r.skaerm1.panel)) r.tekstFund.push('atleten får login-teksten')
            if (!/Årsag:/.test(r.skaerm1.panel)) r.tekstFund.push('ingen årsag')
            await retryButton(frame).click()
            r.udfald2 = await ventPaaUdfald(frame)
            r.skaerm2 = await skaerm(frame)
          } else if (id === 'g') {
            fault.delayMs = 15000
            await send.click()
            r.udfald1 = await ventPaaUdfald(frame, 30000)
            r.skaerm1 = await skaerm(frame)
            await page.screenshot({ path: join(out, `${who}-g-graense.png`) })
            assert.equal(r.udfald1, 'retry', `${who} g: grænsen på 10 minutter (forkortet) gav ikke Prøv igen (${JSON.stringify(r.skaerm1)})`)
            // ORDRE 2399v fund 4: teksten siger, at videoen muligvis stadig sendes, og at man skal vente.
            r.tekstFund = []
            if (!/muligvis stadig/.test(r.skaerm1.panel)) r.tekstFund.push('teksten siger ikke, at videoen muligvis stadig sendes')
            if (!/vent/i.test(r.skaerm1.panel)) r.tekstFund.push('teksten beder ikke om at vente før Prøv igen')
            // Appen sender færdig i baggrunden; klippet skal lande én gang uden tryk på Prøv igen.
            const t1 = Date.now()
            while (counts.rowInsert < 1 && Date.now() - t1 < 30000) await sleep(250)
            await sleep(1000)
            r.udfald2 = 'retry'
          } else if (id === 'b') {
            fault.worker500Left = 1
            await send.click()
            r.udfald1 = await ventPaaUdfald(frame)
            r.skaerm1 = await skaerm(frame)
            if (r.udfald1 === 'retry') {
              await retryButton(frame).click()
              r.udfald2 = await ventPaaUdfald(frame)
              r.skaerm2 = await skaerm(frame)
            }
          } else if (id === 'c') {
            fault.delayMs = 10000
            await send.click()
            await sleep(3000)
            r.skaermUndervejs = await skaerm(frame)
            await page.screenshot({ path: join(out, `${who}-c-undervejs.png`) })
            r.udfald1 = await ventPaaUdfald(frame, 90000)
            r.skaerm1 = await skaerm(frame)
            r.sekunder = Math.round((Date.now() - t0) / 1000)
          } else if (id === 'd') {
            // To tryk lige efter hinanden (som en utålmodig tommelfinger) og derefter et tredje, mens den sender.
            await send.dblclick()
            await sleep(400)
            await send.click({ force: true, timeout: 2000 }).catch(() => {})
            r.udfald1 = await ventPaaUdfald(frame)
            r.skaerm1 = await skaerm(frame)
          } else if (id === 'e') {
            fault.delayMs = 20000
            await send.click()
            const t1 = Date.now()
            while (counts.blobPut < 1 && Date.now() - t1 < 20000) await sleep(100)
            await sleep(500)
            r.skaermFoerLuk = await skaerm(frame)
            await page.close()
            r.raekkerEfterLuk = (await rowsFor()).filter(x => !before.includes(x.id)).length
            // Åbnes igen i samme browser: samme login.
            page = await context.newPage()
            page.on('pageerror', err => errors.push(err.message))
            await page.goto(APP_URL)
            await tilAtletvisning(page, who)
            const advarsel = page.getByText(/muligvis afbrudt/)
            r.advarselVedGenaabning = await advarsel.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
            r.advarselTekst = r.advarselVedGenaabning ? (await advarsel.first().innerText()).replace(/\s+/g, ' ').slice(0, 200) : ''
            await page.screenshot({ path: join(out, `${who}-e-genaabnet.png`) })
            // Brugeren filmer og sender igen.
            await installFaultRoute(page, { offline: false, worker500Left: 0, delayMs: 0 }, counts)
            frame = await filmTilKlar(page, clipPath)
            await frame.locator('#athleteInstantSaveBtn').click()
            r.udfald2 = await ventPaaUdfald(frame)
            r.skaerm2 = await skaerm(frame)
          }
          await page.screenshot({ path: join(out, `${who}-${id}-slut.png`) }).catch(() => {})
        } catch (err) {
          r.fejl = err.message
        }
        const nye = (await rowsFor()).filter(x => !before.includes(x.id))
        r.raekker = nye.length
        r.klientIdUnikke = new Set(nye.map(x => x.client_analysis_id)).size
        r.iLager = nye.filter(x => lagerEnv.VIDEO.store.has(x.video_path)).length
        const keys = await supabaseKeys()
        r.iReserve = nye.filter(x => keys.includes(`videocoach-uploads/${x.video_path}`)).length
        r.notat = nye.every(x => x.session_context?.athlete_note === NOTE)
        r.sekunder = Math.round((Date.now() - t0) / 1000)
        results.push(r)
        console.log(`${who} ${id}: ${JSON.stringify({ ...r, errors: errors.length ? errors : undefined })}`)
        await context.close().catch(() => {})
      }
    }
    writeFileSync(join(out, 'resultat.json'), JSON.stringify(results, null, 2))
    // Dom pr. tilfælde: præcis én række med klippet i lager eller reserve, intet dobbelt, ingen kastede fejl.
    const fejl = []
    for (const r of results) {
      const sidste = r.udfald2 || r.udfald1
      if (r.fejl) fejl.push(`${r.who} ${r.case}: ${r.fejl}`)
      // g ender med vilje i Prøv igen (grænsen er nået), men klippet skal ligge der én gang.
      if (sidste !== 'sent' && r.case !== 'g') fejl.push(`${r.who} ${r.case}: endte som ${sidste}`)
      if (r.tekstFund?.length) fejl.push(`${r.who} ${r.case}: ${r.tekstFund.join('; ')} (panel: ${r.skaerm1?.panel})`)
      if (r.raekker !== 1) fejl.push(`${r.who} ${r.case}: ${r.raekker} rækker, ikke 1`)
      if (r.iLager + r.iReserve !== 1) fejl.push(`${r.who} ${r.case}: klippet ligger ${r.iLager} gange i lager og ${r.iReserve} i reserve`)
      if (r.case === 'e' && r.raekkerEfterLuk !== 0 && r.raekkerEfterLuk !== 1) fejl.push(`${r.who} e: ${r.raekkerEfterLuk} rækker efter lukning`)
      if (r.case === 'e' && r.raekkerEfterLuk === 0 && !r.advarselVedGenaabning) fejl.push(`${r.who} e: ingen advarsel ved genåbning, selvom klippet gik tabt`)
      if (r.errors.length) fejl.push(`${r.who} ${r.case}: kastede fejl ${r.errors.join(' | ')}`)
    }
    if (fejl.length) throw new Error(fejl.join('\n'))
    console.log('\nGRØN: alle tilfælde endte med præcis ét klip, eller med Prøv igen der landede klippet én gang')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
    await new Promise(r => { lager.closeAllConnections?.(); lager.close(r) })
  }
}

if (process.argv[1] && process.argv[1].endsWith('video-send-2367v.spec.mjs')) main()
