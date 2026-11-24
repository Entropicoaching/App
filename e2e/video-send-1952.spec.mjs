// ORDRE 1952 (Marc 20. nov.: "1. ja gr det og 2 ja"): send video gennem videolageret ved 390 px,
// først som atlet, så som coach på sin egen profil (coachen coacher seedens atlet). Appen bygges med
// VITE_VIDEOLAGER_URL mod en lokal videolager-worker (src/videolager/worker.js i denne proces, R2 i
// hukommelsen), som spørger mocken med brugerens eget token. Tegnet klip, syntetiske personer, ingen nøgler.
// Mocken har ingen RLS; databasens regler prøves i src/videoCoachSend1952.sql.test.mjs.
// Kriteriet her: klippet lander i videolageret (ikke i Supabase-reserven), rækken findes, og coachen
// kan hente klippet bagefter.
//
// Kørsel: node e2e/video-send-1952.spec.mjs
// (E2E_VITE_PORT, E2E_MOCK_PORT, VITE_SUPABASE_URL og E2E_LAGER_PORT kan sættes; OUT_1952 vælger mappen.)

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { calibrateAthlete, CLICK_AT_S } from './athlete-film-et-saet.mjs'
import { handleVideolager } from '../src/videolager/worker.js'

const NOTE = 'god dybde i bunden'
const LAGER_PORT = Number(process.env.E2E_LAGER_PORT || 8995)

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
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = chunks.length ? Buffer.concat(chunks) : undefined
    const request = new Request(`http://127.0.0.1:${LAGER_PORT}${req.url}`, { method: req.method, headers: req.headers,
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body })
    const response = await handleVideolager(request, env)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  })
  return new Promise(resolve => server.listen(LAGER_PORT, '127.0.0.1', () => resolve(server)))
}

// Hjem, "Mere i dag", "Film et sæt til videocoach", tegnet klip, start, skive, notat, stangbane, send.
async function filmAndSend(page, clipPath) {
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
  await frame.locator('#athleteInstantSaveBtn').click()
  await frame.locator('body[data-athlete-state="sent"], body[data-athlete-state="failed"]').first()
    .waitFor({ state: 'attached', timeout: 30000 }).catch(() => {})
  return { frame, state: await frame.locator('body').evaluate(b => b.dataset.athleteState),
    status: await frame.locator('#athleteStatus').innerText().catch(() => '') }
}

async function main() {
  const out = process.env.OUT_1952 || OUT_DIR
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
  const results = {}
  try {
    const rowsFor = async () => (await (await fetch(`${mockUrl}/__e2e/table?name=video_analyses`)).json())
      .filter(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
    const supabaseKeys = async () => (await fetch(`${mockUrl}/__e2e/storage-keys`)).json()

    for (const [who, user] of [['atlet', ATHLETE_USER], ['coach', COACH_USER]]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
      const errors = []
      page.on('pageerror', err => errors.push(err.message))
      const before = (await rowsFor()).length
      await page.goto(APP_URL)
      await page.locator('#athlete-auth-email').fill(user.email)
      await page.locator('#athlete-auth-password').fill(user.password)
      await page.getByRole('button', { name: 'Log ind' }).click()
      if (who === 'coach') {
        // Coachens egen profil (ordre 1610v): seedens atlet har coach_id = coachen.
        await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).waitFor({ state: 'visible', timeout: 15000 })
        await page.evaluate(id => { localStorage.setItem('entropi_my_athlete_id', id) }, ATHLETE_ID)
        await page.reload()
        await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).waitFor({ state: 'visible', timeout: 15000 })
        const minKnap = page.getByRole('button', { name: /^(⚡ )?Min træning$/i })
        if (await minKnap.count() > 0) await minKnap.first().click()
        else await page.getByText('Min træning', { exact: true }).first().click()
        await page.getByRole('button', { name: /Til coachportalen|← Coach view/ }).waitFor({ state: 'visible', timeout: 10000 })
      }
      const sent = await filmAndSend(page, clipPath)
      await page.screenshot({ path: join(out, `video-send-1952-${who}.png`) })
      const rows = await rowsFor()
      const row = rows.length > before ? rows[rows.length - 1] : null
      const inLager = row ? lagerEnv.VIDEO.store.has(row.video_path) : false
      const inReserve = row ? (await supabaseKeys()).includes(`videocoach-uploads/${row.video_path}`) : false
      // Coachen ser videoen: workeren udsteder en hente-adresse til coachens login.
      let coachCanFetch = null
      if (row) {
        const login = await (await fetch(`${mockUrl}/auth/v1/token?grant_type=password`, { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: COACH_USER.email, password: COACH_USER.password }) })).json()
        const dl = await fetch(`http://127.0.0.1:${LAGER_PORT}/download-url`, { method: 'POST',
          headers: { authorization: `Bearer ${login.access_token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ video_path: row.video_path }) })
        const url = dl.ok ? (await dl.json()).url : null
        coachCanFetch = !!url && (await fetch(url)).ok
      }
      results[who] = { state: sent.state, status: sent.status.replace(/\s+/g, ' ').slice(0, 160), row: !!row,
        note: row?.session_context?.athlete_note ?? null, barPath: !!row?.bar_path, inLager, inReserve, coachCanFetch, errors }
      console.log(who, JSON.stringify(results[who]))
      await page.close()
    }
    for (const who of ['atlet', 'coach']) {
      const r = results[who]
      assert.equal(r.state, 'sent', `${who}: ikke sendt (${r.status})`)
      assert.equal(r.row, true, `${who}: rækken mangler`)
      assert.equal(r.note, NOTE, `${who}: notatet med mellemrum fulgte ikke med`)
      assert.equal(r.barPath, true, `${who}: stangbanen fulgte ikke med`)
      assert.equal(r.inLager, true, `${who}: klippet ligger ikke i videolageret`)
      assert.equal(r.inReserve, false, `${who}: klippet gik til Supabase-reserven i stedet for videolageret`)
      assert.equal(r.coachCanFetch, true, `${who}: coachen kan ikke hente klippet`)
      assert.deepEqual(r.errors, [], `${who}: kastede fejl`)
    }
    console.log('\nGRØN: atlet og coach (egen profil) sendte video gennem videolageret; rækken findes, coachen henter klippet')
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

if (process.argv[1] && process.argv[1].endsWith('video-send-1952.spec.mjs')) main()
