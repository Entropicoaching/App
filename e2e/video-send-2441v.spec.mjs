// ORDRE 2441v (Marc 25. nov., ugeplanens målstreg 3: videocoach pålidelig). 2437 tilfælde c målte ved
// ca. 400 kbit/s op, at sendingen lykkes efter ca. 297 s, men at skærmen i alle fem minutter kun siger
// "Sender video (14,1 MB). Bliv på skærmen, til den er sendt." uden fremgang. Samme sendvej som
// video-send-2367v.spec.mjs (videolager-worker i denne proces, mock uden RLS), som atlet og som coach:
//   a  langsomt net: CDP Network.emulateNetworkConditions med ca. 400 kbit/s op. Statusteksten skal vise
//      målt fremgang ("Sender video: 6,2 af 14,1 MB"), som stiger mindst to gange, og "Nettet er langsomt"
//      må ikke stå der, når fremgangen går fremad. Slut: sendt, præcis 1 række og 1 klip.
//   b  stilstand: lagerets PUT holdes tilbage i 30 s (Playwright-rute), så fremgangen står stille ved
//      100 %. Efter 20 s uden fremgang står der "Nettet er langsomt. Videoen sendes stadig, bliv på
//      skærmen." Slut: sendt, præcis 1 række og 1 klip.
//
// Kørsel: node e2e/video-send-2441v.spec.mjs   (E2E_VITE_PORT, E2E_MOCK_PORT, VITE_SUPABASE_URL,
// E2E_LAGER_PORT og OUT_2441V kan sættes; CASES_2441V=a,b vælger tilfælde; WHO_2441V=atlet vælger rolle.)
// STOR_2441V=1: tilfælde a sender et stort klip (det tegnede klip skaleret til 1080x1920 i høj kvalitet, så
// appen gør det klar til ca. 10 MB som i 2437), ellers det almindelige tegnede klip (ca. 1,8 MB, ca. 40 s).

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import ffmpegPath from 'ffmpeg-static'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { calibrateAthlete, CLICK_AT_S } from './athlete-film-et-saet.mjs'
import { handleVideolager } from '../src/videolager/worker.js'

const NOTE = 'god dybde i bunden'
const LAGER_PORT = Number(process.env.E2E_LAGER_PORT || 8995)
const OP_BYTES_PR_S = 50 * 1024 // ca. 400 kbit/s op, som 2437 tilfælde c
const STILSTAND_MS = 30000
const CASES = { a: 'langsomt net, ca. 400 kbit/s op', b: 'stilstand: PUT holdes tilbage i 30 s' }
const FREMGANG = /^Sender video: (\d+,\d) af (\d+,\d) MB$/
const LANGSOMT = 'Nettet er langsomt. Videoen sendes stadig, bliv på skærmen.'
const ENGELSK = /Failed to fetch|NetworkError|Load failed|fetch failed|uploading|slow network/i
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Det tegnede klip skaleret op til 1080x1920 i høj kvalitet (samme skive, samme positioner relativt), så
// sendingen tager minutter ved 400 kbit/s. Ikke committet (test-clips er git-ignoreret), ingen rigtig video.
function ensureStortKlip(lillePath) {
  const storPath = join(lillePath, '..', 'coach-sporing-full-glat-stor-2441v.mp4')
  if (!existsSync(storPath)) {
    const result = spawnSync(ffmpegPath, ['-y', '-i', lillePath, '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast',
      '-crf', '8', '-pix_fmt', 'yuv420p', '-an', storPath], { stdio: 'ignore' })
    if (result.status !== 0) throw new Error('ffmpeg kunne ikke lave det store klip')
  }
  return { path: storPath, mb: (statSync(storPath).size / 1048576).toFixed(1) }
}

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
    } catch {
      try { res.writeHead(500); res.end() } catch {}
    }
  })
  return new Promise(resolve => server.listen(LAGER_PORT, '127.0.0.1', () => resolve(server)))
}

