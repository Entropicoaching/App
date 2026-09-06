// ORDRE 73 · commit 3 — upload-og-gå ende til ende, uden produktion.
// -----------------------------------------------------------------------------
// Kører atletens OG coachens standardvej for "upload og gå" (ordre 57) mod det
// samme syntetiske klip, med KUN de netværks-/database-kaldende dele af
// Supabase-klienten stubbet lokalt (ingen netværk, ingen bucket, ingen
// produktionsrække). Alt andet er den ægte, ukørte kode:
//
//   - public/videocoach.html køres UÆNDRET i headless Chromium (samme fil som
//     produktion, ikke en udtrukket/ombygget kopi som i verify-videocoach-clip.mjs).
//   - src/videoCoachUpload.js og src/videoCoachSubmission.js's eksporterede
//     funktioner (validateVideoUploadRequest, buildVideoUploadPath,
//     buildAwaitingAnalysisRow, saveVideoCoachDraft, ...) importeres og
//     kaldes DIREKTE - ikke gen-implementeret.
//   - Kun de to bro-værter (AthleteView.jsx's onAthleteVideoCoachMessage og
//     Dashboard.jsx's onVideoCoachMessage) er stand-ins, fordi de er dybt
//     bundet til React-komponenttræet og en autentificeret Supabase-session.
//     Stand-in'ene taler PRÆCIS samme beskedprotokol (samme type-navne, samme
//     feltnavne) som de rigtige handlere - se kildehenvisningerne ved hver
//     handler nedenfor.
//
// To trin:
//   A) Atleten: vælger klippet i en fil-dialog, vælger "Squat", trykker
//      "Send til coach" - IKKE sporing af hele sættet, det er netop pointen
//      med "upload og gå" (ordre 57). Forventet: en lokal "sti bygget, række
//      dannet"-registrering (i vores stub-tabel, ikke i produktion) og
//      banneret "Video modtaget ✓ ...".
//   B) Coachen: åbner den afventende video via en LOKALT stubbet "signeret"
//      URL (peger på samme klip, serveret af dette scripts egen lokale
//      server - ingen Supabase Storage involveret), sporer sættet (den ægte,
//      ukørte startMultipointTracking, med browserens virkelige
//      requestVideoFrameCallback-vej - IKKE commit 2's manuelle seek-loop),
//      og trykker gem. Forventet: SAMME række (samme client_analysis_id)
//      opdateret til analysis_state='complete'.
//
// Kørsel: npm run verify:videocoach-upload-flow

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

import { validateVideoUploadRequest, buildVideoUploadPath, buildAwaitingAnalysisRow,
  videoUploadAlreadyExistsError, VIDEOCOACH_UPLOAD_BUCKET } from '../src/videoCoachUpload.js'
import { saveVideoCoachDraft } from '../src/videoCoachSubmission.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const clipPath = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.mp4')
const gtPath = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.ground-truth.json')

if (!existsSync(clipPath) || !existsSync(gtPath)) {
  console.log('Intet testklip fundet - genererer det først (npm run test:clip) ...')
  const gen = spawnSync(process.execPath, [join(here, 'make-test-clip.mjs')], { stdio: 'inherit' })
  if (gen.status !== 0) { console.error('Kunne ikke generere testklippet.'); process.exit(1) }
}
const groundTruth = JSON.parse(readFileSync(gtPath, 'utf8'))
const clipBuffer = readFileSync(clipPath)
const htmlBuffer = readFileSync(join(root, 'public', 'videocoach.html'))

// Ren, syntetisk test-UUID - samme mønster som docs/videocoach/run-clean-
// rebuild-gate.mjs's BRIDGE_ATHLETE_ID. Ingen ægte atlet.
const ATHLETE_ID = '11111111-1111-4111-8111-111111111111'
const ATHLETE_NAME = 'Testatlet (syntetisk)'

