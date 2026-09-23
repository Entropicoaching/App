// ORDRE 155 · commit 2 — coachen gennemgår. To halvdele, begge ægte klik mod
// den ægte app:
//
//  A) Den afventende video fra commit 1 åbnes i broen (iframe), mocken svarer
//     på load-remote-video (signeret URL → rigtige bytes), og videoen loader
//     synligt i VideoCoach — beviser storage-sti'en ende-til-ende.
//  B) En FÆRDIG-ANALYSERET video (seedet, se fixtures.mjs's ANALYZED_VIDEO_ID)
//     får skrevet works/focus/next_set-feedback, godkendes og deles — helt
//     via rigtige klik i AnalyseTab.jsx's review-panel.
//
// ÆRLIG GRÆNSE: (A) sporer IKKE videoen for rigtigt — det kræver en video med
// en faktisk sporbar skive (samme problem scripts/make-test-clip.mjs løser
// for tracker-testen), som er ude af omfang her. Derfor er (B) seedet som
// "allerede sporet", så feedback/godkend/del-kæden — det coachen og atleten
// reelt bruger dagligt — proves fuldt ud med rigtige klik. Se docs/E2E.md.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { COACH_USER, ATHLETE_USER, ANALYZED_VIDEO_ID } from './fixtures.mjs'

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

async function openAnalyseTab(page) {
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Analyse$/ }).click()
}

export async function runVideoReview(page, { appUrl, mockUrl, outDir, awaitingRow = null }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `video-review-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()
  await openAnalyseTab(page)

  if (awaitingRow) {
    // A) Broen: åbn den afventende video, bekræft VideoCoach rent faktisk
    // modtager og afspiller den (load-remote-video mod mockens signerede URL).
    await page.getByText('Afventer sporing').waitFor({ state: 'visible', timeout: 10000 })
    await page.getByRole('button', { name: /Spor nu/ }).click()
    const frame = page.frameLocator('iframe[title="VideoCoach"]')
    await frame.locator('video').waitFor({ state: 'attached', timeout: 10000 })
    await page.waitForFunction(
      () => {
        const vc = document.querySelector('iframe[title="VideoCoach"]')
        const video = vc?.contentDocument?.querySelector('video')
        return !!video && video.videoWidth > 0
      },
      null,
      { timeout: 15000 },
    )
    await shot('01-broen-video-loaded')
    await frame.locator('#closeBtn').click()
    await page.locator('iframe[title="VideoCoach"]').waitFor({ state: 'hidden', timeout: 10000 })
  }

  // B) Feedback på den færdig-analyserede video.
  const feedback = {
    works: 'Stangbanen er lodret gennem hele løftet.',
    focus: 'Brystet falder let frem i bunden af squattet.',
    next_set: 'Spænd overkroppen før du bryder til bunds.',
  }
  await page.getByRole('button', { name: 'Gennemgå måling' }).first().click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByLabel('Det fungerer').fill(feedback.works)
  await page.getByLabel('Atletens fokus').fill(feedback.focus)
  await page.getByLabel('Næste gang').fill(feedback.next_set)
  await shot('02-feedback-udfyldt')
  await page.getByRole('button', { name: 'Gem feedback' }).click()
  await page.getByText('Feedback gemt ✓').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: 'Luk' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 })

  await page.getByRole('button', { name: 'Godkend til baseline' }).click()
  await page.getByText('Indgår i personlig baseline').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: 'Del med atlet' }).click()
  await page.waitForFunction(
    async ([url, id]) => {
      const res = await fetch(`${url}/__e2e/table?name=video_analyses`)
      const rows = await res.json()
      return rows.find(r => r.id === id)?.status === 'shared'
    },
    [mockUrl, ANALYZED_VIDEO_ID],
    { timeout: 10000 },
  )
  await shot('03-delt-med-atlet')

  const analyses = await readTable(mockUrl, 'video_analyses')
  const shared = analyses.find(r => r.id === ANALYZED_VIDEO_ID)
  assert.equal(shared.status, 'shared')
  assert.equal(shared.athlete_feedback?.focus?.[0]?.text, feedback.focus)
  assert.equal(shared.athlete_feedback?.next_set?.[0]?.text, feedback.next_set)
  return feedback
}

/** Atleten ser feedbacken (separat browserside — proves cross-role igen). */
export async function runAthleteSeesFeedback(page, { appUrl, outDir, feedback }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `video-review-${name}.png`), fullPage: true })
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  // "Feedback fra din coach" ligger bag folden "Mere" siden ORDRE 330.
  await page.getByRole('button', { name: 'Mere', exact: true }).click({ timeout: 15000 })
  await page.getByText('Feedback fra din coach').waitFor({ state: 'visible', timeout: 15000 })
  // Den seneste delte måling er allerede foldet ud (fetchSharedVideoAnalyses
  // åbner analyses[0] automatisk) — intet klik nødvendigt, kun at læse den.
  await page.getByText(feedback.focus).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByText(feedback.next_set).waitFor({ state: 'visible', timeout: 10000 })
  await shot('04-atlet-ser-feedback')
}
