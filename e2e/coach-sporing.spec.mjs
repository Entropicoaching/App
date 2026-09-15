// ORDRE 200 — anden runde efter ordre 190. 190 fandt at et beskåret klip
// under 300 KB ikke sporede pålideligt (se docs/RAPPORT-190.md), men at
// scripts/make-test-clip.mjs's FULDE, urørte klip (alle 5 reps, ~20s) gjorde
// — set to gange, dengang uden en systematisk gentagelsesprøve. Denne ordre
// dropper beskæringen helt: klippet genereres ved prøvens start
// (e2e/harness.mjs's ensureCoachSporingClip, git-ignoreret sti, aldrig
// committet) og genbruges uændret fra scripts/make-test-clip.mjs — "stå på
// skuldre", ikke en ny generator.
//
// KLIK-FLOWET (Marcs "fire klik", se public/videocoach.html's COACHWEB-
// flow: trin 1 Start · 2 Bane · 3 Feedback · 4 Send), uændret fra ordre 190:
//   1) ⚡ (#allBtn)              — starter klik-igennem-sporingen
//   2) klik skivens midte       — auto-kalibrering (autoCalib) finder kanten
//   3) ⚡ igen (#allBtn)         — bekræfter ringen, starter selve sporingen
//   4) 📨 Send analyse (#saveBtn) — gemmer/sender det sporede resultat
// Skivens midte (klik 2) er PRÆCIS beregnet, ikke gættet: scripts/make-test-clip.mjs
// eksporterer sin egen truePos(t) — den nøjagtige facit-position tracker-testen
// selv bruger — oversat fra videoens pixel-koordinater til canvas'ets CSS-boks
// med samme formel som videocoach.html's egen pos() (omvendt).
//
// GENFORSØG: hverken autoCalib (kant-kontrast-scoring) eller selve
// multipoint-trackeren er 100% deterministisk i en CPU-begrænset, headless
// browser — samme klasse variation en rigtig coach oplever (Marcs egen
// "kræver 4 forsøg"-kommentar i koden, public/videocoach.html linje ~6656).
// Prøven efterligner derfor en rigtig coach der prøver igen: op til 4
// kalibreringsklik med små forskudte positioner. Klikpunktet (original-t
// 1,8s) er valgt til at ligge GODT inde i klippet (1,8s efter start), ikke
// tæt på filens egen begyndelse — ordre 190 fandt at et klik for tæt på
// starten af en (beskåret) fil gav upålidelig sporing.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { COACH_USER } from './fixtures.mjs'
import { truePos, W as GEN_W, H as GEN_H } from '../scripts/make-test-clip.mjs'

const CLICK_AT_S = 1.8
const MAX_CALIBRATION_ATTEMPTS = 4

async function openAnalyseTab(page) {
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Analyse$/ }).click()
}

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

// Klikker skivens midte, med op til MAX_CALIBRATION_ATTEMPTS forsøg (små
// forskudte positioner ved gentagne forsøg — "nyt klik = ny ring", se
// public/videocoach.html's wizardClick). Returnerer true hvis en ring blev
// fundet (banneret siger "Ram skiven"), false hvis alle forsøg fejlede.
// ORDRE 221 · commit 3 — target/videoW/videoH er valgfrie (default: det
// syntetiske klips egen truePos(CLICK_AT_S)/GEN_W/GEN_H, 100% uændret for
// alle eksisterende kald), så e2e/coach-sporing-trace-real.mjs kan give et i
// hånden målt klikpunkt for et RIGTIGT klip uden nogen truePos().
async function calibrate(frame, page, canvas, box, target = truePos(CLICK_AT_S), videoW = GEN_W, videoH = GEN_H) {
  const basePos = { x: target.x * box.width / videoW, y: target.y * box.height / videoH }
  for (let attempt = 0; attempt <= MAX_CALIBRATION_ATTEMPTS; attempt++) {
    await frame.locator('#allBtn').click()
    await page.waitForTimeout(attempt === 0 ? 400 : 250)
    const jitter = attempt === 0 ? { x: 0, y: 0 }
      : { x: (attempt % 2 ? 6 : -6) * attempt, y: (attempt % 2 ? -5 : 5) * attempt }
    await canvas.click({ position: { x: basePos.x + jitter.x, y: basePos.y + jitter.y } })
    await page.waitForTimeout(500)
    const banner = await frame.locator('#banner').textContent()
    if (banner && banner.includes('Ram skiven')) return true
  }
  return false
}