// Ruten tæller kald på sendvejen og holder lagerets PUT tilbage (tilfælde b).
function installRoute(page, fault, counts) {
  const isLager = url => url.includes(`127.0.0.1:${LAGER_PORT}/`)
  const isMock = url => url.includes(`127.0.0.1:${MOCK_PORT}/`)
  return page.route(url => isLager(url.href) || isMock(url.href), async route => {
    const req = route.request()
    const url = req.url(), method = req.method()
    try {
      if (isLager(url) && url.endsWith('/upload-url') && method === 'POST') counts.uploadUrl++
      if (isLager(url) && url.includes('/blob/') && method === 'PUT') {
        counts.blobPut++
        if (fault.delayMs) await sleep(fault.delayMs)
      }
      if (isMock(url) && url.includes('/storage/v1/object/') && (method === 'POST' || method === 'PUT')) counts.reservePut++
      if (isMock(url) && url.includes('/rest/v1/video_analyses') && method === 'POST') counts.rowInsert++
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

// Statusteksten er videosidens banner (say() i public/videocoach.html).
const bannerTekst = frame => frame.locator('#banner').evaluate(b => (b.hidden ? '' : b.textContent || '').replace(/\s+/g, ' ').trim()).catch(() => '')

// Følger statusteksten hvert halve sekund, til der er sendt eller Prøv igen står frem.
async function foelgSending(frame, page, timeoutMs, billedeVed) {
  const t0 = Date.now()
  const tekster = []
  let billede = false
  while (Date.now() - t0 < timeoutMs) {
    const tekst = await bannerTekst(frame)
    if (tekst && tekst !== tekster.at(-1)?.tekst) {
      tekster.push({ s: Math.round((Date.now() - t0) / 1000), tekst })
      if (!billede && billedeVed?.naar(tekst, tekster)) { billede = true; await page.screenshot({ path: billedeVed.sti }).catch(() => {}) }
    }
    const state = await frame.locator('body').evaluate(b => b.dataset.athleteState).catch(() => null)
    if (state === 'sent') return { udfald: 'sent', tekster, sekunder: Math.round((Date.now() - t0) / 1000) }
    const knap = frame.locator('#vcUploadRetryStatus button')
    if (await knap.count() > 0 && await knap.isVisible().catch(() => false)) return { udfald: 'retry', tekster, sekunder: Math.round((Date.now() - t0) / 1000) }
    await sleep(500)
  }
  return { udfald: 'timeout', tekster, sekunder: Math.round((Date.now() - t0) / 1000) }
}

function analyserTekster(tekster) {
  const fremgang = tekster.map(t => t.tekst.match(FREMGANG)).filter(Boolean)
    .map(m => ({ sendt: Number(m[1].replace(',', '.')), total: Number(m[2].replace(',', '.')) }))
  let stigninger = 0
  for (let i = 1; i < fremgang.length; i++) if (fremgang[i].sendt > fremgang[i - 1].sendt) stigninger++
  return {
    antalTekster: tekster.length,
    fremgangTekster: fremgang.length,
    stigninger,
    foersteFremgang: fremgang[0] || null,
    sidsteFremgang: fremgang.at(-1) || null,
    langsomtSet: tekster.some(t => t.tekst === LANGSOMT),
    langsomtEfterS: tekster.find(t => t.tekst === LANGSOMT)?.s ?? null,
    engelsk: tekster.filter(t => ENGELSK.test(t.tekst)).map(t => t.tekst),
    udsnit: tekster.length > 8 ? [...tekster.slice(0, 4), { s: '...', tekst: `(${tekster.length - 8} flere)` }, ...tekster.slice(-4)] : tekster,
  }
}

async function main() {
  const out = process.env.OUT_2441V || join(OUT_DIR, '2441v')
  mkdirSync(out, { recursive: true })
  const wantedCases = (process.env.CASES_2441V || 'a,b').split(',').map(s => s.trim()).filter(Boolean)
  const wantedWho = (process.env.WHO_2441V || 'atlet,coach').split(',').map(s => s.trim()).filter(Boolean)
  const { path: clipPath } = ensureCoachSporingClip('glat')
  const stortKlip = process.env.STOR_2441V === '1' ? ensureStortKlip(clipPath) : null
  if (stortKlip) console.log(`stort klip til tilfælde a: ${stortKlip.mb} MB`)
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
        const fault = { delayMs: 0 }
        const counts = { uploadUrl: 0, blobPut: 0, reservePut: 0, rowInsert: 0 }
        const before = (await rowsFor()).map(r => r.id)
        const r = { who, case: id, titel: CASES[id], counts, errors, stortKlip: Boolean(stortKlip && id === 'a') }
        try {
          const page = await login(context, who)
          page.on('pageerror', err => errors.push(err.message))
          await installRoute(page, fault, counts)
          const frame = await filmTilKlar(page, stortKlip && id === 'a' ? stortKlip.path : clipPath)
          const send = frame.locator('#athleteInstantSaveBtn')
          r.foerSend = await bannerTekst(frame)

          if (id === 'a') {
            // Droslingen sættes først lige før Send, så klargøringen af klippet ikke måles med.
            const cdp = await context.newCDPSession(page)
            await cdp.send('Network.enable')
            await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 50,
              downloadThroughput: 20 * 1024 * 1024 / 8, uploadThroughput: OP_BYTES_PR_S })
            await send.click()
            const fulgt = await foelgSending(frame, page, 480000, {
              naar: (tekst, alle) => FREMGANG.test(tekst) && alle.filter(t => FREMGANG.test(t.tekst)).length >= 20,
              sti: join(out, `${who}-a-undervejs.png`),
            })
            Object.assign(r, fulgt, analyserTekster(fulgt.tekster))
            await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {})
          } else if (id === 'b') {
            fault.delayMs = STILSTAND_MS
            await send.click()
            const fulgt = await foelgSending(frame, page, 120000, { naar: tekst => tekst === LANGSOMT, sti: join(out, `${who}-b-langsomt.png`) })
            Object.assign(r, fulgt, analyserTekster(fulgt.tekster))
          }
          await page.screenshot({ path: join(out, `${who}-${id}-slut.png`) }).catch(() => {})
        } catch (err) {
          r.fejl = err.message
        }
        const nye = (await rowsFor()).filter(x => !before.includes(x.id))
        r.raekker = nye.length
        r.iLager = nye.filter(x => lagerEnv.VIDEO.store.has(x.video_path)).length
        const keys = await supabaseKeys()
        r.iReserve = nye.filter(x => keys.includes(`videocoach-uploads/${x.video_path}`)).length
        r.notat = nye.every(x => x.session_context?.athlete_note === NOTE)
        results.push(r)
        const { tekster, ...kort } = r
        console.log(`${who} ${id}: ${JSON.stringify({ ...kort, errors: errors.length ? errors : undefined })}`)
        await context.close().catch(() => {})
      }
    }
    writeFileSync(join(out, 'resultat.json'), JSON.stringify(results, null, 2))
    // Dom pr. tilfælde.
    const fejl = []
    for (const r of results) {
      const navn = `${r.who} ${r.case}`
      if (r.fejl) fejl.push(`${navn}: ${r.fejl}`)
      if (r.udfald !== 'sent') fejl.push(`${navn}: endte som ${r.udfald} efter ${r.sekunder} s`)
      if (r.raekker !== 1) fejl.push(`${navn}: ${r.raekker} rækker, ikke 1`)
      if (r.iLager + r.iReserve !== 1) fejl.push(`${navn}: klippet ligger ${r.iLager} gange i lager og ${r.iReserve} i reserve`)
      if (r.engelsk?.length) fejl.push(`${navn}: engelsk tekst ${r.engelsk.join(' | ')}`)
      if (r.case === 'a') {
        if ((r.stigninger ?? 0) < 2) fejl.push(`${navn}: fremgangen steg ${r.stigninger ?? 0} gange, ikke mindst 2 (tekster: ${JSON.stringify(r.udsnit)})`)
        if (r.langsomtSet) fejl.push(`${navn}: "Nettet er langsomt" stod der efter ${r.langsomtEfterS} s, selvom fremgangen gik fremad`)
      }
      if (r.case === 'b') {
        if (!r.langsomtSet) fejl.push(`${navn}: "Nettet er langsomt" kom ikke under stilstanden (tekster: ${JSON.stringify(r.udsnit)})`)
        else if (r.langsomtEfterS < 15) fejl.push(`${navn}: "Nettet er langsomt" kom for tidligt (${r.langsomtEfterS} s)`)
      }
      if (r.errors.length) fejl.push(`${navn}: kastede fejl ${r.errors.join(' | ')}`)
    }
    if (fejl.length) throw new Error(fejl.join('\n'))
    console.log('\nGRØN: fremgangen vises og stiger på langsomt net, "Nettet er langsomt" kommer ved stilstand, og klippet lander præcis én gang')
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

if (process.argv[1] && process.argv[1].endsWith('video-send-2441v.spec.mjs')) main()