// ---------- Node-side "Supabase" - ingen netværk, ingen bucket ----------
// Simulerer PRÆCIS de to overflader saveVideoCoachDraft/upload-and-go rører:
// storage.from(bucket).upload(...) og from('video_analyses').insert/update(...).
const table = new Map()      // client_analysis_id -> række
const uploadedFiles = new Map()  // sti -> { size, contentType }

function makeStubSupabase() {
  return {
    storage: {
      from() {
        return {
          async upload(path, fileMeta, opts) {
            if (uploadedFiles.has(path)) return { data: null, error: { statusCode: '409', message: 'The resource already exists' } }
            uploadedFiles.set(path, { size: fileMeta.size, contentType: opts?.contentType })
            return { data: { path }, error: null }
          },
        }
      },
    },
    from() {
      return {
        insert(row) {
          // athleteSubmission-vejen afventer .insert(row) direkte, uden .select().single().
          const thenable = Promise.resolve().then(() => {
            table.set(row.client_analysis_id, { ...row, id: `stub-${row.client_analysis_id}`, created_at: new Date().toISOString() })
            return { data: null, error: null, count: null, status: 201, statusText: 'Created' }
          })
          thenable.select = () => ({
            single: async () => {
              await thenable
              const saved = table.get(row.client_analysis_id)
              return { data: { id: saved.id, client_analysis_id: saved.client_analysis_id, athlete_id: saved.athlete_id, status: saved.status, created_at: saved.created_at }, error: null }
            },
          })
          return thenable
        },
        update(row) {
          return {
            eq(col, val) {
              return {
                select() {
                  return {
                    async single() {
                      const existing = table.get(val)
                      if (!existing) return { data: null, error: { message: 'Ingen række med dette client_analysis_id (stub)' } }
                      const merged = { ...existing, ...row }
                      table.set(val, merged)
                      return { data: { id: merged.id, client_analysis_id: merged.client_analysis_id, athlete_id: merged.athlete_id, status: merged.status, created_at: merged.created_at }, error: null }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

// ---------- HTTP-server: videocoach.html + klippet, samme oprindelse (postMessage kræver det) ----------
function serveBuffer(req, res, buf, contentType) {
  if (contentType === 'video/mp4' && req.headers.range) {
    const match = /bytes=(\d+)-(\d*)/.exec(req.headers.range)
    const start = match ? parseInt(match[1], 10) : 0
    const end = match && match[2] ? parseInt(match[2], 10) : buf.length - 1
    res.writeHead(206, {
      'content-type': contentType, 'content-length': end - start + 1,
      'content-range': `bytes ${start}-${end}/${buf.length}`, 'accept-ranges': 'bytes',
      'access-control-allow-origin': '*',
    })
    res.end(buf.subarray(start, end + 1))
    return
  }
  res.writeHead(200, { 'content-type': contentType, 'content-length': buf.length, 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' })
  res.end(buf)
}
// videocoach.html trækker et par sideordnede filer ind (fx videocoach-zoom.js,
// et modul der bevidst er lagt i sin egen fil for at kunne enhedstestes
// separat - se filens egen kommentar). Alt andet end html/klippet slås derfor
// op i public/, samme sti som den ægte app serverer dem fra.
const publicDir = join(root, 'public')
function startServer() {
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (url === '/videocoach.html') return serveBuffer(req, res, htmlBuffer, 'text/html; charset=utf-8')
    if (url === '/clip.mp4') return serveBuffer(req, res, clipBuffer, 'video/mp4')
    if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>harness</title>'); return }
    const safeRel = url.replace(/^\/+/, '').replace(/\.\.\//g, '')
    const filePath = join(publicDir, safeRel)
    if (filePath.startsWith(publicDir) && existsSync(filePath)) {
      const ext = filePath.split('.').pop()
      const type = ext === 'js' ? 'text/javascript; charset=utf-8' : ext === 'css' ? 'text/css' : 'application/octet-stream'
      return serveBuffer(req, res, readFileSync(filePath), type)
    }
    res.writeHead(404); res.end()
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, origin: `http://127.0.0.1:${port}` })
    })
  })
}

// ---------- Bro-vært (stand-in for AthleteView.jsx/Dashboard.jsx) ----------
// Beskedprotokollen (typer og feltnavne) er kopieret 1:1 fra de rigtige
// handlere - se filhovedet. Selve React/Supabase-delen er stand-in'et.
const PREFIX = 'entropi:videocoach:v3'

async function setupAthleteHost(page, origin) {
  await page.goto(origin + '/')
  await page.exposeFunction('nodeUploadAndGo', async msg => {
    // 1:1 AthleteView.jsx's onAthleteVideoCoachMessage, upload-and-go-grenen
    // (src/AthleteView.jsx, søg efter ATHLETE_VIDEOCOACH_PREFIX + ':upload-and-go').
    const requestError = validateVideoUploadRequest({
      athleteId: ATHLETE_ID, clientAnalysisId: msg.clientAnalysisId, lift: msg.lift,
      variation: msg.variation, mimeType: msg.mimeType, fileSize: msg.fileSize,
      loadKg: msg.loadKg, rpe: msg.rpe, athleteNote: msg.athleteNote,
    })
    if (requestError) return { ok: false, error: requestError }
    const path = buildVideoUploadPath(ATHLETE_ID, msg.clientAnalysisId, msg.mimeType)
    if (!path) return { ok: false, error: 'Videoformatet kunne ikke gemmes' }
    const stubSupabase = getStubSupabase()
    const upload = await stubSupabase.storage.from(VIDEOCOACH_UPLOAD_BUCKET)
      .upload(path, { size: msg.fileSize }, { contentType: msg.mimeType })
    if (upload.error && !videoUploadAlreadyExistsError(upload.error)) {
      return { ok: false, error: `Video kunne ikke uploades: ${upload.error.message || 'ukendt fejl'}` }
    }
    const row = buildAwaitingAnalysisRow({
      athleteId: ATHLETE_ID, athleteName: ATHLETE_NAME, clientAnalysisId: msg.clientAnalysisId,
      lift: msg.lift, variation: msg.variation, loadKg: msg.loadKg, rpe: msg.rpe,
      athleteNote: msg.athleteNote, videoPath: path,
    })
    const saved = await saveVideoCoachDraft(stubSupabase, row, { athleteSubmission: true })
    if (saved.error) return { ok: false, error: saved.error.message || 'Analysen kunne ikke oprettes' }
    return { ok: true, data: { ...saved.data, duplicate: saved.duplicate } }
  })
  await page.evaluate(({ prefix, athleteId, athleteName }) => {
    window.addEventListener('message', async event => {
      if (event.origin !== location.origin || !event.source) return
      const msg = event.data || {}
      if (msg.type === `${prefix}:ready`) {
        event.source.postMessage({ type: `${prefix}:config`,
          athletes: [{ id: athleteId, name: athleteName }],
          selectedAthleteId: athleteId, submissionMode: 'athlete' }, event.origin)
        return
      }
      if (msg.type === `${prefix}:upload-and-go`) {
        window.__lastClientAnalysisId = msg.clientAnalysisId
        const result = await window.nodeUploadAndGo({
          clientAnalysisId: msg.clientAnalysisId, mimeType: msg.mimeType, lift: msg.lift,
          variation: msg.variation, loadKg: msg.loadKg, rpe: msg.rpe, athleteNote: msg.athleteNote,
          fileSize: msg.file?.size,
        })
        event.source.postMessage({ type: `${prefix}:upload-result`, requestId: msg.requestId, ...result }, event.origin)
      }
    })
  }, { prefix: PREFIX, athleteId: ATHLETE_ID, athleteName: ATHLETE_NAME })
}

async function setupCoachHost(page, origin, { clientAnalysisId, lift, variation }) {
  await page.goto(origin + '/')
  await page.exposeFunction('nodeSaveDraft', async row => {
    // 1:1 Dashboard.jsx's onVideoCoachMessage, save-draft-grenen (src/Dashboard.jsx,
    // søg efter VIDEOCOACH_V3_PREFIX + ':save-draft'). isCompletion afgøres her af
    // om rækken allerede findes - samme udfald som Dashboard.jsx's
    // videoCoachPendingCompletionRef-tjek for denne enkeltstrengede test.
    const stubSupabase = getStubSupabase()
    const isCompletion = table.has(row.client_analysis_id)
    const result = isCompletion
      ? await saveVideoCoachDraft(stubSupabase, row, { updateClientAnalysisId: row.client_analysis_id })
      : await saveVideoCoachDraft(stubSupabase, row, {})
    if (result.error) return { ok: false, error: result.error.message || 'Analysen kunne ikke gemmes' }
    return { ok: true, data: { ...result.data, duplicate: result.duplicate } }
  })
  await page.evaluate(({ prefix, athleteId, athleteName, clientAnalysisId, lift, variation, videoUrl }) => {
    // videocoach.html annoncerer ":ready" to gange (med vilje, som dobbelt
    // sikkerhed mod at den første besked går tabt - se videocoach.html's egen
    // "announce(); setTimeout(announce, 800);"). Et ægte coach-flow går
    // gennem opsætningsskærmen FØRST (samme løft sat begge steder, se
    // syncCoachSetupBridge/syncSetup i videocoach.html), og et andet
    // :config-svar dér er derfor harmløst. Denne test springer opsætnings-
    // skærmen over og sætter #liftSel direkte via :load-remote-video - et
    // andet :config-svar ville da nulstille #liftSel til opsætningskortets
    // egen (tomme) værdi via syncCoachSetupBridge → syncSetup (observeret
    // ved en fejlsøgende value-setter under udviklingen af dette script).
    // Derfor sendes BÅDE :config og :load-remote-video kun én gang her - en
    // bevidst, afgrænset forenkling af selve TEST-broen, ikke af produktet.
    let sent = false
    window.addEventListener('message', async event => {
      if (event.origin !== location.origin || !event.source) return
      const msg = event.data || {}
      if (msg.type === `${prefix}:ready`) {
        if (sent) return
        sent = true
        event.source.postMessage({ type: `${prefix}:config`,
          athletes: [{ id: athleteId, name: athleteName }],
          selectedAthleteId: athleteId, submissionMode: 'coach' }, event.origin)
        // ORDRE 57 · commit 2: "signeret URL" - her lokalt stubbet til
        // klippets egen HTTP-server i stedet for supabase.storage.createSignedUrl.
        event.source.postMessage({ type: `${prefix}:load-remote-video`,
          url: videoUrl, lift, variation, clientAnalysisId }, event.origin)
        return
      }
      if (msg.type === `${prefix}:save-draft`) {
        const result = await window.nodeSaveDraft(msg.row)
        event.source.postMessage({ type: `${prefix}:save-result`, requestId: msg.requestId, ...result }, event.origin)
      }
    })
  }, { prefix: PREFIX, athleteId: ATHLETE_ID, athleteName: ATHLETE_NAME, clientAnalysisId, lift, variation, videoUrl: origin + '/clip.mp4' })
}

// getStubSupabase() eksponeres til de to exposeFunction-handlere via en
// modul-lukning (samme instans genbruges begge veje, så coachen kan
// se/opdatere den række atleten oprettede).
let sharedStubSupabase = null
function getStubSupabase() {
  if (!sharedStubSupabase) sharedStubSupabase = makeStubSupabase()
  return sharedStubSupabase
}

// ---------- Playwright (delt codex-runtime, samme kilde som de øvrige videocoach-rigge) ----------
const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const require = createRequire(import.meta.url)
const { chromium } = require(join(runtimeModules, 'playwright'))

async function runAthleteStep(browser, origin) {
  const context = await browser.newContext()
  const hostPage = await context.newPage()
  await setupAthleteHost(hostPage, origin)

  const popupPromise = context.waitForEvent('page')
  await hostPage.evaluate(u => { window.__vc = window.open(u, '_blank'); }, `${origin}/videocoach.html?mode=athlete&bridge=athlete-v1`)
  const vcPage = await popupPromise
  await vcPage.waitForLoadState('domcontentloaded')

  await vcPage.setInputFiles('#fileInput', { name: 'synthetic-set.mp4', mimeType: 'video/mp4', buffer: clipBuffer })
  await vcPage.waitForFunction(() => {
    const el = document.getElementById('athleteSubmitSheet')
    return el && !el.hidden
  }, null, { timeout: 15000 })
  await vcPage.selectOption('#liftSel', 'Squat')
  await vcPage.click('#saveBtn')
  await vcPage.waitForFunction(() => document.getElementById('banner')?.textContent?.includes('Video modtaget'), null, { timeout: 20000 })
  const bannerText = await vcPage.evaluate(() => document.getElementById('banner').textContent)
  const clientAnalysisId = await hostPage.evaluate(() => window.__lastClientAnalysisId)

  await context.close()
  return { bannerText, clientAnalysisId }
}

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function runCoachStep(browser, origin, { clientAnalysisId }) {
  const lift = 'squat', variation = 'competition_squat'
  // Coach-visningen lægger et 720x1280-canvas direkte i sideflowet (SLIM-
  // layout, samme skalering som en rigtig telefonvideo) - en høj viewport her
  // er tættere på en rigtig coach-skærm end standard 1280x720.
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } })
  const hostPage = await context.newPage()
  await setupCoachHost(hostPage, origin, { clientAnalysisId, lift, variation })

  const popupPromise = context.waitForEvent('page')
  await hostPage.evaluate(u => { window.__vc = window.open(u, '_blank'); }, `${origin}/videocoach.html?coach=1&bridge=v3`)
  const vcPage = await popupPromise
  vcPage.on('pageerror', err => console.log('  [coach pageerror]', err.message))
  // saveBtn.onclick's egne fejlveje (fx "Vælg øvelse først") bruger alert() -
  // et ubesvaret dialog-kald ville ellers blokere resten af siden for evigt
  // i en headless browser uden nogen bruger til at lukke det.
  vcPage.on('dialog', async dialog => { console.log('  [coach dialog]', dialog.message()); await dialog.dismiss() })
  await vcPage.waitForLoadState('domcontentloaded')

  // Video indlæst via :load-remote-video (sendt automatisk af host'en ovenfor
  // lige efter :config) - vent til canvas rent faktisk har fået klippets mål.
  await withTimeout(vcPage.waitForFunction(() => {
    const c = document.getElementById('canvas')
    return c && c.width > 0 && c.height > 0
  }, null, { timeout: 20000 }), 25000, 'canvas fik klippets mål')
  console.log('  video indlæst i coach-tilstand (canvas har fået klippets mål)')

  // Headless Chromiums video.play()/.pause()-dans i begin() maler ikke
  // pålideligt et rigtigt frame ind i canvas'et før første seek. Et EKSPLICIT
  // seek - som commit 2's verify-videocoach-clip.mjs allerede har bevist
  // virker pålideligt - tvinger et rigtigt afkodet, malbart frame frem, før
  // trackerens egen første octx.drawImage skal bruge det.
  await vcPage.evaluate(() => new Promise(resolve => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = 0.1
  }))

  const p0 = groundTruth.samples[Math.round(0.1 * groundTruth.fps)]
  const cmPerPxValue = 45 / (2 * groundTruth.plateRadius)
  const trackStartedAt = Date.now()
  const tracked = await withTimeout(vcPage.evaluate(({ x, y, r, cmPerPxValue }) => {
    cmPerPx = cmPerPxValue
    return runFullAnalysis({ x, y, r })
  }, { x: p0.x, y: p0.y, r: groundTruth.plateRadius, cmPerPxValue }), 120000, 'runFullAnalysis')
  const trackMs = Date.now() - trackStartedAt
  // runFullAnalysis returnerer eksplicit `false` ved fejl, men falder bare ud
  // for enden af funktionen (returnerer `undefined`) i sin egen succes-sti -
  // se public/videocoach.html. `false` er derfor den eneste fejlværdi.
  const trackingSucceeded = tracked !== false
  console.log(`  runFullAnalysis afsluttet: tracked=${tracked} -> ${trackingSucceeded ? 'succes' : 'fejl'} (${trackMs}ms)`)

  // Playwrights mus-baserede klik kræver et punkt inde i viewporten; det høje
  // 720x1280-canvas i coach-layoutet skubber knappen langt ned. Et ægte
  // DOM-klik (samme hændelse som en berøring/museklik ville udløse) er
  // ligegyldigt over for scroll-position.
  await vcPage.evaluate(() => document.getElementById('saveBtn').click())
  await withTimeout(vcPage.waitForFunction(() => {
    const t = document.getElementById('saveBtn')?.textContent || ''
    return t.includes('Sendt') || t.includes('Prøv')
  }, null, { timeout: 20000 }), 25000, 'saveBtn-tekst efter klik')
  const saveBtnText = await vcPage.evaluate(() => document.getElementById('saveBtn').textContent)

  await context.close()
  return { tracked: trackingSucceeded, trackMs, saveBtnText }
}

async function main() {
  const { server, origin } = await startServer()
  const browser = await chromium.launch({ headless: true })
  try {
    console.log('== A) Atleten: fil valgt -> sti bygget -> række dannet -> "Video modtaget" ==')
    const athleteResult = await runAthleteStep(browser, origin)
    console.log(`banner: "${athleteResult.bannerText}"`)
    console.log(`client_analysis_id: ${athleteResult.clientAnalysisId}`)

    assert.ok(athleteResult.clientAnalysisId, 'videocoach.html skal have genereret et client_analysis_id')
    assert.match(athleteResult.bannerText, /Video modtaget/, 'Atlet-banneret skal vise "Video modtaget"')
    assert.equal(table.size, 1, 'Der skal være oprettet præcis én række (stub-tabel)')
    assert.equal(uploadedFiles.size, 1, 'Der skal være uploadet præcis én fil (stub-storage)')
    const draftRow = table.get(athleteResult.clientAnalysisId)
    assert.ok(draftRow, 'Rækken skal findes under det client_analysis_id videocoach.html selv genererede')
    assert.equal(draftRow.athlete_id, ATHLETE_ID)
    assert.equal(draftRow.analysis_state, 'awaiting_analysis', 'Standardvejen sporer intet - status er afventende')
    assert.equal(draftRow.status, 'draft')

    console.log('\n== B) Coachen: lokalt "signeret" URL -> video indlæst -> sporet -> samme række -> complete ==')
    const coachResult = await runCoachStep(browser, origin, { clientAnalysisId: athleteResult.clientAnalysisId })
    console.log(`sporing gennemført: ${coachResult.tracked} (${coachResult.trackMs}ms, ægte requestVideoFrameCallback-afspilning)`)
    console.log(`saveBtn: "${coachResult.saveBtnText}"`)

    assert.equal(coachResult.tracked, true, 'Coachens sporing af det ægte klip skal lykkes')
    assert.match(coachResult.saveBtnText, /Sendt/, 'Gem-knappen skal vise en sendt-bekræftelse, ikke en fejl')
    assert.equal(table.size, 1, 'Coachens gem må IKKE oprette en ny række ved siden af')
    const finalRow = table.get(athleteResult.clientAnalysisId)
    assert.equal(finalRow.analysis_state, 'complete', 'Rækken skal være fuldført efter coachens sporing')
    assert.equal(finalRow.athlete_id, ATHLETE_ID, 'Fuldførelsen må ikke flytte rækken til en anden atlet')
    assert.equal(finalRow.source_mode, 'athlete_submission', 'Fuldførelsen skal bevare den oprindelige kilde')
    assert.equal(finalRow.client_analysis_id, athleteResult.clientAnalysisId, 'Samme client_analysis_id fra start til slut')

    console.log('\nGRØN: atletens standardvej og coachens fuldførelse virker ende til ende mod det rigtige klip,')
    console.log('med kun Supabase-netværket stubbet lokalt - samme række, fra "afventer" til "complete".')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    server.close()
  }
}

main()