// Bekræfter ringen (⚡ igen) og venter på sporingen er færdig — enten en
// succes ("Klip + loop om sættet", COACHWEB's session-visning, se
// public/videocoach.html's applySessionView) eller en ærlig fejl ("Ingen
// tydelig rep blev fundet"). Returnerer { done, lastBanner, lastPercent } —
// lastPercent er den sidst sete "Analyserer stangbanen · X%"/"Holder sidste
// sikre punkt · X%", til den gentagne 10x-kørsels egen tabel (se
// docs/RAPPORT-200.md).
// ORDRE 221 · commit 1 — maxIterations er valgfri (default 60 × 2000ms =
// 120s, uændret for alle eksisterende kald). En stor værdi giver reelt en
// UDEN-tidsgrænse-kørsel (se e2e/coach-sporing-trace.mjs's --untimed) uden at
// binde denne funktion til et helt uendeligt loop. progressLog (t i ms siden
// start, banner, procent) følger med retur-objektet til traceOut, så en
// utimet kørsel kan rapportere "hvor langt nåede den, hvor hurtigt" selv når
// den aldrig bliver færdig.
async function confirmAndWaitForTracking(frame, page, { maxIterations = 60 } = {}) {
  await frame.locator('#allBtn').click()
  let lastBanner = ''
  let lastPercent = null
  const t0 = Date.now()
  const progressLog = []
  for (let i = 0; i < maxIterations; i++) {
    await page.waitForTimeout(2000)
    const banner = await frame.locator('#banner').textContent().catch(() => '')
    if (banner) {
      lastBanner = banner
      const m = banner.match(/(\d+)%/)
      if (m) lastPercent = Number(m[1])
    }
    progressLog.push({ tMs: Date.now() - t0, banner, percent: lastPercent })
    if (banner && banner.includes('Klip + loop')) return { done: true, lastBanner, lastPercent, progressLog }
    if (banner && banner.includes('Ingen tydelig')) return { done: false, lastBanner, lastPercent, progressLog }
    // ORDRE 225 · commit 1 (rettet) — ægte fund: en COACHWEB-session hvor
    // sessionRun er false (denne prøves eget klik-flow går IKKE gennem
    // wizardClick, som ellers sætter sessionRun=true) fuldfører runFullAnalysis
    // via DEN STILLE 'else if(COACHWEB&&openSheetFn...)'-gren i
    // public/videocoach.html — den sætter ALDRIG "Klip + loop om sættet" i
    // banneret, kun #sheet's 'open'-klasse. Uden dette tjek rapporterede
    // denne funktion et falsk "aldrig færdig" for et rigtigt klip der reelt
    // blev færdigt på ~24s med ét brugbart rep — se docs/RAPPORT-225.md
    // commit 1 for hele diagnosen.
    const sheetOpen = await frame.locator('#sheet.open').count().catch(() => 0)
    if (sheetOpen > 0) return { done: true, lastBanner, lastPercent, progressLog, viaSheet: true }
  }
  const err = new Error(`Sporingen blev aldrig færdig inden for ${maxIterations * 2}s (sidste banner: "${lastBanner}")`)
  err.progressLog = progressLog
  throw err
}

