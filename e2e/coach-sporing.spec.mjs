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
async function calibrate(frame, page, canvas, box) {
  const target = truePos(CLICK_AT_S)
  const basePos = { x: target.x * box.width / GEN_W, y: target.y * box.height / GEN_H }
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
async function confirmAndWaitForTracking(frame, page) {
  await frame.locator('#allBtn').click()
  let lastBanner = ''
  let lastPercent = null
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(2000)
    const banner = await frame.locator('#banner').textContent().catch(() => '')
    if (banner) {
      lastBanner = banner
      const m = banner.match(/(\d+)%/)
      if (m) lastPercent = Number(m[1])
    }
    if (banner && banner.includes('Klip + loop')) return { done: true, lastBanner, lastPercent }
    if (banner && banner.includes('Ingen tydelig')) return { done: false, lastBanner, lastPercent }
  }
  throw new Error(`Sporingen blev aldrig færdig inden for 120 sekunder (sidste banner: "${lastBanner}")`)
}

export async function runCoachSporing(page, { appUrl, mockUrl, outDir, awaitingRow, clipPath }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `coach-sporing-${name}.png`), fullPage: true })

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
    CLICK_AT_S,
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
  const calibrated = await calibrate(frame, page, canvas, box)
  assert.ok(calibrated, 'auto-kalibreringen fandt ikke skiven efter gentagne forsøg')
  await shot('02-skive-fundet')

  // Klik 3: ⚡ igen — bekræfter ringen, starter selve sporingen.
  const { done: tracked, lastBanner, lastPercent } = await confirmAndWaitForTracking(frame, page)
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
