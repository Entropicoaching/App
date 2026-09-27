// ORDRE 464 (Bhishak): kopi af outputs/456/coach-456.mjs (Vaidyas kopi af mit coach-446), koert mod main e5089f7.
// Kun stierne er aendret (faelles-464, skriver i outputs/kritik-464). Vaidyas aendringer staar herunder.
// ORDRE 456: KOPI af outputs/kritik-446/coach-446.mjs (Bhishak), koert mod grenen
// klar-til-push. AEndret: faelles-456/uge-456 (skriver her) og DIST. Scenarie og
// tjek er uaendrede; filnavnene er de samme som i 446.
//
// ORDRE 446, blok 2: coachen efter atletens offline-uge, 390 og 1280 px.
// Foerst koeres atletens uge fra blok 1 (uge-446.mjs, samme scenarie, samme
// aeldre telefon) mod en mock, der bliver staaende. Saa logger den syntetiske
// coach ind paa samme mock: forsiden, "Kraever dit blik", en kommentar
// (atletens linje fra "din uge"), Log med det sprungne saet, rekorderne
// (PR-tidslinjen), videoen og "Kopier seneste uge" (paa telefonen med et
// dobbelttryk, som en coach paa en langsom telefon kan komme til).
// Signalerne regnes med appens JS-spejl (detectSignalsV2) paa mockens tabeller,
// som i 428/433 (mocken har ikke SQL-funktionen).
// Koersel: node outputs/kritik-446/coach-446.mjs -> coach-446.json (+ uge-446-b2.json) + C-*.png
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { UD, DIST, MOCK_URL, statiskServer, hentChromium, tabel, drosl } from './faelles-464.mjs'
import { koerUge } from './uge-464.mjs'
import { telefonTjek } from '../433/faelles.mjs'
import { signalerFraSeed } from '../428/coach-faelles.mjs'

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const browser = await hentChromium().launch({ headless: true })
const dist = DIST
const res = { bredder: {}, konsolFejl: [], tjek: [] }
const tjek = (navn, ok, detalje) => { res.tjek.push({ navn, ok: !!ok, detalje }); console.log(`  [coach] ${ok ? 'OK ' : 'FUND'} ${navn}${detalje ? `: ${detalje}` : ''}`) }
let uge
try {
  uge = await koerUge({ browser, dist, fx, createMockSupabase, prefix: 'U2', springMedNet: true })
  writeFileSync(path.join(UD, 'uge-446-b2.json'), JSON.stringify(uge.r, null, 2) + '\n')
  const { server, port } = await statiskServer(dist)
  const ugensIds = new Set(uge.exerciseIds.flat())
  const alleTabeller = async () => {
    const t = {}
    for (const n of ['athletes', 'weeks', 'sessions', 'exercises', 'exercise_logs', 'readiness_logs']) t[n] = await tabel(n)
    return { tables: t }
  }

  for (const bredde of [390, 1280]) {
    const f = {}
    res.bredder[bredde] = f
    const mobil = bredde < 600
    const context = await browser.newContext(mobil
      ? { viewport: { width: bredde, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: bredde, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', e => res.konsolFejl.push(`${bredde}: ${String(e).slice(0, 200)}`))
    page.on('console', m => { if (m.type() === 'error') res.konsolFejl.push(`${bredde}: ${m.text().slice(0, 200)}`) })
    const signaler = await signalerFraSeed(await alleTabeller())
    f.signaler = signaler.map(s => `${s.o_detector}: ${s.o_headline}`)
    await page.route('**/rest/v1/rpc/entropi_training_signals_v1', r => r.fulfill({ json: signaler }))
    const d = mobil ? await drosl(page) : null
    const shot = (navn, opt = {}) => page.screenshot({ path: path.join(UD, `C-${bredde}-${navn}.png`), ...opt })
    const t0 = Date.now()
    await page.goto(`http://127.0.0.1:${port}/`)
    await page.locator('#athlete-auth-email').fill(fx.COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(fx.COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Testatlet').first().waitFor({ timeout: 60000 })
    f.forsideMs = Date.now() - t0
    // Hvornaar staar ugen rigtigt paa forsiden (paa den droslede telefon tager hentningen tid)?
    f.forsideRigtigMs = await page.waitForFunction(() => {
      const rows = [...document.querySelectorAll('[role="button"]')].filter(r => r.innerText.includes('Testatlet'))
      const t = rows.length ? rows[rows.length - 1].innerText : ''
      // 456 (A7): hvad raekken viser undervejs, mens forsiden henter.
      ;(window.__raekker ||= []).push(t.replace(/\n/g, ' | '))
      return /\d af 4 pas/.test(t) && !/Ingen logs/.test(t)
    }, null, { timeout: 120000, polling: 250 }).then(() => Date.now() - t0, () => null)
    f.raekkeUnderHentning = [...new Set(await page.evaluate(() => window.__raekker || []))].filter(Boolean).slice(0, 8)
    tjek(`${bredde}: forsiden siger aldrig "Ingen logs" eller "0 af 4 pas", mens den henter (A7)`, !f.raekkeUnderHentning.some(t => /Ingen logs|0 af 4 pas/.test(t)), JSON.stringify(f.raekkeUnderHentning).slice(0, 300))
    await page.waitForTimeout(1500)

    // ---- forsiden ----
    f.raekke = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[role="button"]')].filter(r => r.innerText.includes('Testatlet'))
      return rows.length ? rows[rows.length - 1].innerText.replace(/\n/g, ' | ') : ''
    })
    f.forsideTjek = await telefonTjek(page)
    await shot('01-forside')
    await page.locator('[role="button"]', { hasText: 'Testatlet' }).last().scrollIntoViewIfNeeded()
    await shot('02-atletraekke')
    tjek(`${bredde}: forsiden siger 4 af 4 pas`, /4 af 4 pas/.test(f.raekke), f.raekke.slice(0, 200))

    // ---- "Kraever dit blik" ----
    const blik = page.getByText('Kræver dit blik').first()
    f.kraeverDitBlik = (await blik.count()) ? await page.evaluate(() => {
      const h = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Kræver dit blik')
      let box = h; for (let i = 0; i < 4 && box; i++) box = box.parentElement
      return (box?.innerText || '').replace(/\n+/g, ' | ').slice(0, 600)
    }) : null
    if (await blik.count()) { await blik.scrollIntoViewIfNeeded(); await shot('03-kraever-dit-blik') }
    tjek(`${bredde}: "Kraever dit blik" viser atletens linje fra "din uge"`, /Kaelderen var uden net/.test(f.kraeverDitBlik || ''), '')

    // ---- en kommentar: atletens linje -> Log ----
    const stemme = page.locator('button[aria-label^="Ugens stemme fra Testatlet"]')
    f.stemmeKnap = await stemme.count()
    if (f.stemmeKnap) {
      await stemme.first().click()
    } else {
      await page.locator('[role="button"]', { hasText: 'Testatlet' }).last().click()
      await page.waitForTimeout(1500)
      await page.getByRole('button', { name: /Log$/ }).first().click()
    }
    const tLog = Date.now()
    f.logMs = await page.getByText('Dag 2 — Bænk').first().waitFor({ timeout: 120000 }).then(() => Date.now() - tLog, () => null)
    await page.waitForTimeout(1500)

    // ---- Log: ugens fire pas ----
    const logTekst = await page.evaluate(() => document.body.innerText)
    f.log = {}
    for (const titel of ['Dag 1 — Squat', 'Dag 2 — Bænk', 'Dag 3 — Dødløft', 'Dag 4 — Volumen']) {
      const i = logTekst.indexOf(titel)
      f.log[titel] = i < 0 ? null : logTekst.slice(Math.max(0, i - 60), i + 420).replace(/\n+/g, ' | ')
    }
    f.logTjek = await telefonTjek(page)
    const dag2 = f.log['Dag 2 — Bænk'] || ''
    const dag3 = f.log['Dag 3 — Dødløft'] || ''
    tjek(`${bredde}: Log viser det sprungne saet fra pas 3 (med net)`, /sprunget over/.test(dag3), dag3.slice(0, 260))
    // Uden net kunne atleten ikke springe baenkpres 4 over (blok 1): coachen ser det som lavet.
    tjek(`${bredde}: Log viser baenkpres 4 i pas 2 som sprunget over (atletens hensigt i kaelderen)`, /sprunget over/.test(dag2), dag2.slice(0, 260))
    tjek(`${bredde}: Log viser datoer paa dansk, ingen UTC-dato som 2026-09-26 (A8)`, !/\d{4}-\d{2}-\d{2}/.test(logTekst), (logTekst.match(/\d{1,2}\. [A-Za-z]{3} \d{4}/) || [''])[0])
    f.nulKgILog = (logTekst.match(/\b0 ?kg\b[^\n|]*/g) || []).slice(0, 8)
    tjek(`${bredde}: Log viser noten og RPE 9 fra kaelderen`, logTekst.includes('skulder lidt oem'), '')
    // Samme pas maa kun staa een gang i ugen (et pas delt paa to datoer = to grupper).
    f.pasGrupper = Object.fromEntries(['Dag 1 — Squat', 'Dag 2 — Bænk'].map(t => [t, logTekst.split(t).length - 1]))
    await page.getByText('Dag 2 — Bænk').first().scrollIntoViewIfNeeded().catch(() => {})
    await shot('04-log-pas2')

    // ---- rekorderne: PR-tidslinjen ----
    try {
      const analyse = page.getByRole('button', { name: /Analyse/ }).first()
      if (!(await analyse.isVisible().catch(() => false))) { await page.getByRole('button', { name: /Mere/ }).first().click(); await page.waitForTimeout(500) }
      await page.getByRole('button', { name: /Analyse/ }).first().click()
      await page.getByText('PR-tidslinje').first().waitFor({ timeout: 30000 })
      await page.waitForTimeout(1200)
      f.prTidslinje = await page.evaluate(() => {
        const h = [...document.querySelectorAll('div')].find(e => e.textContent.trim() === 'PR-tidslinje')
        return (h?.parentElement?.innerText || '').replace(/\n+/g, ' | ').slice(0, 700)
      })
      await page.getByText('PR-tidslinje').first().scrollIntoViewIfNeeded()
      await shot('05-pr-tidslinje')
      tjek(`${bredde}: PR-tidslinjen har kaelderens baenkpres-rekorder (70 x 8, 80 x 6)`, /70 ?kg ?[×x] ?8/.test(f.prTidslinje) && /80 ?kg ?[×x] ?6/.test(f.prTidslinje), f.prTidslinje.slice(0, 300))
    } catch (e) { f.prTidslinje = `kunne ikke aabnes: ${String(e.message).slice(0, 120)}` }

    // ---- "Kopier seneste uge" ----
    try {
      const ugerFoer = (await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID)
      await page.getByRole('button', { name: /Program$/ }).first().click()
      const kopi = page.getByRole('button', { name: /Kopiér seneste uge/ })
      await kopi.waitFor({ timeout: 30000 })
      const tK = Date.now()
      if (mobil) {
        // 456: to tryk paa samme sted paa skaermen (som en finger), 250 ms imellem.
        // 446 brugte kopi.click() to gange; Playwright venter saa paa, at knappen
        // er aktiv igen, og med 456's spaerre kom andet tryk foerst, naar den
        // foerste kopi var faerdig. Det er ikke et dobbelttryk.
        const b = await kopi.boundingBox()
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
        await page.waitForTimeout(250)
        f.knapEfter250Ms = await page.evaluate(() => { const k = [...document.querySelectorAll('button')].find(x => /Kopier/.test(x.textContent)); return k ? { tekst: k.textContent.trim(), disabled: k.disabled } : null })
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
      } else await kopi.click()
      const graense = Date.now() + 60000
      while (Date.now() < graense && (await tabel('exercises')).length < uge.seed.tables.exercises.length + 12 * ((await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID).length - ugerFoer.length) - 0) await page.waitForTimeout(300)
      await page.waitForTimeout(4000)
      const ugerEfter = (await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID)
      const nye = ugerEfter.filter(w => !ugerFoer.some(u => u.id === w.id))
      const sessions = await tabel('sessions'); const exercises = await tabel('exercises')
      f.kopi = {
        tryk: mobil ? 'dobbelttryk (250 ms)' : 'et tryk', ms: Date.now() - tK, nyeUger: nye.map(w => ({ uge: w.week_number, start: w.start_date, pas: sessions.filter(s => s.week_id === w.id).length, oevelser: exercises.filter(e => sessions.some(s => s.week_id === w.id && s.id === e.session_id)).length })),
      }
      await shot('06-kopi')
      tjek(`${bredde}: "Kopier seneste uge" (${f.kopi.tryk}) giver een ny uge`, nye.length === 1, JSON.stringify(f.kopi.nyeUger))
      // Ryd op i mocken (kun mocken), saa naeste bredde starter fra samme uge.
      for (const w of nye) await fetch(`${MOCK_URL}/rest/v1/weeks?id=eq.${w.id}`, { method: 'DELETE' })
    } catch (e) { f.kopi = { fejl: String(e.message).slice(0, 200) } }

    // ---- videoen ----
    await page.goto(`http://127.0.0.1:${port}/`)
    await page.getByText('Testatlet').first().waitFor({ timeout: 60000 })
    await page.getByText('Ny måling fra et sæt').first().waitFor({ timeout: 60000 }).catch(() => {})
    f.video = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"], a')].map(b => b.innerText.replace(/\n+/g, ' ').trim()).filter(t => /video|måling|squat/i.test(t)).slice(0, 8))
    f.videoRaekker = (await tabel('video_analyses')).filter(v => v.athlete_id === fx.ATHLETE_ID).map(v => ({ state: v.analysis_state, lift: v.lift }))
    await shot('07-forside-video')
    await d?.cdp.detach().catch(() => {})
    await context.close()
  }

  // ---- regnskab: hvad coachen laeser, mod mocken ----
  const logs = (await tabel('exercise_logs')).filter(l => ugensIds.has(l.exercise_id))
  const dage = new Set(logs.map(l => l.logged_at.slice(0, 10)))
  res.ugensUtcDatoer = [...dage]
  res.personalRecords = (await tabel('personal_records')).filter(p => p.athlete_id === fx.ATHLETE_ID).map(p => `${p.exercise_name} ${p.weight}x${p.reps}`)
  server.close()
} catch (e) {
  res.fejl = String(e?.stack || e)
  console.error(e)
  process.exitCode = 1
} finally {
  writeFileSync(path.join(UD, 'coach-446.json'), JSON.stringify(res, null, 2) + '\n')
  await uge?.mock?.close()
  await browser.close()
  process.exit(process.exitCode || 0)
}