// ORDRE 211 · commit 1 — traceOut (valgfri) er et objekt kaldstedet ejer;
// er den givet, tilføjes ?benchmark=1&trackerProbe=1 til VideoCoach-iframets
// URL (aktiverer eksisterende, allerede guardede instrumentering i
// public/videocoach.html — ALDRIG i produktion, kun her), og
// window.__vcTrackerBenchmarkLast læses ind i traceOut FØR asserten om
// gennemført sporing, så et fund overlever selv en forventet fejl (klippet
// er kendt fra ordre 200 til at fejle sporing). Rører intet ved selve
// klik-flowet eller trackerens adfærd for eksisterende kald uden traceOut.
export async function runCoachSporing(page, { appUrl, mockUrl, outDir, awaitingRow, clipPath, traceOut, maxIterations,
  clickAtS = CLICK_AT_S, clickTarget, videoW = GEN_W, videoH = GEN_H }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `coach-sporing-${name}.png`), fullPage: true })

  if (traceOut) {
    // ORDRE 211 · commit 1 — route.continue({url}) kan ikke ændre selve
    // NAVIGATIONS-URL'en for et iframe-dokument (Playwright ignorerer
    // url-overriden for navigations-requests, kun fundet ved at logge
    // requests og se den uændrede URL nå frem) — derfor et rigtigt
    // 302-redirect i stedet, kun første gang (næste request har allerede
    // ?benchmark=1, og fulfilles normalt).
    await page.context().route('**/videocoach.html*', async route => {
      const reqUrl = route.request().url()
      const url = new URL(reqUrl)
      if (url.searchParams.has('benchmark')) { await route.continue(); return }
      url.searchParams.set('benchmark', '1')
      url.searchParams.set('trackerProbe', '1')
      await route.fulfill({ status: 302, headers: { location: url.toString() } })
    })
  }

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()
  await openAnalyseTab(page)

  await page.getByText('Afventer sporing').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: /Spor nu/ }).click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  const video = frame.locator('video')
  await video.waitFor({ state: 'attached', timeout: 10000 })
  await page.waitForFunction(
    () => {
      const vc = document.querySelector('iframe[title="VideoCoach"]')
      const v = vc?.contentDocument?.querySelector('video')
      return !!v && v.videoWidth > 0
    },
    null,
    { timeout: 15000 },
  )
  await shot('01-video-lastet')

  // Seek til det rolige punkt lige før løftet starter — samme tidspunkt
  // skivens klik-position er beregnet for.
  await video.evaluate(
    (v, t) => new Promise(resolve => {
      if (Math.abs(v.currentTime - t) < 0.001) { resolve(); return }
      v.addEventListener('seeked', resolve, { once: true })
      v.currentTime = t
    }),
    clickAtS,
  )

  const canvas = frame.locator('#canvas')
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  assert.ok(box, 'canvas har ingen synlig boks — kan ikke beregne klik-position')
  // Canvas'et redraws via en requestAnimationFrame-kø udløst af seek/load —
  // en fast pause sikrer at den sidst tegnede frame faktisk matcher
  // videoens currentTime, før vi klikker på den.
  await page.waitForTimeout(300)

  // Klik 1+2: ⚡ og skivens midte — se calibrate() for genforsøgslogikken.
  const calibrated = clickTarget
    ? await calibrate(frame, page, canvas, box, clickTarget, videoW, videoH)
    : await calibrate(frame, page, canvas, box)
  assert.ok(calibrated, 'auto-kalibreringen fandt ikke skiven efter gentagne forsøg')
  await shot('02-skive-fundet')

  // Klik 3: ⚡ igen — bekræfter ringen, starter selve sporingen. Med
  // traceOut sat og et stort maxIterations (den utimede ordre 221-kørsel)
  // kan denne fortsat kaste (browserens egen sporing bliver aldrig færdig) —
  // progressLog (banner/procent pr. 2s-poll) reddes ind i traceOut FØR
  // genkastet, så et fund om "hvor langt/hvor hurtigt" overlever selv et
  // reelt timeout, samme princip som den eksisterende "Ingen tydelig"-fangst
  // nedenfor.
  let tracked, lastBanner, lastPercent, progressLog
  try {
    ({ done: tracked, lastBanner, lastPercent, progressLog } =
      await confirmAndWaitForTracking(frame, page, maxIterations ? { maxIterations } : {}))
  } catch (err) {
    if (traceOut) {
      traceOut.timedOut = true
      traceOut.progressLog = err.progressLog || []
      traceOut.lastBanner = err.progressLog?.at(-1)?.banner ?? ''
      traceOut.lastPercent = err.progressLog?.at(-1)?.percent ?? null
      // ORDRE 225 · commit 1 — et reelt timeout (maxIterations udløbet)
      // publicerer aldrig window.__vcTrackerBenchmarkLast (den skrives først
      // når selve sporings-loopet slutter), men browserens sporing kører
      // fortsat i baggrunden indtil siden lukkes lige efter dette. Læs derfor
      // den LIVE plSearch-/frame-probe (samme array-reference hele kørslen,
      // se public/videocoach.html) FØR siden lukkes, så et reelt hæng stadig
      // giver tal, ikke kun et progressLog-banner.
      const vcFrame = page.frames().find(f => f.url().includes('videocoach.html'))
      traceOut.plSearchProbe = vcFrame
        ? await vcFrame.evaluate(() => window.__vcPlSearchProbeLog || null).catch(() => null)
        : null
      traceOut.trackerProbe = vcFrame
        ? await vcFrame.evaluate(() => window.__vcTrackerProbeLog || null).catch(() => null)
        : null
    }
    throw err
  }

  if (traceOut) {
    traceOut.progressLog = progressLog
    const vcFrame = page.frames().find(f => f.url().includes('videocoach.html'))
    traceOut.lastBanner = lastBanner
    traceOut.lastPercent = lastPercent
    traceOut.tracked = tracked
    traceOut.benchmarkRun = vcFrame
      ? await vcFrame.evaluate(() => window.__vcTrackerBenchmarkLast || null).catch(() => null)
      : null
  }

  assert.ok(tracked, `sporingen fandt ingen brugbar rep (slutprocent: ${lastPercent}% · sidste banner: ` +
    `"${lastBanner}") — klip: ${clipPath}`)
  await shot('03-sporing-faerdig')

  // COACHWEB's session-visning (se applySessionView) åbner ikke selv arket —
  // "≡ Feedback" (#aiBtn, i "Fordyb"-bakken) gør det samme som en coach der
  // trykker videre til trin 3 (Feedback) for at se/sende sit fund.
  await frame.locator('#moreBtn').click()
  await frame.locator('#aiBtn').click()
  await frame.locator('#sheet.open').waitFor({ state: 'visible', timeout: 10000 })
  await shot('04-arket-aabent')

  // ÆRLIG PRØVE: "Ingen analyse endnu · Kør ⚡ Analysér løft først" vises kun
  // hvis sporingen alligevel ikke satte noget brugbart resultat op.
  const noResultText = frame.getByText('Ingen analyse endnu')
  assert.equal(await noResultText.count(), 0,
    'arket viser "ingen analyse endnu" — sporingen satte intet resultat op selvom den meldte færdig')

  // Klik 4: 📨 Send analyse — gemmer det sporede resultat (save-draft-broen,
  // se src/Dashboard.jsx's onVideoCoachMessage).
  await frame.locator('#saveBtn').click()

  await page.waitForFunction(
    async ([url, id]) => {
      const res = await fetch(`${url}/__e2e/table?name=video_analyses`)
      const rows = await res.json()
      return rows.find(r => r.id === id)?.analysis_state === 'complete'
    },
    [mockUrl, awaitingRow.id],
    { timeout: 15000 },
  )
  await shot('05-sendt-analyse-complete')

  const analyses = await readTable(mockUrl, 'video_analyses')
  const row = analyses.find(r => r.id === awaitingRow.id)
  assert.ok(row, 'video_analyses mangler rækken efter fuldført sporing')
  assert.equal(row.analysis_state, 'complete')
  assert.equal(row.client_analysis_id, awaitingRow.client_analysis_id,
    'fuldførelsen skulle opdatere SAMME afventende række, ikke oprette en ny')
  assert.ok(row.bar_path && typeof row.bar_path === 'object',
    'ingen bar_path gemt — sporingen skrev intet reelt resultat')
  assert.ok(Number.isFinite(Number(row.bar_path.cm_per_px)) && Number(row.bar_path.cm_per_px) > 0,
    'bar_path.cm_per_px mangler eller er ugyldig — kalibreringen slog ikke igennem til det gemte resultat')

  return row
}
